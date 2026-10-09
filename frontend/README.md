# Knowledge AI Frontend

Polished React + Vite + Tailwind frontend for the Knowledge AI RAG project.

## Run
```powershell
cd frontend
npm install
npm run dev
```

The current frontend uses a local mock response. The next integration step is replacing `mockGenerate()` in `src/hooks/useChat.js` with the FastAPI `/chat` endpoint.

Features include responsive sidebar, chat search, rename/delete, local persistence, theme toggle, model selector, Markdown/code rendering, copy/regenerate/feedback actions, file picker UI, browser voice input, streaming mock responses, settings modal, and keyboard shortcuts.
