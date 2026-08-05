window.MP = window.MP || {};

/**
 * Store — thin wrapper over localStorage.
 * Global keys (profiles, activeProfileId, settings, schemaVersion) are shared.
 * Everything else is namespaced under the active profile automatically, e.g.
 * Store.get('medicines') internally reads 'medipulse:{profileId}:medicines'.
 */
MP.Store = (function () {
  const subscribers = {};
  const GLOBAL_KEYS = ['profiles', 'activeProfileId', 'settings', 'schemaVersion'];
  const memoryFallback = {};

  // Browsers treat file:// pages as an "opaque origin" and can block localStorage
  // entirely (throws SecurityError). Detect that once, up front, instead of letting
  // every single read/write crash the script that calls it.
  let persistent = true;
  try {
    const testKey = '__medipulse_probe__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
  } catch (e) {
    persistent = false;
    console.warn('MediPulse: localStorage is unavailable in this context (this happens when opening the HTML file directly instead of through a local server, or in some private-browsing modes). Data will still work for this session, but won\'t be saved after you reload. Serve the folder with Live Server / "npx serve" / "python3 -m http.server" for real persistence.');
  }

  function readRaw(k) {
    return persistent ? localStorage.getItem(k) : (Object.prototype.hasOwnProperty.call(memoryFallback, k) ? memoryFallback[k] : null);
  }

  function writeRaw(k, raw) {
    if (persistent) {
      localStorage.setItem(k, raw);
    } else {
      memoryFallback[k] = raw;
    }
  }

  function fullKey(key) {
    if (GLOBAL_KEYS.indexOf(key) !== -1) return 'medipulse:' + key;
    const pid = readRaw('medipulse:activeProfileId');
    const profileId = pid ? JSON.parse(pid) : 'default';
    return 'medipulse:' + profileId + ':' + key;
  }

  function get(key, fallback) {
    const raw = readRaw(fullKey(key));
    if (raw === null) return fallback !== undefined ? fallback : null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return raw;
    }
  }

  function set(key, value) {
    writeRaw(fullKey(key), JSON.stringify(value));
    (subscribers[key] || []).forEach(function (cb) { cb(value); });
    return value;
  }

  function subscribe(key, cb) {
    subscribers[key] = subscribers[key] || [];
    subscribers[key].push(cb);
    return function unsubscribe() {
      subscribers[key] = subscribers[key].filter(function (fn) { return fn !== cb; });
    };
  }

  return { get: get, set: set, subscribe: subscribe, fullKey: fullKey, isPersistent: function () { return persistent; } };
})();
