# Boss AI (lenny-ai) — Lenny's own AI app. Free models fused into one.

Display name: **Boss AI**. Repo/service stay `lenny-ai` until Lenny decides on a rename.

## What it does

- **Chat** — free-fusion fallback chain: Gemini → Groq (gpt-oss-120b, then Qwen3-32b) → OpenRouter free Nemotron 3 Ultra (then 3.5 Super VL). If one provider is down, the next answers. Never a dead end.
- **Images** — Cloudflare Workers AI FLUX (free tier).
- **Research** — Tavily live search + Gemini summary with sources.
- **Avatar studio** — build and save your own Boss avatar (see `frontend/src/lib/avatar.tsx`).
- **First launch** — avatar ask, Google sign-in, one-tap bring-your-own free key.

## Keys (Render env vars only — never in this repo)

`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `CLOUDFLARE_API_TOKEN`, `TAVILY_API_KEY`.
Optional: `LENNY_EMAIL` (default `lburaczewski0325@gmail.com`), `GOOGLE_CLIENT_ID` (default: Lenny's existing public Google OAuth client id).

## Who uses whose keys

- **Lenny** (verified by Google token against `LENNY_EMAIL`): the server keys.
- **Everyone else**: their OWN free key, stored on their device only, calling the providers straight from the app. No anonymous use of Lenny's keys.

## Endpoints

- `GET /` and `GET /health` → `{"service": "lenny-ai", "status": "ok"}`
- `GET /api/status` → which providers are configured (booleans only, no key values)
- `GET /api/config` → the public Google client id for sign-in
- `POST /api/chat` `{messages, id_token?, access_token?}` → `{provider, model, reply, fallback, tried}` (Lenny only)
- `POST /api/image` `{prompt, id_token?, access_token?}` → `{model, image}` data URL (Lenny only)
- `POST /api/research` `{query, id_token?, access_token?}` → `{answer, sources, live, provider}` (Lenny only)

## Frontend

`frontend/` — React + TypeScript + Vite PWA. Deployed to Vercel as project `boss-ai`. Build locally with `npm install && npm run build`.
