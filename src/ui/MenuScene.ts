import { Container, Graphics, Text } from 'pixi.js'
import type { Scene } from '../engine/Scene'
import { SceneManager } from '../engine/SceneManager'
import { PlayScene } from './PlayScene'
import { SettingsScene } from './SettingsScene'
import { songs } from '../data/songs'
import { loadScores } from '../utils/storage'

export class MenuScene implements Scene {
  private stage = new Container()
  app!: any
  change!: (s: Scene) => void

  async init() {
    const { app } = this
    app.stage.addChild(this.stage)

    const title = new Text({ text: 'DJ Rhythm Pop', style: { fill: 0xffffff, fontSize: 36 } })
    title.x = 24; title.y = 24
    this.stage.addChild(title)

    // Simple song buttons with best scores
    let y = 100
    const scores = loadScores()
    songs.forEach((song, idx) => {
      const g = new Graphics().roundRect(24, y, 360, 56, 10).fill(0x26263a)
      const t = new Text({ text: `${idx+1}. ${song.title} (BPM ${song.bpm})`, style: { fill: 0xffffff, fontSize: 18 } })
      t.x = 36; t.y = y + 16
      g.eventMode = 'static'
      g.cursor = 'pointer'
      g.on('pointertap', () => {
        this.change(new PlayScene(song.id))
      })
      this.stage.addChild(g, t)

      const best = scores[song.id]
      if (best) {
        const sub = new Text({ text: `BEST ${best.bestScore}  ${best.grade}${best.fc?'  [FC]':''}` , style: { fill: 0xb0b0ff, fontSize: 12 } })
        sub.x = 36; sub.y = y + 40
        this.stage.addChild(sub)
      }
      y += 72
    })

    const settingsBtn = new Graphics().roundRect(24, y + 8, 180, 44, 10).fill(0x44445a)
    const settingsText = new Text({ text: '設定', style: { fill: 0xffffff, fontSize: 16 } })
    settingsText.x = 24 + 16; settingsText.y = y + 8 + 12
    settingsBtn.eventMode = 'static'; settingsBtn.cursor = 'pointer'
    settingsBtn.on('pointertap', () => this.change(new SettingsScene()))
    this.stage.addChild(settingsBtn, settingsText)
  }

  update() {}

  dispose(): void {
    this.stage.removeFromParent()
    this.stage.destroy({ children: true })
  }
}
