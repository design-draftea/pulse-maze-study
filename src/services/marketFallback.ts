import type {
  OutcomeOrderBook,
  OutcomeSide,
} from './outcomeMarket'

export type BtcPriceSource = 'chainlink' | 'coinbase' | 'kraken'
export type OutcomeDataSource = 'polymarket' | 'local'
export type RoundDataSource = 'polymarket' | 'local'

export interface PriceFeedCandidate {
  source: BtcPriceSource
  value: number | null
  updatedAt: number | null
}

export interface CachedMarketRound {
  roundStart: number
  targetPrice: number
  finalPrice: number | null
  result: OutcomeSide | null
  source: RoundDataSource
}

export interface SyntheticOutcomeMarket {
  displayPrices: Record<OutcomeSide, number>
  books: Record<OutcomeSide, OutcomeOrderBook>
}

export const MARKET_ROUND_CACHE_KEY = 'pulse.market-round-cache.v1'
export const MARKET_ROUND_CACHE_LIMIT = 12
export const BTC_PRICE_STALE_MS = 10_000

const PRICE_SOURCE_PRIORITY: readonly BtcPriceSource[] = [
  'chainlink',
  'coinbase',
  'kraken',
]
const MIN_OUTCOME_PRICE = 0.03
const MAX_OUTCOME_PRICE = 0.97
const SYNTHETIC_HALF_SPREAD = 0.005
const SYNTHETIC_LEVEL_COUNT = 5
const SYNTHETIC_LEVEL_SIZE = 50_000
const FALLBACK_SMOOTHING_FACTOR = 0.2

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
)

const isPositiveFinite = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
)

const isRoundDataSource = (value: unknown): value is RoundDataSource => (
  value === 'polymarket' || value === 'local'
)

export const isPriceFeedFresh = (
  candidate: PriceFeedCandidate,
  now = Date.now(),
  staleAfterMs = BTC_PRICE_STALE_MS,
) => (
  isPositiveFinite(candidate.value)
  && candidate.updatedAt !== null
  && Number.isFinite(candidate.updatedAt)
  && now - candidate.updatedAt <= staleAfterMs
)

export const selectFreshPriceFeed = (
  candidates: readonly PriceFeedCandidate[],
  now = Date.now(),
  staleAfterMs = BTC_PRICE_STALE_MS,
) => {
  const freshBySource = new Map(
    candidates
      .filter((candidate) => isPriceFeedFresh(candidate, now, staleAfterMs))
      .map((candidate) => [candidate.source, candidate]),
  )

  for (const source of PRICE_SOURCE_PRIORITY) {
    const candidate = freshBySource.get(source)
    if (candidate) return candidate
  }

  return null
}

export const selectInitialPriceFeed = (
  candidate: PriceFeedCandidate | null,
  now: number,
  selectionDeadline: number,
): PriceFeedCandidate | null => (
  candidate?.source === 'chainlink' || now >= selectionDeadline ? candidate : null
)

export const calculateFallbackOutcomePrices = (
  currentPrice: number | null,
  targetPrice: number | null,
  remainingSeconds: number,
): Record<OutcomeSide, number> => {
  if (
    !isPositiveFinite(currentPrice)
    || !isPositiveFinite(targetPrice)
  ) {
    return { up: 0.5, down: 0.5 }
  }

  const boundedRemaining = clamp(remainingSeconds, 1, 15 * 60)
  const distanceBps = ((currentPrice - targetPrice) / targetPrice) * 10_000
  const timeScaleBps = Math.max(
    0.75,
    8 * Math.sqrt(boundedRemaining / (15 * 60)),
  )
  const rawUp = 1 / (1 + Math.exp(-(distanceBps / timeScaleBps)))
  const up = clamp(rawUp, MIN_OUTCOME_PRICE, MAX_OUTCOME_PRICE)

  return { up, down: 1 - up }
}

export const smoothFallbackOutcomePrices = (
  previous: Record<OutcomeSide, number>,
  next: Record<OutcomeSide, number>,
  factor = FALLBACK_SMOOTHING_FACTOR,
): Record<OutcomeSide, number> => {
  const boundedFactor = clamp(factor, 0, 1)
  const up = clamp(
    previous.up + (next.up - previous.up) * boundedFactor,
    MIN_OUTCOME_PRICE,
    MAX_OUTCOME_PRICE,
  )

  return { up, down: 1 - up }
}

const getAdaptiveLevelStep = (
  bestPrice: number,
  direction: 'higher' | 'lower',
) => {
  const available = direction === 'higher'
    ? 0.999 - bestPrice
    : bestPrice - 0.001

  return Math.min(0.01, available / (SYNTHETIC_LEVEL_COUNT - 1))
}

const createSyntheticBook = (centerPrice: number): OutcomeOrderBook => {
  const bestBid = clamp(
    centerPrice - SYNTHETIC_HALF_SPREAD,
    0.001,
    0.998,
  )
  const bestAsk = clamp(
    centerPrice + SYNTHETIC_HALF_SPREAD,
    bestBid + 0.001,
    0.999,
  )
  const bidStep = getAdaptiveLevelStep(bestBid, 'lower')
  const askStep = getAdaptiveLevelStep(bestAsk, 'higher')
  const bids = Array.from({ length: SYNTHETIC_LEVEL_COUNT }, (_, index) => ({
    price: bestBid - bidStep * index,
    size: SYNTHETIC_LEVEL_SIZE,
  })).sort((left, right) => right.price - left.price)
  const asks = Array.from({ length: SYNTHETIC_LEVEL_COUNT }, (_, index) => ({
    price: bestAsk + askStep * index,
    size: SYNTHETIC_LEVEL_SIZE,
  })).sort((left, right) => left.price - right.price)

  return { bids, asks, lastTradePrice: centerPrice }
}

export const createSyntheticOutcomeMarket = (
  displayPrices: Record<OutcomeSide, number>,
): SyntheticOutcomeMarket => ({
  displayPrices,
  books: {
    up: createSyntheticBook(displayPrices.up),
    down: createSyntheticBook(displayPrices.down),
  },
})

export const deserializeMarketRoundCache = (
  rawValue: string | null,
): CachedMarketRound[] => {
  if (!rawValue) return []

  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.flatMap((value) => {
      if (!value || typeof value !== 'object') return []

      const candidate = value as Partial<CachedMarketRound>
      const roundStart = candidate.roundStart
      const finalPrice = candidate.finalPrice === null
        ? null
        : candidate.finalPrice
      if (
        typeof roundStart !== 'number'
        || !Number.isSafeInteger(roundStart)
        || !isPositiveFinite(candidate.targetPrice)
        || (finalPrice !== null && !isPositiveFinite(finalPrice))
        || !isRoundDataSource(candidate.source)
      ) {
        return []
      }

      return [{
        roundStart,
        targetPrice: candidate.targetPrice,
        finalPrice,
        result: finalPrice === null
          ? null
          : candidate.result === 'up' || candidate.result === 'down'
            ? candidate.result
            : finalPrice > candidate.targetPrice ? 'up' : 'down',
        source: candidate.source,
      }]
    })
      .sort((left, right) => right.roundStart - left.roundStart)
      .slice(0, MARKET_ROUND_CACHE_LIMIT)
  } catch {
    return []
  }
}

export const serializeMarketRoundCache = (
  rounds: readonly CachedMarketRound[],
) => JSON.stringify(rounds.slice(0, MARKET_ROUND_CACHE_LIMIT))

export const upsertCachedMarketRound = (
  rounds: readonly CachedMarketRound[],
  nextRound: CachedMarketRound,
) => [
  nextRound,
  ...rounds.filter(({ roundStart }) => roundStart !== nextRound.roundStart),
]
  .sort((left, right) => right.roundStart - left.roundStart)
  .slice(0, MARKET_ROUND_CACHE_LIMIT)
