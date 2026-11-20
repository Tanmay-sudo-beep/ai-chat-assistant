import { Router } from 'express';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';

const router = Router();

router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid conversation id.' });
  next();
});

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * GET /api/conversations?q=keyword
 * History sidebar list (newest first). ⭐ `q` = full-text search across
 * titles, prompts and AI responses of ALL past chats.
 */
router.get('/', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const match = {};
    if (q) {
      const rx = new RegExp(escapeRegex(q.slice(0, 100)), 'i');
      match.$or = [{ title: rx }, { 'exchanges.userPrompt': rx }, { 'exchanges.aiResponse': rx }];
    }

    const list = await Conversation.aggregate([
      { $match: match },
      { $sort: { updatedAt: -1 } },
      { $limit: 200 },
      {
        $project: {
          title: 1,
          createdAt: 1,
          updatedAt: 1,
          messageCount: { $size: '$exchanges' },
          lastPrompt: { $arrayElemAt: ['$exchanges.userPrompt', -1] },
        },
      },
    ]);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

/** GET /api/conversations/:id — full thread (retrieval) */
router.get('/:id', async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id).lean();
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });
    res.json(conversation);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/conversations/:id — rename */
router.patch('/:id', async (req, res, next) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 120) : '';
    if (!title) return res.status(400).json({ error: 'Title is required.' });
    const conversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { title },
      { new: true, projection: { title: 1, updatedAt: 1 } }
    );
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });
    res.json(conversation);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/conversations/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Conversation.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Conversation not found.' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** ⭐ EXTRA FEATURE — GET /api/conversations/:id/export?format=md|json */
router.get('/:id/export', async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id).lean();
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });

    const format = req.query.format === 'json' ? 'json' : 'md';
    const slug =
      conversation.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) ||
      'chat';
    res.setHeader('Content-Disposition', `attachment; filename="${slug}.${format}"`);

    if (format === 'json') {
      res.type('application/json').send(JSON.stringify(conversation, null, 2));
      return;
    }

    const fmt = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    const lines = [
      `# ${conversation.title}`,
      '',
      `_Exported ${fmt(Date.now())} · ${conversation.exchanges.length} exchanges_`,
      '',
    ];
    for (const ex of conversation.exchanges) {
      lines.push(
        `### 🧑 You — ${fmt(ex.timestamp)}`,
        '',
        ex.userPrompt,
        '',
        `### 🤖 Assistant — ${ex.tone}${ex.status !== 'complete' ? ` (${ex.status})` : ''}`,
        '',
        ex.aiResponse || '_(no response)_',
        '',
        '---',
        ''
      );
    }
    res.type('text/markdown').send(lines.join('\n'));
  } catch (err) {
    next(err);
  }
});

export default router;
