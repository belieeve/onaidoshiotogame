import { App } from './engine/App'
import { registerSW } from './pwa/registerSW'

const root = document.getElementById('app') as HTMLElement
const app = new App(root)
app.start()

registerSW()

// Lock landscape hint (cannot force, but show guidance)
screen.orientation?.lock?.('landscape').catch(() => {})

