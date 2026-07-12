# Contributing

Thanks for helping build the Green Radius Game! It's a small, no-build static app,
so getting started is quick.

New here? **[`docs/architecture.md`](docs/architecture.md)** is the end-to-end map —
the data flow, the integration contracts, and the gotchas worth knowing before you
touch the wiring.

## Heads up: `main` is the live site

`wachen/green-radius-game` is the canonical repo, and **merging to `main`
auto-deploys to https://greenradi.us** via Cloudflare — there's no staging step. So:

- `main` is branch-protected — you can't push to it directly; open a pull request.
- Approvals aren't required, so you *can* self-merge — but it ships to production the
  moment you do. Review the PR (and check the deploy) before merging.
- Never force-push or delete `main`.

New contributors join as **collaborators** on this repo (rather than forking), since
it's the one wired to the live domain.

## Project layout

No build step — the browser compiles the JSX in place via `@babel/standalone`.

| Path               | Role                                                                 |
|--------------------|----------------------------------------------------------------------|
| `index.html`       | Entry point; mounts `<GreenRadiusGame/>`                             |
| `green-radius.jsx` | Main game component (`GreenRadiusGame`) — game state/phases, intro, done/email screen, Green-Up Plan; loads **last** |
| `src/`             | The rest of the game UI, one shared Babel scope split by area: `core.jsx` (hooks, constants, persistence, scoring — loads **first**), `fx.jsx`, `badge.jsx`, `wheel.jsx`, `question-flow.jsx`, `share-card.jsx`, `home.jsx`, `form-mode.jsx` |
| `game-data.js`     | `window.SECTORS` — sector / tier / question content (BLAST framework) |
| `result-state.js`  | `window.ResultState` — encode/decode a result to/from the `?r=` share payload (legacy `#hash` fallback) |
| `rank.js`          | `window.Rank` — isomorphic module mapping a 0–60 total to a playa-rank title ("First Spark"…"Green Supernova"); also imported by the Worker for the OG description |
| `result/`          | Stateless shareable result page (renders a card from the `?r=` payload, legacy `#hash` fallback) |
| `admin/`           | Internal, Cloudflare Access–gated response viewer (City + Camps tabs); read-only |
| `city/`            | Public community-progress page (`/city/`), rendered from `GET /api/city` |
| `worker/index.js`  | Cloudflare Worker — `POST /api/complete` + `GET /api/admin/responses` + `GET /api/health` + `GET /api/city` (public aggregate tally) + `GET /result/?r=` (per-camp OG unfurl); all else served as static assets |
| `wrangler.jsonc`   | Worker + static-assets config                                         |
| `_headers`         | Static-asset response headers (HSTS, framing, permissions)            |
| `vendor/`          | Pinned React/ReactDOM/Babel runtime, served same-origin (see its README) |
| `og-card.png`      | Static Open Graph share-card image                                    |
| `downloads/`       | Printable board-game + how-to-play PDFs                               |

### One JSX gotcha worth knowing

`@babel/standalone` runs every `<script type="text/babel">` in a **shared scope**, so
components defined in the game scripts (`src/*.jsx`, `green-radius.jsx`) — e.g. `ShareCard`
in `src/share-card.jsx` — are referenced by **bare name** from other pages like `result/index.html` — they are *not* `window` properties.
Only the plain scripts attach to `window` as their API (`window.SECTORS`, `window.ResultState`, `window.Rank`); `green-radius.jsx`'s trailing `Object.assign(window, …)` also mirrors a few component names, but only on pages that load it and nothing relies on that.
Referencing a component as `window.Something` silently renders nothing on the pages that matter.

## Run it locally

For the game UI, any static server works:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

(`file://` won't work — browsers block cross-origin `<script src>` reads.)

To also exercise the `/api/complete` endpoint (Google Sheet append + result email),
run the Worker with Wrangler (requires Node.js):

```bash
npx wrangler dev
```

If `wrangler dev` reload-loops from the repo root, run it with
`npx wrangler dev --persist-to <dir outside the repo>` — its default
`.wrangler/state` (Cache API state, used by `/api/city`) lands inside the
watched assets directory and can truncate in-flight asset fetches.

That endpoint needs three secrets — `SHEETS_WEBAPP_URL`, `SHEETS_SHARED_SECRET`,
`RESEND_API_KEY`. In production they're **Cloudflare Worker secrets**; for local dev,
copy `.dev.vars.example` to `.dev.vars` and fill them in (`.dev.vars` is git-ignored).
Without them the Worker degrades gracefully — the endpoint just returns `err` and the
static site still serves — so you don't need them to work on the UI.

## Making a change

1. Branch off `main`: `git switch -c my-change main`
2. Keep each PR focused on one logical change, with a clear title.
3. If you changed the **wiring** (data flow, the `/api/complete` contract, an
   external integration, or a gotcha), update
   [`docs/architecture.md`](docs/architecture.md) to match.
4. Bump `APP_VERSION` in `src/core.jsx` (the deploy stamp on the home
   screen) to the PR number, e.g. `v48`.
5. Push and open a PR against `main`; PRs are squash-merged, and merging
   ships instantly (remember: **merge = deploy**).

Happy hacking. 🌱
