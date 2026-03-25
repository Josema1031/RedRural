export function ensureRuntimeRoot() {
  if (!window.__RED_RURAL__) window.__RED_RURAL__ = {};
  if (!window.__RED_RURAL__.runtime) window.__RED_RURAL__.runtime = {};
  return window.__RED_RURAL__.runtime;
}

export function ensureRuntimeScope(scope) {
  const root = ensureRuntimeRoot();
  if (!root[scope]) root[scope] = {};
  return root[scope];
}

export function registerRuntime(scope, key, payload) {
  const bucket = ensureRuntimeScope(scope);
  bucket[key] = payload;
  return bucket[key];
}
