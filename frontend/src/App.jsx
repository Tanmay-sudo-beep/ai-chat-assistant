import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import ChatHeader from './components/ChatHeader.jsx';
import MessageList from './components/MessageList.jsx';
import Composer from './components/Composer.jsx';
import { TONE_OPTIONS } from './components/ToneToggle.jsx';
import { useTypewriter } from './hooks/useTypewriter.js';
import { api, streamChat } from './api.js';

const TONE_STORAGE_KEY = 'ai-chat:tone';

const readSavedTone = () => {
  try {
    const t = localStorage.getItem(TONE_STORAGE_KEY);
    return TONE_OPTIONS.some((o) => o.key === t) ? t : 'professional';
  } catch {
    return 'professional';
  }
};

/** DB exchanges → UI bubbles */
const exchangesToMessages = (exchanges = []) =>
  exchanges.flatMap((ex) => [
    { id: `${ex._id}-u`, role: 'user', content: ex.userPrompt, timestamp: ex.timestamp },
    {
      id: `${ex._id}-a`,
      role: 'assistant',
      content: ex.aiResponse,
      timestamp: ex.timestamp,
      tone: ex.tone,
      status: ex.status,
    },
  ]);

/** Keeps ?chat=<id> in the URL so a refresh re-opens the same thread. */
const setUrlChat = (id) => {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('chat', id);
  else url.searchParams.delete('chat');
  window.history.replaceState(null, '', url);
};

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [tone, setTone] = useState(readSavedTone);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [health, setHealth] = useState(null);

  const activeIdRef = useRef(null);
  const searchRef = useRef('');
  const abortRef = useRef(null);
  const runIdRef = useRef(0);
  const loadIdRef = useRef(0);

  const selectActive = useCallback((id) => {
    activeIdRef.current = id;
    setActiveId(id);
    setUrlChat(id);
  }, []);

  // ── Message state helpers ──────────────────────────────────────────
  const appendToLast = useCallback((chunk) => {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const copy = prev.slice();
      const last = copy[copy.length - 1];
      copy[copy.length - 1] = { ...last, content: last.content + chunk };
      return copy;
    });
  }, []);

  const patchLast = useCallback((patch) => {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const copy = prev.slice();
      copy[copy.length - 1] = { ...copy[copy.length - 1], ...patch };
      return copy;
    });
  }, []);

  const typewriter = useTypewriter(appendToLast);

  // ── History sidebar ────────────────────────────────────────────────
  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await api.listConversations(searchRef.current));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const handleSearch = useCallback((q) => setSearch(q), []);

  useEffect(() => {
    searchRef.current = search;
    refreshConversations();
  }, [search, refreshConversations]);

  // ── Tone persists across reloads ───────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(TONE_STORAGE_KEY, tone);
    } catch {
      /* storage unavailable */
    }
  }, [tone]);

  // ── Stream control ─────────────────────────────────────────────────
  const cancelActiveStream = useCallback(() => {
    runIdRef.current += 1; // invalidates any in-flight run
    abortRef.current?.abort();
    abortRef.current = null;
    typewriter.reset();
    setIsStreaming(false);
  }, [typewriter]);

  const runStream = useCallback(
    async (path, body) => {
      const runId = ++runIdRef.current;
      const isCurrent = () => runIdRef.current === runId;
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      setError(null);
      let status = 'complete';

      try {
        await streamChat(path, body, {
          signal: controller.signal,
          onEvent: (event, data) => {
            if (!isCurrent()) return;
            if (event === 'meta') {
              if (data.conversationId !== activeIdRef.current) {
                selectActive(data.conversationId); // first message created a new chat
                refreshConversations();
              }
            } else if (event === 'delta') {
              typewriter.push(data.text); // → character-by-character reveal
            } else if (event === 'error') {
              status = 'error';
              setError(data.message);
            } else if (event === 'done') {
              status = data.status || status;
            }
          },
        });
        if (isCurrent()) await typewriter.drain();
      } catch (err) {
        if (!isCurrent()) return;
        typewriter.flush();
        if (err.name === 'AbortError') status = 'stopped';
        else {
          status = 'error';
          setError(err.message || 'Network error — is the backend running?');
        }
      }

      if (!isCurrent()) return;
      patchLast({ streaming: false, status });
      abortRef.current = null;
      setIsStreaming(false);
      refreshConversations();
    },
    [typewriter, patchLast, refreshConversations, selectActive]
  );

  // ── Actions ────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    (text) => {
      const prompt = text.trim();
      if (!prompt || isStreaming) return;
      const now = new Date().toISOString();
      const key = Date.now();
      setMessages((prev) => [
        ...prev,
        { id: `u-${key}`, role: 'user', content: prompt, timestamp: now },
        { id: `a-${key}`, role: 'assistant', content: '', timestamp: now, tone, streaming: true },
      ]);
      runStream('/api/chat', { conversationId: activeIdRef.current, message: prompt, tone });
    },
    [isStreaming, tone, runStream]
  );

  // ⭐ EXTRA FEATURE 1a — Regenerate (uses the CURRENT tone → instant re-style)
  const regenerate = useCallback(() => {
    if (isStreaming || !activeIdRef.current) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== 'assistant') return prev;
      return [
        ...prev.slice(0, -1),
        { ...last, content: '', tone, status: undefined, streaming: true, timestamp: new Date().toISOString() },
      ];
    });
    runStream('/api/chat/regenerate', { conversationId: activeIdRef.current, tone });
  }, [isStreaming, tone, runStream]);

  // ⭐ EXTRA FEATURE 1b — Stop generating (backend saves the partial reply)
  const stop = useCallback(() => {
    abortRef.current?.abort();
    typewriter.flush();
  }, [typewriter]);

  const openConversation = useCallback(
    async (id) => {
      cancelActiveStream();
      setSidebarOpen(false);
      setError(null);
      setLoadingChat(true);
      selectActive(id);
      const loadId = ++loadIdRef.current;
      try {
        const conv = await api.getConversation(id);
        if (loadId === loadIdRef.current) setMessages(exchangesToMessages(conv.exchanges));
      } catch (e) {
        if (loadId !== loadIdRef.current) return;
        setError(e.message);
        selectActive(null);
        setMessages([]);
      } finally {
        if (loadId === loadIdRef.current) setLoadingChat(false);
      }
    },
    [cancelActiveStream, selectActive]
  );

  const newChat = useCallback(() => {
    cancelActiveStream();
    loadIdRef.current += 1;
    setLoadingChat(false);
    selectActive(null);
    setMessages([]);
    setError(null);
    setSidebarOpen(false);
  }, [cancelActiveStream, selectActive]);

  const deleteConversation = useCallback(
    async (conv) => {
      if (!window.confirm(`Delete "${conv.title}"? This cannot be undone.`)) return;
      try {
        await api.deleteConversation(conv._id);
        if (conv._id === activeIdRef.current) newChat();
        refreshConversations();
      } catch (e) {
        setError(e.message);
      }
    },
    [newChat, refreshConversations]
  );

  const renameConversation = useCallback(
    async (conv) => {
      const title = window.prompt('Rename conversation', conv.title)?.trim();
      if (!title || title === conv.title) return;
      try {
        await api.renameConversation(conv._id, title);
        refreshConversations();
      } catch (e) {
        setError(e.message);
      }
    },
    [refreshConversations]
  );

  // ── Initial load: backend status + reopen ?chat=<id> ───────────────
  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
    const id = new URLSearchParams(window.location.search).get('chat');
    if (id) openConversation(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTitle = conversations.find((c) => c._id === activeId)?.title || (activeId ? 'Chat' : 'New chat');
  const toneLabel = TONE_OPTIONS.find((t) => t.key === tone)?.label;

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        search={search}
        onSearch={handleSearch}
        onSelect={openConversation}
        onNew={newChat}
        onDelete={deleteConversation}
        onRename={renameConversation}
        health={health}
      />
      {sidebarOpen && <div className="backdrop" onClick={() => setSidebarOpen(false)} />}

      <main className="chat">
        <ChatHeader
          title={activeTitle}
          tone={tone}
          onToneChange={setTone}
          onMenu={() => setSidebarOpen(true)}
          conversationId={activeId}
        />

        <MessageList
          messages={messages}
          loading={loadingChat}
          isStreaming={isStreaming}
          onSuggestion={sendMessage}
          onRegenerate={regenerate}
        />

        {error && (
          <div className="error-banner" role="alert">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}

        <Composer
          onSend={sendMessage}
          onStop={stop}
          isStreaming={isStreaming}
          disabled={loadingChat}
          toneLabel={toneLabel}
        />
      </main>
    </div>
  );
}
