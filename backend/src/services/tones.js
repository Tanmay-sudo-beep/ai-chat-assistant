/* =====================================================================
 * 🎛️  TONE TOGGLE  →  "system instruction" modifier
 * The selected tone is sent with EVERY request, so switching the
 * toggle changes the style of the very next reply instantly.
 * ===================================================================== */

export const TONES = {
  professional: {
    label: 'Professional',
    instruction:
      'Respond in a professional, formal and polished tone. Use precise language, clear structure ' +
      '(headings or numbered points where useful) and complete sentences. No slang, no emojis.',
  },
  casual: {
    label: 'Casual',
    instruction:
      'Respond in a friendly, relaxed, conversational tone — like a helpful friend. Contractions, ' +
      'simple words and light humour are welcome; an occasional emoji is fine. Stay accurate.',
  },
  concise: {
    label: 'Concise',
    instruction:
      'Respond as briefly as possible. Give the direct answer first in the fewest words needed. ' +
      'No preamble, no filler, no repetition. Use short bullet points only if they are essential.',
  },
};

export const TONE_KEYS = Object.keys(TONES);
export const DEFAULT_TONE = 'professional';
export const isValidTone = (tone) => TONE_KEYS.includes(tone);

const BASE_SYSTEM_PROMPT =
  'You are a helpful, accurate and honest AI assistant. ' +
  'Format answers in Markdown (lists, tables, fenced code blocks with a language tag) when it improves readability.';

/** Builds the final system instruction sent to OpenAI / Claude. */
export function buildSystemInstruction(tone = DEFAULT_TONE) {
  const selected = TONES[tone] ?? TONES[DEFAULT_TONE];
  return [
    BASE_SYSTEM_PROMPT,
    '',
    `TONE INSTRUCTION — ${selected.label.toUpperCase()}: ${selected.instruction}`,
    'Apply this tone to the current reply even if earlier replies in the conversation used a different tone.',
  ].join('\n');
}
