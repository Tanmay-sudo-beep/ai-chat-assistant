export const TONE_OPTIONS = [
  { key: 'professional', label: 'Professional', icon: '💼', hint: 'Formal, structured, polished' },
  { key: 'casual', label: 'Casual', icon: '😊', hint: 'Friendly and conversational' },
  { key: 'concise', label: 'Concise', icon: '⚡', hint: 'Shortest direct answer' },
];

/** 🎛️ The "Vibe Check" — sent to the backend with every request. */
export default function ToneToggle({ value, onChange }) {
  return (
    <div className="tone-toggle" role="radiogroup" aria-label="Response tone">
      {TONE_OPTIONS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="radio"
          aria-checked={value === t.key}
          className={`tone-btn ${value === t.key ? 'active' : ''}`}
          title={t.hint}
          onClick={() => onChange(t.key)}
        >
          <span aria-hidden>{t.icon}</span>
          <span className="tone-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
