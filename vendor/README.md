# vendor/

Pinned third-party runtime, served same-origin so the site has no CDN
dependency at runtime (and so a CDN compromise or outage cannot blank the
page). Do not edit these files.

| File | Source (immutable pinned URL) |
|---|---|
| preact-10.29.7.min.umd.js | https://unpkg.com/preact@10.29.7/dist/preact.min.umd.js |
| preact-hooks-10.29.7.umd.js | https://unpkg.com/preact@10.29.7/hooks/dist/hooks.umd.js |
| preact-compat-10.29.7.umd.js | https://unpkg.com/preact@10.29.7/compat/dist/compat.umd.js |
| preact-compat-shim-10.29.7.js | first-party glue, written here (see file header) |

Preact replaced React 18 in #91 (same API surface via preact/compat; the
game's precompiled `React.createElement` calls and hooks run unchanged).
The four files must load in table order: core defines the `preact` global,
hooks/compat chain off it, and the shim exposes `preactCompat` as
`window.React`/`window.ReactDOM` (adding `createRoot`/`hydrateRoot`, mirrored
verbatim from `preact/compat/client.js` at the same version, since the UMD
build omits them). The shim is versioned like the pinned files because
`_headers` caches all of `/vendor/*` as immutable — never edit it in place;
copy to a new filename.

To upgrade: download the new pinned URLs into new versioned filenames,
verify the bytes (`openssl dgst -sha384 -binary <file> | openssl base64 -A`
against a second fetch), re-check that `compat/client.js` upstream still
matches the shim's createRoot/hydrateRoot, copy the shim to the new version
suffix, update the four HTML entry points, then delete the old files.
Preact is MIT-licensed (license in the npm package; the minified files carry
no header).
