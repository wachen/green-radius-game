// First-party glue, NOT from npm (the exception in this folder — versioned
// like the pinned files because /vendor/* is cached immutable; changing it
// means a new filename). Loads after the three Preact UMDs and exposes their
// preactCompat global under the React/ReactDOM names the precompiled game
// scripts expect. createRoot/hydrateRoot mirror preact/compat/client.js from
// the same pinned version verbatim (the UMD build doesn't include them).
(function () {
  var compat = self.preactCompat;
  function createRoot(container) {
    return {
      render: function (children) { compat.render(children, container); },
      unmount: function () { compat.unmountComponentAtNode(container); }
    };
  }
  compat.createRoot = createRoot;
  compat.hydrateRoot = function (container, children) {
    compat.hydrate(children, container);
    return createRoot(container);
  };
  self.React = compat;
  self.ReactDOM = compat;
})();
