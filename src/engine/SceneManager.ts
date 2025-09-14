import type { Application } from 'pixi.js'
import type { Scene } from './Scene'

export class SceneManager {
  private app: Application
  private current: Scene | null = null
  private lastTime = 0

  constructor(app: Application) {
    this.app = app
    this.tick = this.tick.bind(this)
    this.app.ticker.add(this.tick)
  }

  change(scene: Scene) {
    this.current?.dispose()
    this.current = scene
    // Provide context via duck typing
    ;(scene as any).app = this.app
    ;(scene as any).change = (s: Scene) => this.change(s)
    Promise.resolve(scene.init())
  }

  private tick() {
    const now = performance.now()
    const dt = this.lastTime ? (now - this.lastTime) / 1000 : 0
    this.lastTime = now
    this.current?.update(dt)
  }
}

