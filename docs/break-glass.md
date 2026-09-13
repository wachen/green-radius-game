# Break-glass / succession runbook

The Green Radius Game runs on four single-holder external accounts plus
GitHub. If the current owner becomes unavailable, or a co-owner needs to
take over, this is what each account controls, how to add a co-owner to it
now (before you need to), and what actually has to happen to keep
`greenradi.us` up. No secret values live here: see `docs/architecture.md`
for the wiring and CLAUDE.md's Secrets section for the hard rule on secret
values never being written down.

## Account inventory

### Cloudflare (the zone, the Worker, and Access)

Controls: the `greenradi.us` DNS zone; the Worker (`worker/index.js`,
deployed via `wrangler deploy` or the merge-to-`main` auto-deploy) and its
Static Assets binding; the three Worker secrets (`SHEETS_WEBAPP_URL`,
`SHEETS_SHARED_SECRET`, `RESEND_API_KEY`); Cloudflare Access (gates
`/admin` + `/api/admin*`, plus a second Access app gating the Worker's
preview URLs); the scanner-blocking WAF rule; Cloudflare Web Analytics; and
**HSTS preload** on the zone, the one that makes this account irreplaceable
in a hurry (see "Retiring the site" below).

Add a co-owner: Cloudflare dashboard, Manage Account, Members, Invite
Member, with a role that covers Workers, DNS, Zero Trust/Access, and
SSL/TLS on the account that owns the `greenradi.us` zone (Administrator is
the simplest correct choice).

### Resend (result-link email)

Controls: the verified `greenradi.us` sending domain (SPF/DKIM/DMARC) and
the API key used as the Worker's `RESEND_API_KEY` secret. This is what
sends every player their result-link email after `POST /api/complete`.

Add a co-owner: Resend dashboard, Settings, Team, Invite, adding them to
the team that owns the `greenradi.us` domain.

### Google (the yearly Sheets + the bound Apps Script)

Controls: the Google Sheet(s) that are the game's only datastore, one tab
per season (`2026 Results`, a future `2027 Results`, and so on, per the
Season rollover runbook in `docs/admin-setup.md`), and the Apps Script
project container-bound to the master spreadsheet, which holds `doGet`,
`doPost`, the `SHARED_SECRET` script property, and the deployed `/exec` web
app URL used as the Worker's `SHEETS_WEBAPP_URL` secret.

Add a co-owner: Google Drive, share the spreadsheet file with Editor
access. Apps Script is container-bound, so an editor on the spreadsheet can
reach the bound script via Extensions, Apps Script, see its deployments
(Deploy, Manage deployments), and redeploy.

### GitHub (the repo, branch protection, CI)

Controls: `github.com/wachen/green-radius-game`, the canonical repo;
branch protection on `main` (PR required, 0 approvals, no force-push or
deletion); and CI (`.github/workflows/ci.yml`: the compile+diff gate,
`bun test`, and the boot-smoke job).

Add a co-owner: repo, Settings, Collaborators and teams, Add people, with
at least Write access (Admin if they'll ever need to touch branch
protection or repo settings themselves).

### Domain registrar (`greenradi.us`)

Controls: the domain registration itself (renewal), and the nameserver
delegation currently pointed at Cloudflare.

TODO(owner): which registrar `greenradi.us` is registered through, and
whether a second contact or co-owner already exists on that account.

## What a successor needs to do to keep the site up

1. **Rotate the three Worker secrets** (`SHEETS_WEBAPP_URL`,
   `SHEETS_SHARED_SECRET`, `RESEND_API_KEY`) via
   `npx wrangler secret put <NAME>` once you hold the Cloudflare account.
   Do this as soon as you have Cloudflare access, in case the previous
   owner's Google or Resend credentials could otherwise still write through
   the old values.
2. **Redeploy the Apps Script web app** if you rotate `SHARED_SECRET` or
   otherwise change `Code.gs` (Deploy, Manage deployments, edit, New
   version: same `/exec` URL, same secret, per `docs/admin-setup.md`), so
   the Worker and the script stay in agreement.
3. **Update DNS only if the domain itself changes hands or registrars.**
   A secret rotation or a Google/Resend account handoff needs no DNS
   change at all; the zone and the Worker route stay exactly as they are.

## Retiring the site safely (HSTS preload)

`greenradi.us` has HSTS preload active, baked into browsers' own preload
lists, not just a header the site can stop sending. Removal from the list
takes months even after it's requested, so:

- **Never let HTTPS lapse.** The site must keep serving something over
  valid HTTPS indefinitely. Letting the certificate expire or the zone go
  inactive breaks HTTPS for every visitor whose browser already has the
  preload rule, with no fast fix available.
- **Retire by replacing content, never by dropping service.** If the game
  is ever shut down, keep the Cloudflare zone and Worker active and swap in
  a small static "this project has ended" page rather than deleting the
  zone or letting the domain registration lapse.
- **Don't plan around preload removal as an exit ramp.** Request removal if
  you want to, but assume browsers will keep enforcing HTTPS on this domain
  for a long time regardless, and plan the retirement page accordingly.
