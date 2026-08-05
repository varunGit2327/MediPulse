window.MP = window.MP || {};

/**
 * EventBus — decouples modules. dashboard.js, analytics.js, achievements.js etc.
 * never call each other directly; they emit/listen for events instead.
 */
MP.EventBus = (function () {
  const handlers = {};

  function on(event, fn) {
    handlers[event] = handlers[event] || [];
    handlers[event].push(fn);
  }

  function emit(event, payload) {
    (handlers[event] || []).forEach(function (fn) { fn(payload); });
  }

  return { on: on, emit: emit };
})();
