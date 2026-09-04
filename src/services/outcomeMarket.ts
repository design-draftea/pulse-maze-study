export type OutcomeSide = 'up' | 'down'

export const INITIAL_PARTICIPATIONS: Record<OutcomeSide, number> = {
  up: 0,
  down: 0,
}

export type OutcomeMarketStatus =
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'unavailable'

export interface OrderBookLevel {
  price: number
  size: number
}

export interface OutcomeOrderBook {
  asks: OrderBookLevel[]
  bids: OrderBookLevel[]
  lastTradePrice: number | null
}

export interface ExecutionQuote {
  side: OutcomeSide
  operation: 'buy' | 'sell'
  requestedValue: number
  participations: number
  grossValue: number
  averagePrice: number
  complete: boolean
  quotedAt: number
}

export interface OutcomeMarketState {
  status: OutcomeMarketStatus
  roundSlug: string
  source: 'polymarket' | 'local'
  lockedForRound: boolean
  displayPrices: Record<OutcomeSide, number | null>
  books: Record<OutcomeSide, OutcomeOrderBook | null>
  updatedAt: number | null
  quoteBuy: (side: OutcomeSide, amount: number) => ExecutionQuote | null
  quoteSell: (
    side: OutcomeSide,
    participations: number,
  ) => ExecutionQuote | null
}

export interface MutableOrderBook {
  asks: Map<number, number>
  bids: Map<number, number>
  lastTradePrice: number | null
}

export interface RawBookLevel {
  price?: unknown
  size?: unknown
}

export interface RawPriceChange extends RawBookLevel {
  side?: unknown
}

export const addPurchasedParticipations = (
  current: Record<OutcomeSide, number>,
  quote: ExecutionQuote,
): Record<OutcomeSide, number> => {
  if (!quote.complete || quote.operation !== 'buy') return current

  return {
    ...current,
    [quote.side]: current[quote.side] + quote.participations,
  }
}

export const removeSoldParticipations = (
  current: Record<OutcomeSide, number>,
  quote: ExecutionQuote,
): Record<OutcomeSide, number> => {
  if (!quote.complete || quote.operation !== 'sell') return current

  return {
    ...current,
    [quote.side]: Math.max(
      0,
      current[quote.side] - quote.participations,
    ),
  }
}

const PRICE_EPSILON = 1e-9
const MAX_MIDPOINT_SPREAD = 0.1

const isValidPrice = (value: number) => (
  Number.isFinite(value) && value > 0 && value < 1
)

const isValidSize = (value: number) => Number.isFinite(value) && value >= 0

const parseFiniteNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const parseGammaStringList = (value: unknown): string[] | null => {
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === 'string')
      ? value
      : null
  }

  if (typeof value !== 'string') return null

  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed)
      && parsed.every((item) => typeof item === 'string')
      ? parsed
      : null
  } catch {
    return null
  }
}

export const mapOutcomeTokens = (
  outcomesValue: unknown,
  tokenIdsValue: unknown,
): Record<OutcomeSide, string> | null => {
  const outcomes = parseGammaStringList(outcomesValue)
  const tokenIds = parseGammaStringList(tokenIdsValue)

  if (!outcomes || !tokenIds || outcomes.length !== tokenIds.length) {
    return null
  }

  const mapped: Partial<Record<OutcomeSide, string>> = {}

  outcomes.forEach((outcome, index) => {
    const normalizedOutcome = outcome.trim().toLowerCase()
    const tokenId = tokenIds[index]?.trim()
    if (!tokenId) return

    if (normalizedOutcome === 'up') mapped.up = tokenId
    if (normalizedOutcome === 'down') mapped.down = tokenId
  })

  return mapped.up && mapped.down
    ? { up: mapped.up, down: mapped.down }
    : null
}

export const createMutableOrderBook = (): MutableOrderBook => ({
  asks: new Map(),
  bids: new Map(),
  lastTradePrice: null,
})

const replaceLevels = (
  target: Map<number, number>,
  levels: readonly RawBookLevel[],
) => {
  target.clear()

  levels.forEach((level) => {
    const price = parseFiniteNumber(level.price)
    const size = parseFiniteNumber(level.size)
    if (price === null || size === null || !isValidPrice(price) || size <= 0) {
      return
    }

    target.set(price, size)
  })
}

export const replaceOrderBookSnapshot = (
  book: MutableOrderBook,
  bids: readonly RawBookLevel[],
  asks: readonly RawBookLevel[],
) => {
  replaceLevels(book.bids, bids)
  replaceLevels(book.asks, asks)
}

export const applyOrderBookPriceChange = (
  book: MutableOrderBook,
  change: RawPriceChange,
) => {
  const price = parseFiniteNumber(change.price)
  const size = parseFiniteNumber(change.size)
  const side = typeof change.side === 'string'
    ? change.side.toUpperCase()
    : ''

  if (
    price === null
    || size === null
    || !isValidPrice(price)
    || !isValidSize(size)
    || (side !== 'BUY' && side !== 'SELL')
  ) {
    return false
  }

  const levels = side === 'BUY' ? book.bids : book.asks
  if (size === 0) {
    levels.delete(price)
  } else {
    levels.set(price, size)
  }

  return true
}

export const setLastTradePrice = (
  book: MutableOrderBook,
  value: unknown,
) => {
  const price = parseFiniteNumber(value)
  if (price === null || !isValidPrice(price)) return false

  book.lastTradePrice = price
  return true
}

export const snapshotOrderBook = (
  book: MutableOrderBook,
): OutcomeOrderBook => ({
  bids: [...book.bids.entries()]
    .map(([price, size]) => ({ price, size }))
    .sort((left, right) => right.price - left.price),
  asks: [...book.asks.entries()]
    .map(([price, size]) => ({ price, size }))
    .sort((left, right) => left.price - right.price),
  lastTradePrice: book.lastTradePrice,
})

export const getDisplayedOutcomePrice = (
  book: OutcomeOrderBook,
): number | null => {
  const bestBid = book.bids[0]?.price
  const bestAsk = book.asks[0]?.price

  if (
    bestBid === undefined
    || bestAsk === undefined
    || !isValidPrice(bestBid)
    || !isValidPrice(bestAsk)
    || bestAsk < bestBid
  ) {
    return null
  }

  if (bestAsk - bestBid <= MAX_MIDPOINT_SPREAD + PRICE_EPSILON) {
    return (bestBid + bestAsk) / 2
  }

  return book.lastTradePrice !== null && isValidPrice(book.lastTradePrice)
    ? book.lastTradePrice
    : null
}

export const quoteOrderBook = (
  book: OutcomeOrderBook,
  side: OutcomeSide,
  operation: 'buy' | 'sell',
  requestedValue: number,
  quotedAt = Date.now(),
): ExecutionQuote | null => {
  if (!Number.isFinite(requestedValue) || requestedValue <= 0) return null

  const levels = operation === 'buy' ? book.asks : book.bids
  let remaining = requestedValue
  let participations = 0
  let grossValue = 0

  for (const level of levels) {
    if (!isValidPrice(level.price) || !Number.isFinite(level.size) || level.size <= 0) {
      continue
    }

    if (operation === 'buy') {
      const availableValue = level.price * level.size
      const consumedValue = Math.min(remaining, availableValue)
      const consumedParticipations = consumedValue / level.price

      grossValue += consumedValue
      participations += consumedParticipations
      remaining -= consumedValue
    } else {
      const consumedParticipations = Math.min(remaining, level.size)
      const receivedValue = consumedParticipations * level.price

      grossValue += receivedValue
      participations += consumedParticipations
      remaining -= consumedParticipations
    }

    if (remaining <= PRICE_EPSILON) break
  }

  const complete = remaining <= PRICE_EPSILON
  const averagePrice = participations > 0
    ? grossValue / participations
    : 0

  return {
    side,
    operation,
    requestedValue,
    participations,
    grossValue,
    averagePrice,
    complete,
    quotedAt,
  }
}
