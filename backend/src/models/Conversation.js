import mongoose from 'mongoose';
import { TONE_KEYS, DEFAULT_TONE } from '../services/tones.js';

/**
 * One exchange = one user prompt + the AI response, with timestamp.
 * (Exactly the "conversation object" required by the problem statement.)
 */
const exchangeSchema = new mongoose.Schema(
  {
    userPrompt: { type: String, required: true, trim: true },
    aiResponse: { type: String, default: '' },
    tone: { type: String, enum: TONE_KEYS, default: DEFAULT_TONE },
    provider: { type: String },
    model: { type: String },
    status: { type: String, enum: ['complete', 'stopped', 'error'], default: 'complete' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const conversationSchema = new mongoose.Schema(
  {
    title: { type: String, default: 'New chat', trim: true, maxlength: 120 },
    exchanges: { type: [exchangeSchema], default: [] },
  },
  { timestamps: true } // createdAt / updatedAt
);

conversationSchema.index({ updatedAt: -1 });

/** Auto title from the first prompt. */
conversationSchema.statics.titleFrom = function (prompt) {
  const clean = prompt.replace(/\s+/g, ' ').trim();
  return clean.length > 50 ? `${clean.slice(0, 50).trimEnd()}…` : clean || 'New chat';
};

export default mongoose.model('Conversation', conversationSchema);
