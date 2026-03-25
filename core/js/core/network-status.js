export function bindNetworkStatus(element, onlineText, offlineText) {
  if (!element) return () => {};
  const render = () => {
    element.textContent = navigator.onLine ? onlineText : offlineText;
  };
  render();
  window.addEventListener('online', render);
  window.addEventListener('offline', render);
  return render;
}

export function registerAppServiceWorker(path = '../service-worker.js', label = 'app') {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(path)
      .then(() => console.log(`✅ SW registrado (${label})`))
      .catch((e) => console.warn(`❌ SW error (${label}):`, e));
  });
}
