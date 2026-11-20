import ToneToggle from './ToneToggle.jsx';
import { api } from '../api.js';

export default function ChatHeader({ title, tone, onToneChange, onMenu, conversationId }) {
  return (
    <header className="chat-header">
      <button className="menu-btn" onClick={onMenu} aria-label="Open history">
        ☰
      </button>
      <h1 className="chat-title" title={title}>
        {title}
      </h1>

      <ToneToggle value={tone} onChange={onToneChange} />

      {conversationId && (
        <details className="export">
          <summary title="Export conversation">⬇ Export</summary>
          <div className="export-menu">
            <a href={api.exportUrl(conversationId, 'md')} download>
              Markdown (.md)
            </a>
            <a href={api.exportUrl(conversationId, 'json')} download>
              JSON (.json)
            </a>
          </div>
        </details>
      )}
    </header>
  );
}
