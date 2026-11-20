export interface Community {
  id: string
  x: number
  y: number
  delivery: number
  pickup: number
}

/** 坐标单位 km。派件、收件为件数。 */
export const COMMUNITIES: Community[] = [
  { id: 'A', x: 7.0, y: 7.0, delivery: 14, pickup: 14 },
  { id: 'B', x: 20.0, y: 20.0, delivery: 18, pickup: 25 },
  { id: 'C', x: 65.5, y: 91.5, delivery: 19, pickup: 19 },
  { id: 'D', x: 33.0, y: 55.1, delivery: 18, pickup: 27 },
  { id: 'E', x: 94.1, y: 77.2, delivery: 24, pickup: 19 },
  { id: 'F', x: 62.9, y: 33.0, delivery: 16, pickup: 17 },
  { id: 'G', x: 79.8, y: 78.5, delivery: 19, pickup: 13 },
  { id: 'H', x: 46.0, y: 64.2, delivery: 17, pickup: 11 },
  { id: 'I', x: 77.2, y: 49.9, delivery: 22, pickup: 18 },
  { id: 'J', x: 86.3, y: 77.2, delivery: 15, pickup: 24 },
  { id: 'K', x: 65.5, y: 22.6, delivery: 18, pickup: 12 },
  { id: 'L', x: 7.0, y: 52.5, delivery: 23, pickup: 15 },
  { id: 'M', x: 31.7, y: 29.1, delivery: 14, pickup: 14 },
  { id: 'N', x: 36.9, y: 34.3, delivery: 18, pickup: 15 },
  { id: 'O', x: 46.0, y: 36.9, delivery: 18, pickup: 15 },
  { id: 'P', x: 30.4, y: 35.6, delivery: 17, pickup: 25 },
  { id: 'Q', x: 65.5, y: 60.3, delivery: 21, pickup: 18 },
  { id: 'R', x: 49.9, y: 51.2, delivery: 23, pickup: 28 },
  { id: 'S', x: 55.1, y: 44.7, delivery: 18, pickup: 22 },
  { id: 'T', x: 51.2, y: 62.9, delivery: 19, pickup: 15 },
]

export const DEPOT_ID = 'R'

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function volume(c: Community): number {
  return c.delivery + c.pickup
}

const byId = new Map(COMMUNITIES.map((c) => [c.id, c]))

export function community(id: string): Community {
  const found = byId.get(id)
  if (!found) throw new Error(`未知小区 ${id}`)
  return found
}

export function distanceById(a: string, b: string): number {
  return distance(community(a), community(b))
}

export const DIST: number[][] = COMMUNITIES.map((row) =>
  COMMUNITIES.map((col) => distance(row, col)),
)
