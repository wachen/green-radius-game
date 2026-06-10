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
| `green-radius.jsx` | The whole game UI — wheel, question modal, form mode, result card, done/email screen, home FAQ modal |
| `game-data.js`     | `window.SECTORS` — sector / tier / question content (BLAST framework) |
| `result-state.js`  | `window.ResultState` — encode/decode a result into the URL hash       |
| `result/`          | Stateless shareable result page (renders a card from the hash)        |
| `admin/`           | Internal, Cloudflare Access–gated response viewer (City + Camps tabs); read-only |
| `worker/index.js`  | Cloudflare Worker — `POST /api/complete` + `GET /api/admin/responses`; all else served as static assets |
| `wrangler.jsonc`   | Worker + static-assets config                                         |
| `_headers`         | Static-asset response headers (HSTS, framing, permissions)            |
| `vendor/`          | Pinned React/ReactDOM/Babel runtime, served same-origin (see its README) |
| `downloads/`       | Printable board-game + how-to-play PDFs                               |

### One JSX gotcha worth knowing

`@babel/standalone` runs every `<script type="text/babel">` in a **shared scope**, so
components defined in `green-radius.jsx` (e.g. `ShareCard`) are referenced by **bare
name** from other pages like `result/index.html` — they are *not* `window` properties.
Only the plain scripts attach to `window` (`window.SECTORS`, `window.ResultState`).
Referencing a component as `window.Something` silently renders nothing.

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
4. Push and open a PR against `main`; merge when you're happy with it
   (remember: **merge = deploy**).

Happy hacking. 🌱
