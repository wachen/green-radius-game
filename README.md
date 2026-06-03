# Green Radius Game

A self-ranking sustainability game for Burning Man theme camps. Each spin of the
wheel plays one of six sectors — Water, Waste, Power, Transport, Food, Shelter —
answering its ten Yes/No questions across four progressively harder tiers; your
run of consecutive greens sets that sector's radius. Six spins, one per sector,
complete your camp's unique Green Radius.

Live at **https://greenradi.us**.

The mechanics and copy come from the Green Theme Camp Community's BLAST framework;
this implementation began from a Claude Design handoff bundle.

## Stack

- Static HTML + React 18 (loaded via UMD CDN), with in-browser JSX via `@babel/standalone`
- **No build step** — the browser compiles the JSX
- A small **Cloudflare Worker** (`worker/index.js`) backs one endpoint,
  `POST /api/complete` — it saves a result row to a Google Sheet and emails the camp a
  shareable link. Everything else is served as static assets.
- Deployed on **Cloudflare Workers + Static Assets**

## Layout

| Path               | Role                                                            |
|--------------------|-----------------------------------------------------------------|
| `index.html`       | Entry point; mounts `<GreenRadiusGame/>`                        |
| `green-radius.jsx` | Game UI — wheel, question modal, form mode, result card, email capture, home FAQ modal |
| `game-data.js`     | `window.SECTORS` — sector / tier / question content             |
| `result-state.js`  | `window.ResultState` — encode/decode a result into the URL hash |
| `result/`          | Stateless shareable result page                                 |
| `worker/`          | Cloudflare Worker (`/api/complete`)                             |
| `downloads/`       | Printable board-game + how-to-play PDFs                          |

## Run locally

Any static server works for the UI:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

(`file://` won't work — browsers block cross-origin `<script src>` reads.) To run the
Worker/API locally too, use `npx wrangler dev`. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the full dev + contribution flow.

## Deploy

Hosted on Cloudflare Workers + Static Assets. **Merging to `main` auto-deploys to
https://greenradi.us** — there is no separate staging environment, and `main` is
branch-protected, so changes land via pull request.

Manual deploy, if ever needed (requires Node.js):

```bash
npx wrangler deploy
```

The Worker's secrets (`SHEETS_WEBAPP_URL`, `SHEETS_SHARED_SECRET`, `RESEND_API_KEY`)
are stored in Cloudflare and never committed.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). New contributors join as collaborators on this
repo (it's the canonical one) and open PRs against `main`.

## License

MIT — see `LICENSE`.
