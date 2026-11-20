# 💬 AI Chat Assistant

Full-stack AI chat with real-time streaming, MongoDB history and a tone toggle.
**Stack:** React (Vite) · Node.js / Express · MongoDB (Mongoose) · OpenAI or Claude API (SSE streaming)

---

## 🔑 Where the API keys go (ONE file)

```
backend/.env      ← copy from backend/.env.example
```

```env
AI_PROVIDER=openai                 # openai | claude | mock (mock = no key needed)
OPENAI_API_KEY=sk-...              # used when AI_PROVIDER=openai
OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_API_KEY=sk-ant-...       # used when AI_PROVIDER=claude
CLAUDE_MODEL=claude-sonnet-5-5
MONGODB_URI=mongodb://127.0.0.1:27017/ai_chat_assistant
```

To switch provider or key, edit `.env` and restart the backend. You don't need to change any code.
Keys stay on the server and are never sent to the browser.
The integration code is in `backend/src/config/index.js` and `backend/src/services/aiProvider.js`; look for the 🔑 comments.

---

## ▶️ Run it

Requirements: Node 18.17+ and MongoDB (local install, or a free MongoDB Atlas cluster).

```bash
cd ai-chat-assistant
cp backend/.env.example backend/.env     # then put your key in it
npm run install:all
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000 (health check: `/api/health`)

Production: run `npm run build`, then `npm start`. Express then serves the built frontend on port 5000.

---

## ✅ Requirements → where they're implemented

| Requirement | Implementation |
|---|---|
| Chat interface with separate user and AI bubbles | `MessageList.jsx`, `MessageBubble.jsx` (Markdown, code blocks, tables) |
| Character-by-character streaming | Backend streams tokens over **SSE** (`routes/chat.js`), and `hooks/useTypewriter.js` reveals them one character at a time with a blinking caret |
| History sidebar | `Sidebar.jsx`, grouped by Today / Yesterday / Previous 7 days / Older. Supports rename and delete. The `?chat=<id>` URL reopens a chat after refresh |
| OpenAI / Claude integration | `services/aiProvider.js`: one `streamCompletion()` for both providers |
| MongoDB persistence | `models/Conversation.js`: every exchange stores `userPrompt`, `aiResponse`, `timestamp`, `tone`, `model`, `status` |
| **Tone Toggle** | `ToneToggle.jsx` sends `tone` with every request. `services/tones.js` turns it into the **system instruction** for the OpenAI `system` message or the Claude `system` param |

### ⭐ Extra feature 1: Stop and Regenerate
- **Stop** (■) cancels generation right away. The backend aborts the AI request so you stop paying for tokens, and saves the partial reply marked `stopped`.
- **↻ Regenerate** replaces the last answer. It uses the **currently selected tone**, so you can switch Professional → Concise and regenerate to restyle the same answer immediately.

### ⭐ Extra feature 2: Search and Export
- **Search all chats**: the sidebar search box searches titles, prompts **and AI responses** in MongoDB (debounced).
- **Export**: download any conversation as **Markdown** or **JSON** (header → ⬇ Export).

---

## 🌐 REST API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/chat` | `{conversationId?, message, tone}` → SSE stream (`meta`, `delta`, `error`, `done`) |
| POST | `/api/chat/regenerate` | `{conversationId, tone}` → SSE stream |
| GET | `/api/conversations?q=` | List or search conversations |
| GET | `/api/conversations/:id` | Full conversation |
| PATCH | `/api/conversations/:id` | Rename `{title}` |
| DELETE | `/api/conversations/:id` | Delete |
| GET | `/api/conversations/:id/export?format=md\|json` | Download |
| GET | `/api/health` | Provider, model, DB status |

## 📁 Structure

```
ai-chat-assistant/
├── backend/
│   ├── .env.example            🔑 API keys / provider / Mongo URI
│   └── src/
│       ├── server.js
│       ├── config/index.js     🔑 reads keys from .env
│       ├── config/db.js
│       ├── models/Conversation.js
│       ├── routes/chat.js      SSE streaming + persistence
│       ├── routes/conversations.js
│       └── services/
│           ├── aiProvider.js   🔌 OpenAI + Claude + mock
│           └── tones.js        🎛️ tone → system instruction
└── frontend/
    ├── vite.config.js          /api proxy → :5000
    └── src/
        ├── App.jsx             state management
        ├── api.js              REST + SSE client
        ├── hooks/useTypewriter.js
        └── components/         Sidebar, ChatHeader, ToneToggle, MessageList, MessageBubble, Composer
```
