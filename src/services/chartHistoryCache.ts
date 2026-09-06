import type { PricePoint } from '../components/PriceChart'

export const CHART_HISTORY_CACHE_KEY = 'pulse.chart-history.v1'
export const RANGE_HISTORY_DURATION_MS = 60 * 60_000
export const MAX_RANGE_HISTORY_POINTS = RANGE_HISTORY_DURATION_MS / 1000 + 1

type HistoryStorage = Pick<Storage, 'getItem' | 'setItem'>
type GetStorage = () => HistoryStorage
const browserStorage: GetStorage = () => window.localStorage

const normalizePoints = (points: unknown[], now: number): PricePoint[] => {
  const valid = points.filter((point): point is PricePoint => {
    if (!point || typeof point !== 'object') return false
    const { timestamp, value } = point as PricePoint
    return Number.isFinite(timestamp)
      && timestamp >= now - RANGE_HISTORY_DURATION_MS
      && timestamp <= now
      && Number.isFinite(value) && value > 0
  }).sort((a, b) => a.timestamp - b.timestamp)
  const bySecond = new Map<number, PricePoint>()
  for (const { timestamp, value } of valid) {
    bySecond.set(Math.floor(timestamp / 1000), { timestamp, value })
  }
  return [...bySecond.values()].slice(-MAX_RANGE_HISTORY_POINTS)
}

export const deserializeChartHistory = (raw: string | null, now: number): PricePoint[] => {
  try {
    if (!raw) return []
    const cache = JSON.parse(raw)
    if (cache?.version !== 1 || !Array.isArray(cache.points)) return []
    return normalizePoints(cache.points, now)
  } catch {
    return []
  }
}

export const serializeChartHistory = (points: PricePoint[], now: number): string => (
  JSON.stringify({ version: 1, points: normalizePoints(points, now) })
)

export const readChartHistory = (
  now = Date.now(), getStorage: GetStorage = browserStorage,
): PricePoint[] => {
  try {
    return deserializeChartHistory(getStorage().getItem(CHART_HISTORY_CACHE_KEY), now)
  } catch {
    return []
  }
}

export const writeChartHistory = (
  points: PricePoint[], now = Date.now(), getStorage: GetStorage = browserStorage,
): void => {
  try {
    getStorage().setItem(CHART_HISTORY_CACHE_KEY, serializeChartHistory(points, now))
  } catch {
    // O armazenamento é opcional; o feed continua funcionando em memória.
  }
}
