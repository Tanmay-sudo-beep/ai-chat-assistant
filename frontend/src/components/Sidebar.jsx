import { useEffect, useMemo, useState } from 'react';

const DAY = 24 * 60 * 60 * 1000;

function groupByDate(conversations) {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const groups = { Today: [], Yesterday: [], 'Previous 7 days': [], Older: [] };
  for (const c of conversations) {
    const t = new Date(c.updatedAt).getTime();
    if (t >= startOfToday) groups.Today.push(c);
    else if (t >= startOfToday - DAY) groups.Yesterday.push(c);
    else if (t >= startOfToday - 7 * DAY) groups['Previous 7 days'].push(c);
    else groups.Older.push(c);
  }
  return Object.entries(groups).filter(([, items]) => items.length);
}

export default function Sidebar({
  conversations,
  activeId,
  open,
  search,
  onSearch,
  onSelect,
  onNew,
  onDelete,
  onRename,
  health,
}) {
  const [query, setQuery] = useState(search);

  // ⭐ Debounced full-text search (server searches titles, prompts & replies)
  useEffect(() => {
    const t = setTimeout(() => onSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query, onSearch]);

  const groups = useMemo(() => groupByDate(conversations), [conversations]);

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-top">
        <div className="brand">
          <span className="brand-logo">💬</span> AI Chat Assistant
        </div>
        <button className="new-chat-btn" onClick={onNew}>
          ＋ New chat
        </button>
        <input
          className="search-input"
          type="search"
          placeholder="Search all chats…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <nav className="history" aria-label="Conversation history">
        {groups.length === 0 && (
          <p className="history-empty">{search ? 'No chats match your search.' : 'No conversations yet.'}</p>
        )}
        {groups.map(([label, items]) => (
          <section key={label}>
            <h4 className="history-group">{label}</h4>
            {items.map((c) => (
              <div
                key={c._id}
                className={`history-item ${c._id === activeId ? 'active' : ''}`}
                onClick={() => onSelect(c._id)}
                title={c.lastPrompt || c.title}
              >
                <div className="history-text">
                  <span className="history-title">{c.title}</span>
                  <span className="history-sub">
                    {c.messageCount} msg · {new Date(c.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="history-actions">
                  <button
                    title="Rename"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRename(c);
                    }}
                  >
                    ✎
                  </button>
                  <button
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(c);
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </section>
        ))}
      </nav>

      <footer className="sidebar-footer">
        <span className={`dot ${health?.db ? 'ok' : 'bad'}`} />
        {health ? (
          <span>
            {health.provider} · {health.model}
          </span>
        ) : (
          <span>Backend offline</span>
        )}
      </footer>
    </aside>
  );
}
