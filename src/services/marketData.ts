export const BTC_ROUND_DURATION_MS = 15 * 60 * 1000
export const BTC_DISPLAY_TIME_ZONE = new Intl.DateTimeFormat()
  .resolvedOptions()
  .timeZone

const configuredPolymarketProxyOrigin = import.meta.env
  ?.VITE_POLYMARKET_PROXY_ORIGIN
  ?.trim()
  .replace(/\/$/, '')
const POLYMARKET_TARGET_ENDPOINT = configuredPolymarketProxyOrigin
  ? `${configuredPolymarketProxyOrigin}/crypto/crypto-price`
  : import.meta.env?.DEV
    ? '/api/polymarket/crypto/crypto-price'
    : null
const COINBASE_CANDLES_ENDPOINT = 'https://api.exchange.coinbase.com/products/BTC-USD/candles'

type PolymarketCryptoPriceResponse = {
  openPrice?: number
  closePrice?: number | null
  completed?: boolean
}

type CoinbaseCandle = [
  timestampSeconds: number,
  low: number,
  high: number,
  open: number,
  close: number,
  volume?: number,
]

export type HistoricalBtcRound = {
  id: string
  roundStart: number
  roundEnd: number
  targetPrice: number
  finalPrice: number
  result: 'up' | 'down'
}

export const getBtcRoundStart = (timestamp = Date.now()) => (
  Math.floor(timestamp / BTC_ROUND_DURATION_MS) * BTC_ROUND_DURATION_MS
)

export const getBtcRoundSlug = (roundStart: number) => (
  `btc-updown-15m-${Math.floor(roundStart / 1000)}`
)

export const getPreviousBtcRoundStarts = (
  currentRoundStart: number,
  count: number,
) => Array.from({ length: Math.max(0, count) }, (_, index) => (
  currentRoundStart - (index + 1) * BTC_ROUND_DURATION_MS
))

const toPolymarketIso = (timestamp: number) => (
  new Date(timestamp).toISOString().replace('.000Z', 'Z')
)

const fetchBtcRoundPrice = async (
  roundStart: number,
  signal?: AbortSignal,
) => {
  if (POLYMARKET_TARGET_ENDPOINT === null) {
    throw new Error('Proxy público de mercado no configurado')
  }

  const params = new URLSearchParams({
    symbol: 'BTC',
    eventStartTime: toPolymarketIso(roundStart),
    variant: 'fifteen',
    endDate: toPolymarketIso(roundStart + BTC_ROUND_DURATION_MS),
  })
  const response = await fetch(`${POLYMARKET_TARGET_ENDPOINT}?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Datos de la ronda no disponibles (${response.status})`)
  }

  return response.json() as Promise<PolymarketCryptoPriceResponse>
}

export const fetchBtcRoundTarget = async (
  roundStart: number,
  signal?: AbortSignal,
) => {
  const payload = await fetchBtcRoundPrice(roundStart, signal)
  const openPrice = Number(payload.openPrice)

  if (!Number.isFinite(openPrice) || openPrice <= 0) {
    throw new Error('La ronda no incluyó un precio objetivo válido')
  }

  return openPrice
}

export const fetchCompletedBtcRound = async (
  roundStart: number,
  signal?: AbortSignal,
): Promise<HistoricalBtcRound> => {
  const payload = await fetchBtcRoundPrice(roundStart, signal)
  const targetPrice = Number(payload.openPrice)
  const finalPrice = Number(payload.closePrice)

  if (
    payload.completed !== true
    || !Number.isFinite(targetPrice)
    || targetPrice <= 0
    || !Number.isFinite(finalPrice)
    || finalPrice <= 0
  ) {
    throw new Error('El resultado oficial de la ronda todavía no está disponible')
  }

  return {
    id: getBtcRoundSlug(roundStart),
    roundStart,
    roundEnd: roundStart + BTC_ROUND_DURATION_MS,
    targetPrice,
    finalPrice,
    result: finalPrice > targetPrice ? 'up' : 'down',
  }
}

const fetchCoinbaseBtcRounds = async (
  currentRoundStart: number,
  count: number,
  signal?: AbortSignal,
) => {
  const expectedStarts = new Set(getPreviousBtcRoundStarts(currentRoundStart, count))
  const earliestRoundStart = currentRoundStart - count * BTC_ROUND_DURATION_MS
  const params = new URLSearchParams({
    granularity: String(BTC_ROUND_DURATION_MS / 1000),
    start: toPolymarketIso(earliestRoundStart),
    end: toPolymarketIso(currentRoundStart),
  })
  const response = await fetch(`${COINBASE_CANDLES_ENDPOINT}?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Historial alternativo no disponible (${response.status})`)
  }

  const candles = await response.json() as CoinbaseCandle[]
  return candles.flatMap((candle) => {
    const [timestampSeconds, , , rawOpen, rawClose] = candle
    const roundStart = Number(timestampSeconds) * 1000
    const targetPrice = Number(rawOpen)
    const finalPrice = Number(rawClose)

    if (
      !expectedStarts.has(roundStart)
      || !Number.isFinite(targetPrice)
      || targetPrice <= 0
      || !Number.isFinite(finalPrice)
      || finalPrice <= 0
    ) return []

    return [{
      id: getBtcRoundSlug(roundStart),
      roundStart,
      roundEnd: roundStart + BTC_ROUND_DURATION_MS,
      targetPrice,
      finalPrice,
      result: finalPrice > targetPrice ? 'up' as const : 'down' as const,
    }]
  })
}

export const fetchPreviousBtcRounds = async (
  currentRoundStart: number,
  count = 10,
  signal?: AbortSignal,
): Promise<HistoricalBtcRound[]> => {
  const candidates = getPreviousBtcRoundStarts(currentRoundStart, count)
  const [polymarketResponses, coinbaseResponse] = await Promise.all([
    Promise.allSettled(
      candidates.map((roundStart) => fetchCompletedBtcRound(roundStart, signal)),
    ),
    fetchCoinbaseBtcRounds(currentRoundStart, count, signal)
      .catch(() => []),
  ])
  const byRoundStart = new Map<number, HistoricalBtcRound>()

  coinbaseResponse.forEach((round) => byRoundStart.set(round.roundStart, round))
  polymarketResponses.forEach((response) => {
    if (response.status === 'fulfilled') {
      byRoundStart.set(response.value.roundStart, response.value)
    }
  })

  return candidates.flatMap((roundStart) => {
    const round = byRoundStart.get(roundStart)
    return round ? [round] : []
  })
}

export type BtcRoundPricePoint = {
  timestamp: number
  value: number
}

const ROUND_BACKFILL_GRANULARITY_SECONDS = 60
const ROUND_BACKFILL_GRANULARITY_MS = ROUND_BACKFILL_GRANULARITY_SECONDS * 1000

export const fetchBtcMinutePoints = async (
  start: number,
  until: number,
  signal?: AbortSignal,
): Promise<BtcRoundPricePoint[]> => {
  if (until - start < ROUND_BACKFILL_GRANULARITY_MS) return []

  const params = new URLSearchParams({
    granularity: String(ROUND_BACKFILL_GRANULARITY_SECONDS),
    start: toPolymarketIso(start),
    end: toPolymarketIso(until),
  })
  const response = await fetch(`${COINBASE_CANDLES_ENDPOINT}?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Historial de la ronda no disponible (${response.status})`)
  }

  const candles = await response.json() as CoinbaseCandle[]
  const points = candles.flatMap((candle) => {
    const [timestampSeconds, , , rawOpen, rawClose] = candle
    const openedAt = Number(timestampSeconds) * 1000
    const open = Number(rawOpen)
    const close = Number(rawClose)

    if (
      openedAt < start
      || openedAt >= until
      || !Number.isFinite(open)
      || open <= 0
      || !Number.isFinite(close)
      || close <= 0
    ) return []

    const closedAt = openedAt + ROUND_BACKFILL_GRANULARITY_MS

    return closedAt <= until
      ? [
          { timestamp: openedAt, value: open },
          { timestamp: closedAt, value: close },
        ]
      : [{ timestamp: openedAt, value: open }]
  })

  return points
    .sort((left, right) => left.timestamp - right.timestamp)
    .filter((point, index, all) => (
      index === 0 || all[index - 1].timestamp !== point.timestamp
    ))
}

export const fetchBtcRoundMinutePoints = (
  roundStart: number,
  until: number,
  signal?: AbortSignal,
) => fetchBtcMinutePoints(
  roundStart,
  Math.min(until, roundStart + BTC_ROUND_DURATION_MS),
  signal,
)
