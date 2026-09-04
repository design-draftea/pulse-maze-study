import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyOrderBookPriceChange,
  createMutableOrderBook,
  getDisplayedOutcomePrice,
  mapOutcomeTokens,
  quoteOrderBook,
  replaceOrderBookSnapshot,
  setLastTradePrice,
  snapshotOrderBook,
  type ExecutionQuote,
  type MutableOrderBook,
  type OutcomeMarketState,
  type OutcomeMarketStatus,
  type OutcomeOrderBook,
  type OutcomeSide,
  type RawBookLevel,
  type RawPriceChange,
} from '../services/outcomeMarket'
import {
  calculateFallbackOutcomePrices,
  createSyntheticOutcomeMarket,
  smoothFallbackOutcomePrices,
} from '../services/marketFallback'

const GAMMA_API_ORIGIN = 'https://gamma-api.polymarket.com'
const CLOB_MARKET_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market'
const MARKET_PUBLISH_INTERVAL_MS = 250
const CLOB_HEARTBEAT_INTERVAL_MS = 10_000
const CLOB_STALE_AFTER_MS = 25_000
const CLOB_STALE_CHECK_INTERVAL_MS = 5_000
const DISCOVERY_RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000]
const RECONNECT_DELAY_MS = 2_000
const PRIMARY_WARMUP_MS = 3_000
const OUTCOME_FALLBACK_LOCK_KEY = 'pulse.outcome-fallback-round.v1'

interface UseOutcomeMarketOptions {
  roundSlug: string
  targetPrice: number | null
  currentPrice: number | null
  remainingSeconds: number
  hasUserInteraction?: boolean
}

interface GammaMarket {
  acceptingOrders?: boolean
  closed?: boolean
  clobTokenIds?: unknown
  enableOrderBook?: boolean
  outcomes?: unknown
}

interface GammaEvent {
  markets?: GammaMarket[]
}

interface MarketSnapshot {
  status: OutcomeMarketStatus
  roundSlug: string
  displayPrices: Record<OutcomeSide, number | null>
  books: Record<OutcomeSide, OutcomeOrderBook | null>
  updatedAt: number | null
}

interface ClobMessage {
  asset_id?: unknown
  asks?: unknown
  bids?: unknown
  event_type?: unknown
  price?: unknown
  price_changes?: unknown
}

const createEmptySnapshot = (
  roundSlug: string,
  status: OutcomeMarketStatus,
): MarketSnapshot => ({
  status,
  roundSlug,
  displayPrices: { up: null, down: null },
  books: { up: null, down: null },
  updatedAt: null,
})

const isRawBookLevelArray = (value: unknown): value is RawBookLevel[] => (
  Array.isArray(value)
)

const getAssetId = (value: unknown) => (
  typeof value === 'string' && value.length > 0 ? value : null
)

const getEventType = (value: unknown) => (
  typeof value === 'string' ? value : ''
)

const getGammaTokens = (event: GammaEvent) => {
  for (const market of event.markets ?? []) {
    if (
      market.closed === true
      || market.enableOrderBook === false
      || market.acceptingOrders === false
    ) {
      continue
    }

    const tokens = mapOutcomeTokens(market.outcomes, market.clobTokenIds)
    if (tokens) return tokens
  }

  return null
}

const getRetryDelay = (attempt: number) => (
  DISCOVERY_RETRY_DELAYS_MS[
    Math.min(attempt, DISCOVERY_RETRY_DELAYS_MS.length - 1)
  ]
)

const hasForcedFailure = (failure: 'gamma' | 'clob') => {
  if (!import.meta.env.DEV) return false

  const failures = new Set(
    new URLSearchParams(window.location.search)
      .get('testDataFailure')
      ?.split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean) ?? [],
  )

  return failures.has(failure) || failures.has('all-polymarket')
}

export function useOutcomeMarket({
  roundSlug,
  targetPrice,
  currentPrice,
  remainingSeconds,
  hasUserInteraction = false,
}: UseOutcomeMarketOptions): OutcomeMarketState {
  const [snapshot, setSnapshot] = useState<MarketSnapshot>(() => (
    createEmptySnapshot(roundSlug, 'connecting')
  ))
  const [fallbackPrices, setFallbackPrices] = useState({ up: 0.5, down: 0.5 })
  const [fallbackUpdatedAt, setFallbackUpdatedAt] = useState(() => Date.now())
  const [fallbackLockedRound, setFallbackLockedRound] = useState<string | null>(
    () => window.localStorage.getItem(OUTCOME_FALLBACK_LOCK_KEY),
  )
  const primaryWasLiveRef = useRef(false)
  const fallbackInputsRef = useRef({
    currentPrice,
    targetPrice,
    remainingSeconds,
  })
  const currentSnapshot = snapshot.roundSlug === roundSlug
    ? snapshot
    : createEmptySnapshot(roundSlug, 'connecting')
  const isFallbackLocked = fallbackLockedRound === roundSlug
  const lockFallbackForRound = useCallback(() => {
    window.localStorage.setItem(OUTCOME_FALLBACK_LOCK_KEY, roundSlug)
    setFallbackLockedRound(roundSlug)
  }, [roundSlug])

  useEffect(() => {
    primaryWasLiveRef.current = false

    const warmupTimer = window.setTimeout(() => {
      if (primaryWasLiveRef.current) return
      lockFallbackForRound()
    }, PRIMARY_WARMUP_MS)

    return () => window.clearTimeout(warmupTimer)
  }, [lockFallbackForRound, roundSlug])

  useEffect(() => {
    const hasCompletePrimaryPrices = currentSnapshot.status === 'live'
      && currentSnapshot.displayPrices.up !== null
      && currentSnapshot.displayPrices.down !== null

    if (hasCompletePrimaryPrices && !isFallbackLocked) {
      primaryWasLiveRef.current = true
      return undefined
    }

    if (primaryWasLiveRef.current && currentSnapshot.status !== 'live') {
      const lockTimer = window.setTimeout(lockFallbackForRound, 0)
      return () => window.clearTimeout(lockTimer)
    }

    return undefined
  }, [currentSnapshot, isFallbackLocked, lockFallbackForRound, roundSlug])

  useEffect(() => {
    if (hasUserInteraction && currentSnapshot.status !== 'live') {
      const lockTimer = window.setTimeout(lockFallbackForRound, 0)
      return () => window.clearTimeout(lockTimer)
    }

    return undefined
  }, [
    currentSnapshot.status,
    hasUserInteraction,
    lockFallbackForRound,
    roundSlug,
  ])

  useEffect(() => {
    fallbackInputsRef.current = {
      currentPrice,
      targetPrice,
      remainingSeconds,
    }
  }, [currentPrice, remainingSeconds, targetPrice])

  useEffect(() => {
    if (currentSnapshot.status === 'live' && !isFallbackLocked) return undefined

    const updateFallbackPrices = () => {
      const inputs = fallbackInputsRef.current
      const nextPrices = calculateFallbackOutcomePrices(
        inputs.currentPrice,
        inputs.targetPrice,
        inputs.remainingSeconds,
      )
      setFallbackPrices((current) => smoothFallbackOutcomePrices(
        current,
        nextPrices,
      ))
      setFallbackUpdatedAt(Date.now())
    }

    updateFallbackPrices()
    const updateTimer = window.setInterval(updateFallbackPrices, 250)
    return () => window.clearInterval(updateTimer)
  }, [currentSnapshot.status, isFallbackLocked])

  useEffect(() => {
    let disposed = false
    let socket: WebSocket | null = null
    let discoveryController: AbortController | null = null
    let discoveryRetryTimer: number | null = null
    let reconnectTimer: number | null = null
    let publishTimer: number | null = null
    let heartbeatTimer: number | null = null
    let staleCheckTimer: number | null = null
    let discoveryAttempt = 0
    let hasConnected = false
    let lastActivityAt = Date.now()
    let tokens: Record<OutcomeSide, string> | null = null
    const booksByToken = new Map<string, MutableOrderBook>()
    const snapshotTokens = new Set<string>()

    const clearTimer = (timer: number | null) => {
      if (timer !== null) window.clearTimeout(timer)
    }

    const clearIntervalTimer = (timer: number | null) => {
      if (timer !== null) window.clearInterval(timer)
    }

    const resetPublishedMarket = (status: OutcomeMarketStatus) => {
      if (disposed) return
      setSnapshot(createEmptySnapshot(roundSlug, status))
    }

    const clearLiveBook = (status: OutcomeMarketStatus) => {
      booksByToken.clear()
      snapshotTokens.clear()
      clearTimer(publishTimer)
      publishTimer = null
      resetPublishedMarket(status)
    }

    const publishMarket = () => {
      publishTimer = null
      if (disposed || !tokens) return

      if (
        !snapshotTokens.has(tokens.up)
        || !snapshotTokens.has(tokens.down)
      ) {
        return
      }

      const upBook = booksByToken.get(tokens.up)
      const downBook = booksByToken.get(tokens.down)
      if (!upBook || !downBook) return

      const books = {
        up: snapshotOrderBook(upBook),
        down: snapshotOrderBook(downBook),
      }

      setSnapshot({
        status: 'live',
        roundSlug,
        books,
        displayPrices: {
          up: getDisplayedOutcomePrice(books.up),
          down: getDisplayedOutcomePrice(books.down),
        },
        updatedAt: Date.now(),
      })
    }

    const schedulePublish = () => {
      if (publishTimer !== null) return
      publishTimer = window.setTimeout(
        publishMarket,
        MARKET_PUBLISH_INTERVAL_MS,
      )
    }

    const processBookSnapshot = (message: ClobMessage) => {
      const assetId = getAssetId(message.asset_id)
      if (!assetId || !tokens || !Object.values(tokens).includes(assetId)) return
      if (!isRawBookLevelArray(message.bids) || !isRawBookLevelArray(message.asks)) {
        return
      }

      const previousBook = booksByToken.get(assetId)
      const book = createMutableOrderBook()
      book.lastTradePrice = previousBook?.lastTradePrice ?? null
      replaceOrderBookSnapshot(book, message.bids, message.asks)
      booksByToken.set(assetId, book)
      snapshotTokens.add(assetId)
      schedulePublish()
    }

    const processPriceChanges = (message: ClobMessage) => {
      if (!Array.isArray(message.price_changes)) return

      let changed = false
      message.price_changes.forEach((value) => {
        if (!value || typeof value !== 'object') return

        const change = value as RawPriceChange & { asset_id?: unknown }
        const assetId = getAssetId(change.asset_id)
        if (!assetId || !snapshotTokens.has(assetId)) return

        const book = booksByToken.get(assetId)
        if (book && applyOrderBookPriceChange(book, change)) changed = true
      })

      if (changed) schedulePublish()
    }

    const processLastTrade = (message: ClobMessage) => {
      const assetId = getAssetId(message.asset_id)
      if (!assetId || !tokens || !Object.values(tokens).includes(assetId)) return

      const book = booksByToken.get(assetId) ?? createMutableOrderBook()
      if (!setLastTradePrice(book, message.price)) return

      booksByToken.set(assetId, book)
      if (snapshotTokens.has(assetId)) schedulePublish()
    }

    const processMessage = (value: unknown) => {
      if (!value || typeof value !== 'object') return
      const message = value as ClobMessage
      const eventType = getEventType(message.event_type)

      if (eventType === 'book') processBookSnapshot(message)
      if (eventType === 'price_change') processPriceChanges(message)
      if (eventType === 'last_trade_price') processLastTrade(message)
    }

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer !== null || !tokens) return

      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        connectSocket()
      }, RECONNECT_DELAY_MS)
    }

    const connectSocket = () => {
      if (disposed || !tokens) return

      if (hasForcedFailure('clob')) {
        resetPublishedMarket('unavailable')
        return
      }

      clearLiveBook(hasConnected ? 'reconnecting' : 'connecting')
      const nextSocket = new WebSocket(CLOB_MARKET_WS_URL)
      socket = nextSocket

      nextSocket.addEventListener('open', () => {
        if (disposed || socket !== nextSocket || !tokens) return

        hasConnected = true
        lastActivityAt = Date.now()
        nextSocket.send(JSON.stringify({
          assets_ids: [tokens.up, tokens.down],
          type: 'market',
        }))

        heartbeatTimer = window.setInterval(() => {
          if (nextSocket.readyState === WebSocket.OPEN) nextSocket.send('PING')
        }, CLOB_HEARTBEAT_INTERVAL_MS)

        staleCheckTimer = window.setInterval(() => {
          if (
            nextSocket.readyState === WebSocket.OPEN
            && Date.now() - lastActivityAt > CLOB_STALE_AFTER_MS
          ) {
            nextSocket.close()
          }
        }, CLOB_STALE_CHECK_INTERVAL_MS)
      })

      nextSocket.addEventListener('message', (event) => {
        if (disposed || socket !== nextSocket) return

        lastActivityAt = Date.now()
        if (event.data === 'PONG') return

        try {
          const parsed = JSON.parse(String(event.data)) as unknown
          if (Array.isArray(parsed)) {
            parsed.forEach(processMessage)
          } else {
            processMessage(parsed)
          }
        } catch {
          // Ignore non-JSON protocol messages other than PONG.
        }
      })

      nextSocket.addEventListener('close', () => {
        if (socket !== nextSocket) return

        socket = null
        clearIntervalTimer(heartbeatTimer)
        clearIntervalTimer(staleCheckTimer)
        heartbeatTimer = null
        staleCheckTimer = null

        if (!disposed) {
          clearLiveBook('reconnecting')
          scheduleReconnect()
        }
      })

      nextSocket.addEventListener('error', () => {
        if (nextSocket.readyState !== WebSocket.CLOSED) nextSocket.close()
      })
    }

    const discoverMarket = async () => {
      if (disposed) return

      discoveryController?.abort()
      discoveryController = new AbortController()

      try {
        if (hasForcedFailure('gamma')) throw new Error('forced gamma failure')
        const response = await fetch(
          `${GAMMA_API_ORIGIN}/events/slug/${encodeURIComponent(roundSlug)}`,
          { signal: discoveryController.signal },
        )
        if (!response.ok) throw new Error(`Gamma respondió ${response.status}`)

        const event = await response.json() as GammaEvent
        const discoveredTokens = getGammaTokens(event)
        if (!discoveredTokens) throw new Error('Tokens UP/DOWN no disponibles')
        if (disposed) return

        tokens = discoveredTokens
        discoveryAttempt = 0
        connectSocket()
      } catch (error) {
        if (disposed || (error instanceof DOMException && error.name === 'AbortError')) {
          return
        }

        resetPublishedMarket('unavailable')
        const retryDelay = getRetryDelay(discoveryAttempt)
        discoveryAttempt += 1
        discoveryRetryTimer = window.setTimeout(() => {
          discoveryRetryTimer = null
          void discoverMarket()
        }, retryDelay)
      }
    }

    resetPublishedMarket('connecting')
    void discoverMarket()

    return () => {
      disposed = true
      discoveryController?.abort()
      clearTimer(discoveryRetryTimer)
      clearTimer(reconnectTimer)
      clearTimer(publishTimer)
      clearIntervalTimer(heartbeatTimer)
      clearIntervalTimer(staleCheckTimer)
      socket?.close()
    }
  }, [roundSlug])

  const syntheticMarket = useMemo(
    () => createSyntheticOutcomeMarket(fallbackPrices),
    [fallbackPrices],
  )
  const useLocalMarket = isFallbackLocked || currentSnapshot.status !== 'live'
  const activeSnapshot = useMemo<MarketSnapshot>(() => (
    useLocalMarket
      ? {
          status: 'live',
          roundSlug,
          displayPrices: syntheticMarket.displayPrices,
          books: syntheticMarket.books,
          updatedAt: fallbackUpdatedAt,
        }
      : currentSnapshot
  ), [
    currentSnapshot,
    fallbackUpdatedAt,
    roundSlug,
    syntheticMarket,
    useLocalMarket,
  ])

  const quoteBuy = useCallback((side: OutcomeSide, amount: number) => {
    const book = activeSnapshot.status === 'live'
      ? activeSnapshot.books[side]
      : null
    return book && activeSnapshot.updatedAt !== null
      ? quoteOrderBook(
          book,
          side,
          'buy',
          amount,
          activeSnapshot.updatedAt,
        )
      : null
  }, [activeSnapshot.books, activeSnapshot.status, activeSnapshot.updatedAt])

  const quoteSell = useCallback((side: OutcomeSide, participations: number) => {
    const book = activeSnapshot.status === 'live'
      ? activeSnapshot.books[side]
      : null
    return book && activeSnapshot.updatedAt !== null
      ? quoteOrderBook(
          book,
          side,
          'sell',
          participations,
          activeSnapshot.updatedAt,
        )
      : null
  }, [activeSnapshot.books, activeSnapshot.status, activeSnapshot.updatedAt])

  return useMemo(() => ({
    ...activeSnapshot,
    source: useLocalMarket ? 'local' as const : 'polymarket' as const,
    lockedForRound: isFallbackLocked,
    quoteBuy,
    quoteSell,
  }), [
    activeSnapshot,
    isFallbackLocked,
    quoteBuy,
    quoteSell,
    useLocalMarket,
  ])
}

export type { ExecutionQuote }
