# Green Radius Game — Day One Launch Runbook

**Scope:** the public announcement of https://greenradi.us to ~1500 Burning Man theme camps via newsletters/social. Expected: low thousands of visitors over weeks, bursts of 100–300 players/hour after a newsletter drops.

**Prime directives:** zero embarrassments, zero data loss, never fly blind. The site can never be taken offline (HSTS preload). Every fix is a *forward or revert deploy*, never a teardown.

---

## 0. Key facts

| Thing | Where | Notes |
|---|---|---|
| Production | https://greenradi.us | Worker `green-radius-game`; repo root served as static assets |
| Deploy | merge PR to `main` | Usually live in ~1 min. No staging. Squash merges. Never force-push `main`. If not live in 10 min → P8. |
| Rollback | `git revert <squash-sha>` → PR → merge | Also instant. The ONLY rollback path. |
| Worker logs | CF dash → Workers & Pages → green-radius-game → Logs | `observability.enabled = true` |
| Traffic/errors | CF zone Analytics; Workers metrics for /api/* + /result/ | Statics absorbed by Cloudflare; /api/* and /result/ hit the Worker |
| Abuse | Security → Events (rate limit: 10 req/10s/IP on /api/*, **Block** — Managed Challenge isn't offered on the Free plan) | Deployed + curl-verified 2026-07-02 (11th rapid request → 429; ~10s cooldown) |
| Worker liveness | External uptime monitor → `GET /api/health` expecting 200 | Cloudflare Free has no Worker-error alerting; the monitor's phone push substitutes. Non-200 = Worker routing/execution broken |
| Player data | Google Sheet via Apps Script; Apps Script Executions page | "Answers JSON" / "Schema Version" columns |
| Email | Resend dashboard (sends, bounces, quota) | One email per completion. **Kill switch:** deleting the `RESEND_API_KEY` Worker secret makes the email leg return false gracefully (done screen already handles it); restore by re-adding the secret. |
| Admin viewer | /admin (Cloudflare Access) | City + Camps tabs |
| Routing reality | Static assets are served BEFORE the Worker EXCEPT `/result/`, pinned to the Worker via `run_worker_first: ["/result/"]` (per-camp OG rewrite) | A throwing Worker breaks `/api/*` and degrades `/result/`'s OG unfurl (fail-open → the generic static result page still serves); the game and vendor files keep serving. A syntactically invalid Worker upload is rejected at deploy time; the old version keeps running. |
| Source of truth for a result | the result-link payload (`?r=`, schema v2; legacy `#hash` fallback) | Sheet + email are best-effort; a lost row is reconstructable from any result link |

---

## 1. Go / no-go gates (before scheduling the announcement)

- [ ] LAUNCH PR merged + verified: `/docs/runbook-day-one.md` → 404, `/wrangler.jsonc` → 404, `/worker/index.js` → 404, `/CLAUDE.md` → 404; favicon shows in the browser tab on `/`, `/result/`, and `/admin` (inline SVG, no `.ico` file); vendor files show `Cache-Control: ...max-age=31536000, immutable`; storage/no-sharing sentence visible near the email field.
- [ ] WAF rate-limit rule on `/api/*` confirmed **deployed and active** (not draft). (First verified 2026-07-02: 14 rapid POSTs → 403s through #10, 429s from #11, released after ~10s.)
- [ ] Resend: plan quota ≥ 500/day for launch week (free tier = 100/day + 3,000/mo; Pro $20/mo = 50k/mo, no daily cap). Domain shows verified; **set a usage/volume alert**. DKIM + custom MAIL FROM DNS verified present 2026-06-11 (resend._domainkey TXT; send.greenradi.us SPF/MX); DMARC p=none exists.
- [ ] Test email landed in a Gmail **inbox**, not spam.
- [ ] Google Sheet backup copy made; sharing restricted; Apps Script deployment is the current /exec URL.
- [ ] Uptime monitor on `https://greenradi.us/api/health` (expect 200, 5-min interval) confirmed alerting your phone. (Cloudflare Free offers no Worker-error notifications — this external probe is the substitute.)
- [ ] Cloudflare Access allowlist for /admin matches the intended admin list (as of 2026-07-02: Wes, Marc, Christopher Breedlove, Tim Barry — remove anyone unexpected).
- [ ] T-1 drill (section 2) completed without surprises.

Any box unchecked → do not announce. Each is a same-day fix.

## 2. T-1 preflight drill (the day before, on a real phone over cellular)

1. Load https://greenradi.us cold: placeholder within ~1 s, game within a few seconds.
2. Play a full game as camp **"TEST ignore"** with your own email. Submit.
3. Done screen shows the success copy (not the sheet-failed / email-failed variants), plus the two #39 done-screen elements: the rank headline ("Your camp is a &lt;rank&gt; · &lt;total&gt;/60" — a blank headline means `rank.js` / `window.Rank` didn't load) and, since your test game included at least one "No," the collapsible "🌱 Your Green-Up Plan · N ideas" panel built from those No answers.
4. **Download the PNG card on the iPhone, then tap "🔗 Share link"** — the two real-device WebKit tests. Download exercises the SVG-to-canvas PNG export; "Share link" fires the #39 Web Share L2 path, so the native share sheet must open with the card PNG *attached* (`navigator.share({files})`), not just a URL. Neither was ever machine-verified in WebKit; this step is the net. (If the sheet shows only a link, the in-gesture pre-raster failed — it degrades to share-URL then clipboard, but investigate before launch.)
5. Email arrives in inbox ≤ ~2 min; open the emailed /result/ link; card renders.
6. Paste a result link into iMessage/Slack: the OG unfurl **title** reads **"TEST ignore's Green Radius"** and the **description** reads **"A &lt;rank&gt; at &lt;total&gt;/60…"** — not just that a card image appears. The image is intentionally static (`og-card.png`), so a generic unfurl that still shows the card means the Worker's `og:title`/`og:description` rewrite (or `run_worker_first: ["/result/"]`) is dead.
7. Security → Events: your single submission was NOT rate-limited (no Block event for your IP).
8. /admin: Access login, TEST row visible in Camps. Then delete/mark the row in the Sheet.

Any failure = hard stop; diagnose tonight, not on announce morning.

## 3. Announce-morning smoke test (~10 min, before the newsletter)

```sh
# Expect 200 / 200 / 200 / 200 / 404 / 404 / 302
curl -so /dev/null -w '%{http_code}\n' https://greenradi.us/
curl -so /dev/null -w '%{http_code}\n' https://greenradi.us/game-data.js
curl -so /dev/null -w '%{http_code}\n' https://greenradi.us/result/
curl -so /dev/null -w '%{http_code}\n' https://greenradi.us/api/health
curl -so /dev/null -w '%{http_code}\n' https://greenradi.us/.git/config
curl -so /dev/null -w '%{http_code}\n' https://greenradi.us/wrangler.jsonc
curl -so /dev/null -w '%{http_code}\n' https://greenradi.us/admin
```

One real phone load + a wheel spin (no submission). Glance at Worker logs (no overnight error spike), Resend (quota headroom), Sheet (note the row count — your baseline). Green → send it.

## 4. Monitoring cadence

First hour: every ~15 min. Rest of day: hourly. Order: (0) uptime monitor still green, (1) zone Analytics request curve + error share, (2) Workers exceptions ≈ 0, (3) Sheet rows vs baseline, (4) Resend sends ≈ new rows + low bounces, (5) Security Events: rate-limit blocks rare, (6) /admin spot-check new rows look sane.

**Healthy:** rows ≈ emails ≈ completions; exceptions ~0; no sustained 5xx; rate-limit blocks only on outliers.

## 5. Thresholds → playbooks

| Signal | Threshold | Playbook |
|---|---|---|
| Site 5xx / blank for everyone | any reproducible | P1 |
| Worker exceptions | sustained stream | P2 |
| Sheet rows flat vs traffic | 30+ min divergence | P3 |
| Resend flat or quota gone | any | P4 |
| Players report blocked submits | 2+ independent | P5 |
| Admin viewer erroring | any | P6 |
| Rows growing 3x faster than plausible | any | P7 |
| Merged PR not live | 10+ min | P8 |

## 6. Incident playbooks

**P1 — Site down/blank for everyone.** Statics are served before the Worker, so a Worker bug alone can NOT blank the whole site. Reproduce (curl + phone). Whole-site failure → suspect Cloudflare platform (cloudflarestatus.com) or a bad change to the HTML/assets themselves: if a recent merge correlates, `git revert <squash-sha>` → PR → merge → re-run smoke curls. Never disable the Worker or delete the route (HSTS preload = no fallback).

**P2 — /api/complete erroring (players see try-again).** Players are safe: the result lives in their result link (`/result/?r=<payload>`); nothing is silently lost. Worker logs: which leg fails — Apps Script fetch or Resend? → P3 / P4. Both → check Worker secrets weren't disturbed (Settings → Variables).

**P3 — Sheet rows not appearing.** Apps Script Executions page: failures/quota on doPost? If the deployment was redeployed it minted a NEW /exec URL → update the `SHEETS_WEBAPP_URL` secret. Mitigation: none needed player-side; rows are backfillable later from result links (note the gap window).

**P4 — Emails not sending.** Resend dash: quota exhausted / key revoked / verification dropped / bounce spike? Quota → upgrade in place (immediate, no deploy). Abuse-driven sends → **kill switch**: delete the `RESEND_API_KEY` Worker secret (graceful degrade by design), tighten the WAF rule, re-add the key when clear. Players still get download + share link meanwhile.

**P5 — WAF rate-limiting real players.** The rule's action is Block (Free plan): an over-limit IP gets 429 on /api/* for ~10s, and the game's fetch() POST shows the try-again screen — nothing is lost, retry works after the window. Security → Events: are legit single submissions being blocked (shared-IP camps, CGNAT)? Mitigate by RAISING the threshold (e.g. 20 req/10s) or temporarily disabling the rule — Log and Managed Challenge actions aren't available on Free. Re-tighten after the burst.

**P6 — Admin viewer down.** Not player-facing; don't deploy hastily. Read the Sheet directly. Debug later (Access JWT vars vs Apps Script doGet).

**P7 — Junk/flood rows.** Tighten the WAF rule; consider the P4 kill switch if each junk row is also sending mail. Quarantine rows to a second tab (don't delete); aggregates already exclude malformed rows. Append-only junk, not corruption.

**P8 — Merged to main but not live.** Happened 2026-07-02: Cloudflare's build queue backed up and the default-branch build sat "queued" for ~23 min before completing normally. Check dash → Workers & Pages → green-radius-game → **Builds**: a queued "Deploy default branch" build means queue backlog, not a code problem (a failed build shows logs instead). Options, in order: (1) wait or Retry the build from the dashboard; (2) stopgap: promote the PR branch's preview version to 100% (Deployments → the version built from the branch → Promote) — safe because a squash-merged PR's tree is identical to its branch tip; the eventual main build then supersedes it with the same content. Note the non-main branch builds run `wrangler versions upload --alias <branch>` (preview only, no deploy) **by design**; only the default-branch build deploys.

## 7. Rollback (the only one)

```sh
git checkout main && git pull
git revert <offending-squash-commit-sha>   # squash commits are plain commits; no -m needed
git push origin HEAD:revert-<sha>          # branch protection requires a PR
# open PR → merge → instant deploy → re-run section 3 smoke curls
```
(If a TRUE merge commit ever lands, revert needs `-m 1`.) Never: force-push, delete `main`, disable the Worker, or edit files in the dashboard.

## 8. End of Day One

- [ ] Final Sheet row count vs baseline (= completions captured).
- [ ] Resend: sends, bounces, spam complaints.
- [ ] Security Events anomalies worth a permanent rule tweak?
- [ ] Worker exception patterns for the next PR?
- [ ] End-of-day Sheet backup copy.
- [ ] Write down the three roughest moments — that's the next priority list.

**Escalation:** solo-operable by design. Marc (repo write access) can review/merge a revert PR if you're unreachable. If Cloudflare/Resend/Google are down, the static game + result links keep working — that resilience is deliberate; protect it in every change.
