import { useEffect, useMemo, useState } from 'react'
import {
  BTC_PRICE_STALE_MS,
  isPriceFeedFresh,
  selectFreshPriceFeed,
  type BtcPriceSource,
  type PriceFeedCandidate,
} from '../services/marketFallback'

const CHAINLINK_RTDS_URL = 'wss://ws-live-data.polymarket.com'
const COINBASE_MARKET_WS_URL = 'wss://advanced-trade-ws.coinbase.com'
const KRAKEN_MARKET_WS_URL = 'wss://ws.kraken.com/v2'
const RECONNECT_DELAY_MS = 2_000
const SOURCE_SELECTION_GRACE_MS = 3_000
const PRICE_SOURCES = ['chainlink', 'coinbase', 'kraken'] as const

type FeedSnapshots = Record<BtcPriceSource, PriceFeedCandidate>

type ChainlinkMessage = {
  payload?: {
    symbol?: string
    value?: string | number
  }
}

type CoinbaseMessage = {
  channel?: string
  events?: Array<{
    tickers?: Array<{
      price?: string
      product_id?: string
    }>
  }>
}

type KrakenMessage = {
  channel?: string
  data?: Array<{
    last?: number
    symbol?: string
  }>
}

export interface BtcPriceFeedsState {
  source: BtcPriceSource | null
  value: number | null
  updatedAt: number | null
  isFresh: boolean
}

const createEmptyFeed = (source: BtcPriceSource): PriceFeedCandidate => ({
  source,
  value: null,
  updatedAt: null,
})

const getForcedFailures = () => {
  if (!import.meta.env.DEV) return new Set<string>()

  return new Set(
    new URLSearchParams(window.location.search)
      .get('testDataFailure')
      ?.split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean) ?? [],
  )
}

const isForced = (
  failures: ReadonlySet<string>,
  source: BtcPriceSource,
) => failures.has(source)
  || (source === 'chainlink' && failures.has('all-polymarket'))

const getLatestValidFeed = (feeds: FeedSnapshots) => (
  Object.values(feeds)
    .filter((candidate) => (
      candidate.value !== null
      && Number.isFinite(candidate.value)
      && candidate.value > 0
      && candidate.updatedAt !== null
    ))
    .sort((left, right) => (
      (right.updatedAt ?? 0) - (left.updatedAt ?? 0)
    ))[0] ?? null
)

export function useBtcPriceFeeds(
  roundStart: number,
  now: number,
): BtcPriceFeedsState {
  const [feeds, setFeeds] = useState<FeedSnapshots>(() => ({
    chainlink: createEmptyFeed('chainlink'),
    coinbase: createEmptyFeed('coinbase'),
    kraken: createEmptyFeed('kraken'),
  }))
  const [sourceLock, setSourceLock] = useState<{
    roundStart: number
    source: BtcPriceSource | null
    selectionDeadline: number
  }>(() => ({
    roundStart,
    source: null,
    selectionDeadline: Date.now() + SOURCE_SELECTION_GRACE_MS,
  }))

  useEffect(() => {
    const failures = getForcedFailures()
    const sockets: Partial<Record<BtcPriceSource, WebSocket>> = {}
    const reconnectTimers: Partial<Record<BtcPriceSource, number>> = {}
    const heartbeatTimers: Partial<Record<BtcPriceSource, number>> = {}
    let disposed = false

    const publish = (source: BtcPriceSource, rawValue: unknown) => {
      const value = Number(rawValue)
      if (!Number.isFinite(value) || value <= 0) return

      setFeeds((current) => ({
        ...current,
        [source]: { source, value, updatedAt: Date.now() },
      }))
    }

    const clearSourceTimers = (source: BtcPriceSource) => {
      const reconnectTimer = reconnectTimers[source]
      const heartbeatTimer = heartbeatTimers[source]
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer)
      if (heartbeatTimer !== undefined) window.clearInterval(heartbeatTimer)
      delete reconnectTimers[source]
      delete heartbeatTimers[source]
    }

    const scheduleReconnect = (
      source: BtcPriceSource,
      connect: () => void,
    ) => {
      if (disposed || reconnectTimers[source] !== undefined) return
      reconnectTimers[source] = window.setTimeout(() => {
        delete reconnectTimers[source]
        connect()
      }, RECONNECT_DELAY_MS)
    }

    const connectChainlink = () => {
      if (disposed || isForced(failures, 'chainlink')) return

      const socket = new WebSocket(CHAINLINK_RTDS_URL)
      sockets.chainlink = socket

      socket.addEventListener('open', () => {
        if (disposed || sockets.chainlink !== socket) return
        socket.send(JSON.stringify({
          action: 'subscribe',
          subscriptions: [{
            topic: 'crypto_prices_twap_sixty',
            type: 'update',
            filters: '{"symbol":"btc/usd"}',
          }],
        }))
        heartbeatTimers.chainlink = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send('PING')
        }, 5_000)
      })

      socket.addEventListener('message', (event) => {
        if (disposed || sockets.chainlink !== socket || event.data === 'PONG') return
        try {
          const message = JSON.parse(String(event.data)) as ChainlinkMessage
          if (message.payload?.symbol?.toLowerCase() === 'btc/usd') {
            publish('chainlink', message.payload.value)
          }
        } catch {
          // Ignore protocol messages that are not JSON price updates.
        }
      })

      socket.addEventListener('close', () => {
        if (sockets.chainlink !== socket) return
        delete sockets.chainlink
        clearSourceTimers('chainlink')
        scheduleReconnect('chainlink', connectChainlink)
      })
      socket.addEventListener('error', () => socket.close())
    }

    const connectCoinbase = () => {
      if (disposed || isForced(failures, 'coinbase')) return

      const socket = new WebSocket(COINBASE_MARKET_WS_URL)
      sockets.coinbase = socket

      socket.addEventListener('open', () => {
        if (disposed || sockets.coinbase !== socket) return
        socket.send(JSON.stringify({
          type: 'subscribe',
          product_ids: ['BTC-USD'],
          channel: 'ticker',
        }))
        socket.send(JSON.stringify({
          type: 'subscribe',
          channel: 'heartbeats',
        }))
      })

      socket.addEventListener('message', (event) => {
        if (disposed || sockets.coinbase !== socket) return
        try {
          const message = JSON.parse(String(event.data)) as CoinbaseMessage
          if (message.channel !== 'ticker') return
          const ticker = message.events
            ?.flatMap(({ tickers = [] }) => tickers)
            .find(({ product_id: productId }) => productId === 'BTC-USD')
          publish('coinbase', ticker?.price)
        } catch {
          // Ignore protocol messages that are not JSON price updates.
        }
      })

      socket.addEventListener('close', () => {
        if (sockets.coinbase !== socket) return
        delete sockets.coinbase
        clearSourceTimers('coinbase')
        scheduleReconnect('coinbase', connectCoinbase)
      })
      socket.addEventListener('error', () => socket.close())
    }

    const connectKraken = () => {
      if (disposed || isForced(failures, 'kraken')) return

      const socket = new WebSocket(KRAKEN_MARKET_WS_URL)
      sockets.kraken = socket

      socket.addEventListener('open', () => {
        if (disposed || sockets.kraken !== socket) return
        socket.send(JSON.stringify({
          method: 'subscribe',
          params: {
            channel: 'ticker',
            symbol: ['BTC/USD'],
            event_trigger: 'trades',
            snapshot: true,
          },
        }))
      })

      socket.addEventListener('message', (event) => {
        if (disposed || sockets.kraken !== socket) return
        try {
          const message = JSON.parse(String(event.data)) as KrakenMessage
          if (message.channel !== 'ticker') return
          const ticker = message.data?.find(({ symbol }) => symbol === 'BTC/USD')
          publish('kraken', ticker?.last)
        } catch {
          // Ignore protocol messages that are not JSON price updates.
        }
      })

      socket.addEventListener('close', () => {
        if (sockets.kraken !== socket) return
        delete sockets.kraken
        clearSourceTimers('kraken')
        scheduleReconnect('kraken', connectKraken)
      })
      socket.addEventListener('error', () => socket.close())
    }

    connectChainlink()
    connectCoinbase()
    connectKraken()

    return () => {
      disposed = true
      PRICE_SOURCES.forEach((source) => {
        clearSourceTimers(source)
        sockets[source]?.close()
      })
    }
  }, [])

  const freshCandidate = useMemo(
    () => selectFreshPriceFeed(Object.values(feeds), now),
    [feeds, now],
  )
  const lockForCurrentRound = sourceLock.roundStart === roundStart
    ? sourceLock
    : null
  const lockedCandidate = lockForCurrentRound?.source
    ? feeds[lockForCurrentRound.source]
    : null
  const isLockedCandidateFresh = lockedCandidate
    ? isPriceFeedFresh(lockedCandidate, now, BTC_PRICE_STALE_MS)
    : false

  useEffect(() => {
    if (sourceLock.roundStart !== roundStart) {
      const resetTimer = window.setTimeout(() => {
        setSourceLock({
          roundStart,
          source: null,
          selectionDeadline: Date.now() + SOURCE_SELECTION_GRACE_MS,
        })
      }, 0)
      return () => window.clearTimeout(resetTimer)
    }

    if (sourceLock.source !== null) {
      if (!isLockedCandidateFresh && freshCandidate) {
        const fallbackSource = freshCandidate.source
        const fallbackTimer = window.setTimeout(() => {
          setSourceLock((current) => ({
            ...current,
            source: fallbackSource,
          }))
        }, 0)
        return () => window.clearTimeout(fallbackTimer)
      }
      return undefined
    }

    if (
      freshCandidate?.source === 'chainlink'
      || (freshCandidate && now >= sourceLock.selectionDeadline)
    ) {
      const initialSource = freshCandidate.source
      const selectionTimer = window.setTimeout(() => {
        setSourceLock((current) => ({
          ...current,
          source: initialSource,
        }))
      }, 0)
      return () => window.clearTimeout(selectionTimer)
    }

    return undefined
  }, [
    freshCandidate,
    isLockedCandidateFresh,
    now,
    roundStart,
    sourceLock,
  ])

  const selected = isLockedCandidateFresh
    ? lockedCandidate
    : freshCandidate ?? lockedCandidate ?? getLatestValidFeed(feeds)

  return {
    source: selected?.source ?? null,
    value: selected?.value ?? null,
    updatedAt: selected?.updatedAt ?? null,
    isFresh: selected ? isPriceFeedFresh(selected, now, BTC_PRICE_STALE_MS) : false,
  }
}
