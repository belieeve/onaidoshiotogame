import { Container, Graphics, Text } from 'pixi.js'
import type { Scene } from '../engine/Scene'
import { MenuScene } from './MenuScene'
import { PlayScene } from './PlayScene'
import { loadScores, saveScores } from '../utils/storage'

type Result = {
  songId: string
  total: number
  score: number
  maxCombo: number
  counts: { p:number, g:number, m:number }
}

export class ResultScene implements Scene {
  private stage = new Container()
  app!: any
  change!: (s: Scene) => void
  private result: Result

  constructor(result: Result){ this.result = result }

  init(): void {
    const { app } = this
    app.stage.addChild(this.stage)

    const title = new Text({ text: 'リザルト', style: { fill: 0xffffff, fontSize: 32 } })
    title.x = 24; title.y = 24
    this.stage.addChild(title)

    const total = Math.max(1, this.result.total)
    const accuracy = Math.min(100, (this.result.score / (total * 100)) * 100)
    const grade = computeGrade(accuracy)
    const fc = this.result.counts.m === 0

    const { isNewRecord } = this.saveHighScore(this.result.songId, this.result, grade, fc)

    const body = new Text({ text: `Score ${this.result.score}${isNewRecord?'  NEW RECORD':''}\nMAX Combo ${this.result.maxCombo}${fc?'  [FC]':''}\nP:${this.result.counts.p} G:${this.result.counts.g} M:${this.result.counts.m}\nACC ${accuracy.toFixed(2)}%  Grade ${grade}`,
      style: { fill: 0xffffff, fontSize: 20 } })
    body.x = 24; body.y = 80
    this.stage.addChild(body)

    const retry = new Graphics().roundRect(24, 200, 160, 48, 10).fill(0x2b7a2b)
    const retryT = new Text({ text: 'リトライ', style: { fill: 0xffffff, fontSize: 18 } })
    retryT.x = 24 + 30; retryT.y = 200 + 12
    retry.eventMode = 'static'; retry.cursor = 'pointer'
    retry.on('pointertap', () => this.change(new PlayScene(this.result.songId)))

    const back = new Graphics().roundRect(200, 200, 200, 48, 10).fill(0x44445a)
    const label = new Text({ text: '曲選択へ', style: { fill: 0xffffff, fontSize: 18 } })
    label.x = 200 + 20; label.y = 200 + 12
    back.eventMode = 'static'; back.cursor = 'pointer'
    back.on('pointertap', () => this.change(new MenuScene()))
    this.stage.addChild(retry, retryT, back, label)
  }

  update(): void {}

  dispose(): void {
    this.stage.removeFromParent(); this.stage.destroy({ children: true })
  }

  private saveHighScore(songId: string, r: Result, grade: string, fc: boolean){
    const scores = loadScores()
    const prev = scores[songId]
    const isNewRecord = !prev || r.score > prev.bestScore
    if (isNewRecord) {
      scores[songId] = {
        bestScore: r.score,
        maxCombo: r.maxCombo,
        counts: r.counts,
        grade,
        fc
      }
      saveScores(scores)
    }
    return { isNewRecord }
  }
}

function computeGrade(acc: number){
  if (acc >= 95) return 'S'
  if (acc >= 90) return 'A'
  if (acc >= 80) return 'B'
  return 'C'
}
