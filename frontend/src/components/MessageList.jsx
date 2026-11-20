import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble.jsx';

const SUGGESTIONS = [
  'Explain the difference between TCP and UDP',
  'Write a Python function to check if a string is a palindrome',
  'Give me a 5-day study plan for thermodynamics',
  'Draft a polite email asking for an internship extension',
];

export default function MessageList({ messages, loading, isStreaming, onSuggestion, onRegenerate }) {
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);
  const prevCount = useRef(0);

  const onScroll = () => {
    const el = scrollRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Auto-scroll while streaming, unless the user scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (messages.length > prevCount.current) stickToBottom.current = true; // new message sent
    prevCount.current = messages.length;
    if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (loading) {
    return (
      <div className="messages center">
        <div className="spinner" />
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div className="messages center">
        <div className="empty">
          <div className="empty-logo">💬</div>
          <h2>How can I help you today?</h2>
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="suggestion" onClick={() => onSuggestion(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const lastIndex = messages.length - 1;
  return (
    <div className="messages" ref={scrollRef} onScroll={onScroll}>
      <div className="messages-inner">
        {messages.map((m, i) => (
          <MessageBubble
            key={m.id}
            message={m}
            showRegenerate={i === lastIndex && m.role === 'assistant' && !isStreaming}
            onRegenerate={i === lastIndex ? onRegenerate : undefined}
          />
        ))}
      </div>
    </div>
  );
}
