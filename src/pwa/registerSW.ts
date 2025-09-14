export function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const base = (import.meta as any).env.BASE_URL || '/'
      const url = base.replace(/\/$/, '') + '/sw.js'
      navigator.serviceWorker.register(url, { scope: base }).catch(() => {})
    })
  }
}
