export type SongMeta = {
  id: string
  title: string
  bpm: number
  duration: number // seconds
  audioUrl: string
  offsetMs?: number
}

export const songs: SongMeta[] = [
  { id: 'pop-spark', title: 'Pop Spark', bpm: 140, duration: 120, audioUrl: '/audio/pop-spark.mp3', offsetMs: 0 },
  { id: 'neon-groove', title: 'Neon Groove', bpm: 128, duration: 90, audioUrl: '/audio/neon-groove.mp3', offsetMs: 0 }
]

export function getSongById(id: string) {
  const s = songs.find(s => s.id === id)
  if (!s) throw new Error('song not found: ' + id)
  return s
}
