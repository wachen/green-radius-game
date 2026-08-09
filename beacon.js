// Client-side telemetry beacons (error reporting + window.sendEvent, both
// log-only). Log-only, nothing stored: catches silent white
// screens on odd playa phones and POSTs a tiny report to /api/client-error
// (Workers Logs). Loaded FIRST, without defer, in every page's <head> so the
// handlers are installed before the deferred vendor/dist scripts run. Plain
// script (no JSX, not built by scripts/build.js) — keep it tiny.
(function () {
  var MAX_BEACONS = 3;
  var sent = 0;
  var seenMessages = {};

  function clamp(s, n) {
    s = s == null ? '' : String(s);
    return s.length > n ? s.slice(0, n) : s;
  }

  function report(message, source, line, col) {
    if (sent >= MAX_BEACONS) return;
    message = clamp(message, 500);
    if (seenMessages[message]) return;
    seenMessages[message] = true;
    sent++;

    var payload = {
      message: message,
      source: clamp(source, 300),
      line: line || 0,
      col: col || 0,
      path: clamp(window.location.pathname, 200),
    };
    // APP_VERSION is a core.jsx global; cheap to read if core.js has already
    // run (it loads deferred, right after this script), omitted otherwise.
    if (typeof window.APP_VERSION === 'string' && window.APP_VERSION) payload.version = window.APP_VERSION;

    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon('/api/client-error', new Blob([body], { type: 'application/json' }))) return;
    } catch (e) {}
    try {
      fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
    } catch (e) {}
  }

  // Fire-and-forget funnel analytics, shared by green-radius.jsx and
  // src/boot-result.jsx. Lives here because this script loads first, without
  // defer, on every page, so it is defined before any deferred dist/ script
  // runs. sendBeacon survives the page-unload that a submit or navigation can
  // trigger; the keepalive fetch is a fallback for the rare browser without it.
  // Fully wrapped so a telemetry hiccup can never touch gameplay. Non-PII by
  // contract: event name + coarse props (mode, sector count) only — never camp
  // names, emails, or free text. Sink is the Worker's POST /api/event.
  window.sendEvent = function (event, props) {
    try {
      var body = JSON.stringify(Object.assign({ event: event }, props));
      if (navigator.sendBeacon) navigator.sendBeacon('/api/event', body);
      else fetch('/api/event', { method: 'POST', body: body, keepalive: true }).catch(function () {});
    } catch (e) { /* analytics must never break the page */ }
  };

  window.onerror = function (message, source, lineno, colno) {
    report(message, source, lineno, colno);
  };
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    var message = reason && reason.message ? reason.message : String(reason);
    report('Unhandled rejection: ' + message, '', 0, 0);
  });
})();
