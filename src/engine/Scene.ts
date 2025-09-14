import type { Application } from 'pixi.js'

export interface Scene {
  init(): Promise<void> | void
  update(dt: number): void
  dispose(): void
}

export interface SceneContext {
  app: Application
  change(scene: Scene): void
}

