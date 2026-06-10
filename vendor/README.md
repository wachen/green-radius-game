# vendor/

Pinned third-party runtime, served same-origin so the site has no CDN
dependency at runtime (and so a CDN compromise or outage cannot blank the
page). Do not edit these files.

| File | Source (immutable pinned URL) |
|---|---|
| react-18.3.1.production.min.js | https://unpkg.com/react@18.3.1/umd/react.production.min.js |
| react-dom-18.3.1.production.min.js | https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js |
| babel-standalone-7.29.0.min.js | https://unpkg.com/@babel/standalone@7.29.0/babel.min.js |

To upgrade: download the new pinned URL into a new versioned filename,
verify the bytes (`openssl dgst -sha384 -binary <file> | openssl base64 -A`
against a second fetch), update the three HTML entry points, then delete the
old file. React and Babel are MIT-licensed; license headers ship inside the
minified files.
