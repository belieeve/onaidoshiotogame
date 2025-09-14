import { Application, Container, Graphics } from 'pixi.js'
import { SceneManager } from './SceneManager'
import { MenuScene } from '../ui/MenuScene'

export class App {
  private pixi: Application
  private scene: SceneManager
  private root: HTMLElement

  constructor(root: HTMLElement) {
    this.root = root
    this.pixi = new Application({
      background: '#0b0b12',
      resizeTo: root,
      antialias: true
    })
    this.scene = new SceneManager(this.pixi)
  }

  async start() {
    try {
      await this.pixi.init({ width: this.root.clientWidth, height: this.root.clientHeight })
      this.root.appendChild(this.pixi.canvas)
      this.installResize()

      // Simple safe-area margins for mobile
      const overlay = new Graphics()
      overlay.eventMode = 'passive'
      this.pixi.stage.addChild(overlay)

      this.scene.change(new MenuScene(this.scene))
    } catch (e) {
      const el = document.createElement('div')
      el.style.cssText = 'color:#fff;font:14px system-ui;padding:16px;'
      el.textContent = '初期化に失敗しました。ブラウザを更新してください。'
      this.root.appendChild(el)
      console.error('App init failed', e)
    }
  }

  private installResize() {
    const onResize = () => {
      const w = this.root.clientWidth
      const h = this.root.clientHeight
      this.pixi.renderer.resize(w, h)
    }
    window.addEventListener('resize', onResize)
  }
}
