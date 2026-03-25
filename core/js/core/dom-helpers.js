export function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

export function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

export function countMatches(selector, scope = document) {
  try {
    return qsa(selector, scope).length;
  } catch {
    return 0;
  }
}

export function textOf(selector, fallback = '', scope = document) {
  const el = qs(selector, scope);
  return el?.textContent?.trim() || fallback;
}

export function hasAnySelector(selectors = [], scope = document) {
  return selectors.some((selector) => countMatches(selector, scope) > 0);
}
