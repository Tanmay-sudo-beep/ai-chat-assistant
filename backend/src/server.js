import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config, validateConfig } from './config/index.js';
import { connectDB, isDbConnected } from './config/db.js';
import { providerInfo } from './services/aiProvider.js';
import { TONES } from './services/tones.js';
import chatRouter from './routes/chat.js';
import conversationsRouter from './routes/conversations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '1mb' }));

// ── API ───────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    db: isDbConnected(),
    ...providerInfo(),
    tones: Object.fromEntries(Object.entries(TONES).map(([k, v]) => [k, v.label])),
  });
});
app.use('/api/chat', chatRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));

// ── Serve the built frontend in production (npm run build in /frontend) ──
const distDir = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// ── Error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (res.headersSent) return res.end();
  const status = err.type === 'entity.parse.failed' ? 400 : err.status || 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error.' : err.message });
});

// ── Boot ──────────────────────────────────────────────────────────────
try {
  validateConfig();
  await connectDB(config.mongoUri);
  app.listen(config.port, () => console.log(`🚀 API running on http://localhost:${config.port}`));
} catch (err) {
  console.error('❌ Failed to start:', err.message);
  process.exit(1);
}
