// 시드 기반 의사난수 (더미 데이터 생성용 - 새로고침해도 값이 안정적으로 유지되도록)
export function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

export function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function randFloat(rng: () => number, min: number, max: number, decimals = 1): number {
  const v = rng() * (max - min) + min
  const p = 10 ** decimals
  return Math.round(v * p) / p
}

export function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString()
}

export function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString()
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
