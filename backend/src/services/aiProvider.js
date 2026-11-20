import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config, activeModel } from '../config/index.js';

/* =====================================================================
 * 🔌  API INTEGRATION LAYER
 * ---------------------------------------------------------------------
 * One function — streamCompletion() — yields text chunks no matter
 * which provider is active. Provider + keys come from backend/.env
 * (see src/config/index.js). Add a new provider = add one generator.
 * ===================================================================== */

class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.code = 'CONFIG';
  }
}

const isMissing = (key) => !key || key.includes('REPLACE_WITH');

// ── Lazily-created SDK clients ────────────────────────────────────────
let openaiClient = null;
let anthropicClient = null;

function getOpenAI() {
  const { apiKey, baseURL } = config.ai.openai;
  if (isMissing(apiKey)) {
    throw new ConfigError('OPENAI_API_KEY is not set. Add it to backend/.env and restart the server.');
  }
  // 🔑 OpenAI key injected here (from .env)
  openaiClient ??= new OpenAI({ apiKey, baseURL });
  return openaiClient;
}

function getAnthropic() {
  const { apiKey } = config.ai.claude;
  if (isMissing(apiKey)) {
    throw new ConfigError('ANTHROPIC_API_KEY is not set. Add it to backend/.env and restart the server.');
  }
  // 🔑 Anthropic key injected here (from .env)
  anthropicClient ??= new Anthropic({ apiKey });
  return anthropicClient;
}

// ── OpenAI: Chat Completions streaming ────────────────────────────────
async function* streamOpenAI({ system, history, prompt, signal }) {
  const client = getOpenAI();
  const stream = await client.chat.completions.create(
    {
      model: config.ai.openai.model,
      temperature: config.ai.temperature,
      max_tokens: config.ai.maxTokens,
      stream: true,
      messages: [
        { role: 'system', content: system }, // 🎛️ tone-modified system instruction
        ...history,
        { role: 'user', content: prompt },
      ],
    },
    { signal }
  );

  for await (const chunk of stream) {
    const text = chunk.choices?.[0]?.delta?.content;
    if (text) yield text;
  }
}

// ── Claude: Messages API streaming ────────────────────────────────────
async function* streamClaude({ system, history, prompt, signal }) {
  const client = getAnthropic();
  const stream = client.messages.stream(
    {
      model: config.ai.claude.model,
      max_tokens: config.ai.maxTokens,
      temperature: config.ai.temperature,
      system, // 🎛️ tone-modified system instruction
      messages: [...history, { role: 'user', content: prompt }],
    },
    { signal }
  );

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

// ── Mock: lets you test the full UI with no API key ───────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MOCK_REPLIES = {
  professional: (p) =>
    `Thank you for your question regarding **"${p.slice(0, 60)}"**.\n\n` +
    `This is a *mock* response used for testing. To receive real answers:\n\n` +
    `1. Open \`backend/.env\`\n2. Set \`AI_PROVIDER=openai\` or \`AI_PROVIDER=claude\`\n` +
    `3. Add the corresponding API key and restart the server.\n\nKind regards.`,
  casual: (p) =>
    `Hey! 👋 You asked: "${p.slice(0, 60)}" — love it.\n\n` +
    `Heads up though, I'm just the **mock bot** right now 😄. Pop your API key into \`backend/.env\`, ` +
    `flip \`AI_PROVIDER\` to \`openai\` or \`claude\`, restart, and the real AI takes over!`,
  concise: () => `Mock reply. Set \`AI_PROVIDER\` + API key in \`backend/.env\`, restart.`,
};

async function* streamMock({ prompt, tone, signal }) {
  const text = (MOCK_REPLIES[tone] ?? MOCK_REPLIES.professional)(prompt);
  for (const piece of text.split(/(\s+)/)) {
    if (signal?.aborted) {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      throw err;
    }
    await sleep(30);
    yield piece;
  }
}

// ── Public API ────────────────────────────────────────────────────────
const PROVIDERS = { openai: streamOpenAI, claude: streamClaude, mock: streamMock };

/**
 * Streams the assistant reply as text chunks.
 * @param {{system:string, history:{role:'user'|'assistant',content:string}[], prompt:string, tone:string, signal?:AbortSignal}} args
 */
export async function* streamCompletion(args) {
  const impl = PROVIDERS[config.ai.provider];
  if (!impl) throw new ConfigError(`Unknown AI_PROVIDER "${config.ai.provider}"`);
  yield* impl(args);
}

export const providerInfo = () => ({ provider: config.ai.provider, model: activeModel() });

/** Converts SDK errors into messages a user can act on. */
export function describeAIError(err) {
  if (err?.code === 'CONFIG') return err.message;
  const name = config.ai.provider === 'claude' ? 'Anthropic' : 'OpenAI';
  switch (err?.status) {
    case 400:
      return `${name} rejected the request: ${err.message}`;
    case 401:
    case 403:
      return `Invalid ${name} API key. Update it in backend/.env and restart the server.`;
    case 404:
      return `Model "${activeModel()}" was not found. Check the model name in backend/.env.`;
    case 429:
      return `${name} rate limit or quota exceeded. Wait a moment or check your billing.`;
    default:
      if (err?.status >= 500) return `${name} is having trouble right now. Please try again.`;
      return err?.message || 'Unexpected error while contacting the AI provider.';
  }
}
