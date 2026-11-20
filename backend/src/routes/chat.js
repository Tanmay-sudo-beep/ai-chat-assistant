import { Router } from 'express';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import { streamCompletion, describeAIError, providerInfo } from '../services/aiProvider.js';
import { buildSystemInstruction, isValidTone, DEFAULT_TONE } from '../services/tones.js';
import { config } from '../config/index.js';

const router = Router();

// ── Server-Sent Events helpers ────────────────────────────────────────
function initSSE(res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering (nginx)
  res.flushHeaders();
}

const sendEvent = (res, event, data) => {
  if (!res.writableEnded && !res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

/** Previous exchanges → provider message format (skips failed/empty ones). */
function toHistory(exchanges) {
  return exchanges
    .filter((ex) => ex.aiResponse && ex.aiResponse.trim())
    .slice(-config.ai.maxHistoryExchanges)
    .flatMap((ex) => [
      { role: 'user', content: ex.userPrompt },
      { role: 'assistant', content: ex.aiResponse },
    ]);
}

/**
 * Streams the AI reply to the client and persists the exchange in MongoDB
 * (also when the user presses Stop, or when the provider errors).
 */
async function streamReply({ res, conversation, prompt, tone }) {
  initSSE(res);

  const controller = new AbortController();
  let clientGone = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      clientGone = true;
      controller.abort(); // user pressed Stop / closed tab → stop paying for tokens
    }
  });

  const { provider, model } = providerInfo();
  sendEvent(res, 'meta', {
    conversationId: conversation._id,
    title: conversation.title,
    provider,
    model,
    tone,
  });

  const exchange = { userPrompt: prompt, aiResponse: '', tone, provider, model, timestamp: new Date() };
  let status = 'complete';

  try {
    const chunks = streamCompletion({
      system: buildSystemInstruction(tone), // 🎛️ tone → system instruction
      history: toHistory(conversation.exchanges),
      prompt,
      tone,
      signal: controller.signal,
    });
    for await (const text of chunks) {
      exchange.aiResponse += text;
      sendEvent(res, 'delta', { text });
    }
    if (clientGone) status = 'stopped';
  } catch (err) {
    if (clientGone || controller.signal.aborted) {
      status = 'stopped';
    } else {
      status = 'error';
      console.error('AI error:', err?.status ?? '', err?.message);
      sendEvent(res, 'error', { message: describeAIError(err) });
    }
  }

  exchange.status = status;
  conversation.exchanges.push(exchange);

  let saved;
  try {
    await conversation.save();
    saved = conversation.exchanges[conversation.exchanges.length - 1];
  } catch (err) {
    console.error('DB save error:', err.message);
    sendEvent(res, 'error', { message: 'Reply generated but could not be saved to the database.' });
  }

  sendEvent(res, 'done', {
    status,
    exchangeId: saved?._id,
    timestamp: exchange.timestamp,
  });
  if (!res.writableEnded) res.end();
}

function readTone(body) {
  const tone = body?.tone ?? DEFAULT_TONE;
  return isValidTone(tone) ? tone : null;
}

/**
 * POST /api/chat
 * body: { conversationId?: string, message: string, tone: 'professional'|'casual'|'concise' }
 * Creates the conversation on the first message.
 */
router.post('/', async (req, res, next) => {
  try {
    const { conversationId, message } = req.body ?? {};
    const tone = readTone(req.body);
    const prompt = typeof message === 'string' ? message.trim() : '';

    if (!prompt) return res.status(400).json({ error: 'Message is required.' });
    if (prompt.length > 20000) return res.status(400).json({ error: 'Message is too long.' });
    if (!tone) return res.status(400).json({ error: 'Invalid tone.' });

    let conversation;
    if (conversationId) {
      if (!mongoose.isValidObjectId(conversationId)) {
        return res.status(400).json({ error: 'Invalid conversation id.' });
      }
      conversation = await Conversation.findById(conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });
    } else {
      conversation = await Conversation.create({ title: Conversation.titleFrom(prompt) });
    }

    await streamReply({ res, conversation, prompt, tone });
  } catch (err) {
    next(err);
  }
});

/**
 * ⭐ EXTRA FEATURE — POST /api/chat/regenerate
 * body: { conversationId, tone }
 * Replaces the last AI answer with a new one (optionally in a new tone).
 */
router.post('/regenerate', async (req, res, next) => {
  try {
    const { conversationId } = req.body ?? {};
    const tone = readTone(req.body);
    if (!tone) return res.status(400).json({ error: 'Invalid tone.' });
    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation id.' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });
    if (!conversation.exchanges.length) {
      return res.status(400).json({ error: 'Nothing to regenerate.' });
    }

    const last = conversation.exchanges.pop(); // removed; re-added with the new answer
    await streamReply({ res, conversation, prompt: last.userPrompt, tone });
  } catch (err) {
    next(err);
  }
});

export default router;
