import 'dotenv/config';

/* =====================================================================
 * 🔑  API KEY & PROVIDER CONFIGURATION  (single source of truth)
 * ---------------------------------------------------------------------
 *  ❌ Do NOT paste API keys in this file.
 *  ✅ Put them in  backend/.env  (copy backend/.env.example):
 *
 *       AI_PROVIDER=openai            # openai | claude | mock
 *       OPENAI_API_KEY=sk-...
 *       OPENAI_MODEL=gpt-4o-mini
 *       ANTHROPIC_API_KEY=sk-ant-...
 *       CLAUDE_MODEL=claude-sonnet-5-5
 *
 *  To switch provider / key / model → edit .env and restart the server.
 *  Nothing else in the codebase needs to change.
 * ===================================================================== */

export const SUPPORTED_PROVIDERS = ['openai', 'claude', 'mock'];

const num = (value, fallback) =>
  value !== undefined && value !== '' && !Number.isNaN(Number(value)) ? Number(value) : fallback;

export const config = {
  port: num(process.env.PORT, 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai_chat_assistant',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  ai: {
    provider: (process.env.AI_PROVIDER || 'mock').trim().toLowerCase(),
    maxTokens: num(process.env.MAX_TOKENS, 1024),
    temperature: num(process.env.TEMPERATURE, 0.7),
    maxHistoryExchanges: num(process.env.MAX_HISTORY_EXCHANGES, 20),

    // ── OpenAI (or any OpenAI-compatible API) ────────────────────────
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '', // 🔑 from .env
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    },

    // ── Anthropic Claude ─────────────────────────────────────────────
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY || '', // 🔑 from .env
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
    },
  },
};

/** Model name currently in use (for logging / storing with each message). */
export function activeModel() {
  const { provider, openai, claude } = config.ai;
  if (provider === 'openai') return openai.model;
  if (provider === 'claude') return claude.model;
  return 'mock-model';
}

const looksLikePlaceholder = (key) => !key || key.includes('REPLACE_WITH');

/** Prints helpful warnings at startup so misconfiguration is obvious. */
export function validateConfig() {
  const { provider, openai, claude } = config.ai;

  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new Error(
      `AI_PROVIDER="${provider}" is invalid. Use one of: ${SUPPORTED_PROVIDERS.join(', ')}`
    );
  }
  if (provider === 'openai' && looksLikePlaceholder(openai.apiKey)) {
    console.warn('⚠️  AI_PROVIDER=openai but OPENAI_API_KEY is missing in backend/.env');
  }
  if (provider === 'claude' && looksLikePlaceholder(claude.apiKey)) {
    console.warn('⚠️  AI_PROVIDER=claude but ANTHROPIC_API_KEY is missing in backend/.env');
  }
  console.log(`🤖 AI provider: ${provider} (${activeModel()})`);
}
