# Incident AI — Frontend

> An incident-response agent **with a memory**. Paste a production log, and the agent recalls similar past
> outages, the root cause, and the runbook that fixed them — with a visible confidence score that rises when
> memory is used.

This repository is the **frontend** (React + TypeScript SPA). It talks to a separate FastAPI agent service
(deployed on Render) that stores incidents in a "Hindsight" memory and generates suggestions with an LLM.

## What a judge can see in 60 seconds

1. Open `/` — landing page explaining the idea.
2. Click **Open console → Simulated triage** and fire any preset outage (e.g. *Postgres connection pool exhaustion*).
3. The log is sent to the agent. Watch three things:
   - **Recommended resolutions** with a confidence % per suggestion
   - **Memory rail** on the right — the past incidents the agent recalled
   - **Confidence meter** — confidence *with* memory vs. an estimated baseline *without* it
4. Rate the answer 👍 / 👎 — the verdict is stored back into memory (visible in **Incident memory**).

> The backend runs on a free tier: the first request after idle can take 30–50 s. The UI shows a
> "Waking up the agent service…" state instead of failing.

## The three console views

| View | Purpose | Code |
|---|---|---|
| **Live chat** | Paste logs / describe an incident, read the agent's answer, rate it | `src/features/console/chat/` |
| **Incident memory** | Search & filter the stored archive the agent recalls from; open a record's detail drawer | `src/features/console/memory/` |
| **Simulated triage** | One-click realistic outages for a guided demo | `src/features/console/triage/` |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173  (proxies /api to the deployed agent)
npm run build      # typecheck + production build → dist/
npm run lint
```

No environment variables are required. Optional: `VITE_BACKEND_URL` (see `.env.example`).

## Project structure

```
├── api/
│   └── [...path].ts          Vercel serverless relay → agent API (adds CORS, forwards path verbatim)
├── docs/
│   ├── ARCHITECTURE.md       Layers, data flow, key decisions
│   └── API_CONTRACT.md       Endpoints the frontend consumes
├── public/                   Favicon, logo, web manifest
└── src/
    ├── main.tsx              Entry point
    ├── app/                  App shell: routes, error boundary
    ├── pages/                Route components (thin): Landing, Console, NotFound
    ├── features/
    │   ├── landing/          Marketing page → sections/ (Navbar, Hero, HowItWorks, …)
    │   └── console/          The product
    │       ├── ConsoleProvider.tsx   ← all console state (chat, archive, feedback)
    │       ├── ConsoleShell.tsx      ← sidebar / nav / view switching
    │       ├── chat/  memory/  triage/
    ├── services/agent/       All network code: config, http (retry/timeout), errors, normalize, client
    ├── domain/incident.ts    Shared TypeScript types + severity styles
    ├── data/                 Sample incident archive + simulated-outage presets
    ├── components/           Shared UI: BrandMark, SeverityBadge, ui/ (shadcn primitives)
    └── lib/utils.ts          `cn()` class helper
```

**Reading order for a reviewer:** `domain/incident.ts` → `services/agent/client.ts` →
`features/console/ConsoleProvider.tsx` → `features/console/chat/ChatView.tsx`.

## Tech stack

React 19 · TypeScript (strict) · Vite 7 · Tailwind CSS v4 · shadcn/ui (Radix) · Framer Motion · React Router 7 · Sonner (toasts)

## Design decisions worth noting

- **Feature-based layout** — each console view owns its folder; shared code is lifted to `components/`, `domain/`, `services/`.
- **Single network boundary** — components never call `fetch`; everything goes through `services/agent`, which
  normalizes raw API payloads into typed domain objects.
- **Resilient transport** — three routes tried in order (same-origin `/api` → public relay → direct), per-call
  timeouts sized for cold starts, and every failure becomes an `ApiError` with a retry action in the UI.
- **Stateless backend, stateful UI** — the API keeps no session, so the frontend resends the analysed incident with feedback.
- **Route-level code splitting** — the landing page doesn't download console code.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for details.
