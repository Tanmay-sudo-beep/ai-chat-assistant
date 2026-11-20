import { useEffect, useRef, useState } from 'react';

export default function Composer({ onSend, onStop, isStreaming, disabled, toneLabel }) {
  const [text, setText] = useState('');
  const ref = useRef(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = ref.current;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  useEffect(() => {
    if (!isStreaming) ref.current?.focus();
  }, [isStreaming]);

  const submit = () => {
    if (!text.trim() || isStreaming || disabled) return;
    onSend(text);
    setText('');
  };

  return (
    <div className="composer-wrap">
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder="Message the AI assistant…"
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {isStreaming ? (
          <button type="button" className="send-btn stop" onClick={onStop} title="Stop generating">
            ■
          </button>
        ) : (
          <button type="submit" className="send-btn" disabled={!text.trim() || disabled} title="Send">
            ➤
          </button>
        )}
      </form>
      <p className="composer-hint">
        Enter to send · Shift + Enter for new line · Tone: <b>{toneLabel}</b>
      </p>
    </div>
  );
}
