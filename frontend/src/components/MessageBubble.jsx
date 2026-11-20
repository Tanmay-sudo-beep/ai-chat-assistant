import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const markdownComponents = {
  // eslint-disable-next-line no-unused-vars
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
};

const formatTime = (ts) =>
  ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

function TypingDots() {
  return (
    <div className="typing" aria-label="AI is thinking">
      <span />
      <span />
      <span />
    </div>
  );
}

function MessageBubble({ message, showRegenerate, onRegenerate }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  let body;
  if (isUser) {
    body = <p className="user-text">{message.content}</p>;
  } else if (message.streaming && !message.content) {
    body = <TypingDots />;
  } else if (!message.content) {
    body = (
      <p className="muted">
        {message.status === 'error' ? '⚠️ No response — the request failed. Try “Regenerate”.' : '(empty response)'}
      </p>
    );
  } else {
    body = (
      <div className="markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {message.content}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className={`row ${isUser ? 'row-user' : 'row-ai'}`}>
      {!isUser && <div className="avatar">AI</div>}
      <div className={`bubble ${isUser ? 'bubble-user' : 'bubble-ai'} ${message.streaming ? 'streaming' : ''}`}>
        {body}
        <div className="meta">
          <span>{formatTime(message.timestamp)}</span>
          {!isUser && message.tone && <span className={`badge tone-${message.tone}`}>{message.tone}</span>}
          {message.status === 'stopped' && <span className="badge badge-warn">stopped</span>}
          {!isUser && !message.streaming && message.content && (
            <button className="meta-btn" onClick={copy}>
              {copied ? '✓ Copied' : '⧉ Copy'}
            </button>
          )}
          {showRegenerate && (
            <button className="meta-btn" onClick={onRegenerate} title="Regenerate using the currently selected tone">
              ↻ Regenerate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(MessageBubble);
