import { useEffect, useMemo, useRef, useState } from 'react'
import type { PricePoint } from '../components/PriceChart'
import {
  BTC_DISPLAY_TIME_ZONE,
  BTC_ROUND_DURATION_MS,
  fetchBtcRoundTarget,
  fetchPreviousBtcRounds,
  getBtcRoundSlug,
  getBtcRoundStart,
  type HistoricalBtcRound,
} from '../services/marketData'

export type MarketDataStatus =
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'stale'
  | 'unavailable'

const CHAINLINK_RTDS_URL = 'wss://ws-live-data.polymarket.com'
const MAX_HISTORY_POINTS = 120
const CURRENT_PRICE_STALE_MS = 10_000
const CLOCK_INTERVAL_MS = 250
const RECONNECT_DELAY_MS = 2_000
const TARGET_RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000]
const PREVIOUS_ROUNDS_COUNT = 10
const PREVIOUS_ROUNDS_RETRY_DELAYS_MS = [5_000, 10_000, 30_000]

const marketDateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  timeZone: BTC_DISPLAY_TIME_ZONE,
})
const marketTimeFormatter = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: BTC_DISPLAY_TIME_ZONE,
})

type ChainlinkMessage = {
  payload?: {
    symbol?: string
    value?: string | number
    timestamp?: number
  }
}

export type BtcMarketRoundState = {
  roundStart: number
  roundEnd: number
  roundSlug: string
  date: string
  startTime: string
  endTime: string
  minutes: string
  seconds: string
  remainingSeconds: number
  targetPrice: number | null
  currentPrice: number | null
  currentPriceUpdatedAt: number | null
  points: PricePoint[]
  previousRounds: HistoricalBtcRound[]
  targetStatus: MarketDataStatus
  currentStatus: MarketDataStatus
  previousRoundsStatus: MarketDataStatus
}

export function useBtcMarketRound(): BtcMarketRoundState {
  const [now, setNow] = useState(() => Date.now())
  const [targetData, setTargetData] = useState<{
    roundStart: number
    price: number | null
    status: MarketDataStatus
  }>(() => ({
    roundStart: getBtcRoundStart(),
    price: null,
    status: 'connecting',
  }))
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [currentPriceUpdatedAt, setCurrentPriceUpdatedAt] = useState<number | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<MarketDataStatus>('connecting')
  const [points, setPoints] = useState<PricePoint[]>([])
  const [previousRounds, setPreviousRounds] = useState<HistoricalBtcRound[]>([])
  const [previousRoundsStatus, setPreviousRoundsStatus] = useState<MarketDataStatus>('connecting')
  const [previousRoundsRefreshSequence, setPreviousRoundsRefreshSequence] = useState(0)
  const roundStart = getBtcRoundStart(now)
  const roundEnd = roundStart + BTC_ROUND_DURATION_MS
  const roundStartRef = useRef(roundStart)
  const lastChartSecondRef = useRef<number | null>(null)

  useEffect(() => {
    let resumeFrame = 0
    const syncClock = () => setNow(Date.now())
    const refreshAfterResume = () => {
      if (document.visibilityState === 'hidden') return

      window.cancelAnimationFrame(resumeFrame)
      resumeFrame = window.requestAnimationFrame(() => {
        syncClock()
        setPreviousRoundsRefreshSequence((current) => current + 1)
      })
    }
    const timer = window.setInterval(syncClock, CLOCK_INTERVAL_MS)

    document.addEventListener('visibilitychange', refreshAfterResume)
    window.addEventListener('focus', refreshAfterResume)
    window.addEventListener('pageshow', refreshAfterResume)

    return () => {
      window.clearInterval(timer)
      window.cancelAnimationFrame(resumeFrame)
      document.removeEventListener('visibilitychange', refreshAfterResume)
      window.removeEventListener('focus', refreshAfterResume)
      window.removeEventListener('pageshow', refreshAfterResume)
    }
  }, [])

  useEffect(() => {
    roundStartRef.current = roundStart
    lastChartSecondRef.current = null
  }, [roundStart])

  useEffect(() => {
    const controller = new AbortController()
    let retryTimer = 0
    let retryIndex = 0
    let disposed = false

    const loadPreviousRounds = async () => {
      const rounds = await fetchPreviousBtcRounds(
        roundStart,
        PREVIOUS_ROUNDS_COUNT,
        controller.signal,
      )

      if (disposed) return

      const hasLatestCompletedRound = rounds[0]?.roundStart
        === roundStart - BTC_ROUND_DURATION_MS
      const isComplete = rounds.length === PREVIOUS_ROUNDS_COUNT
        && hasLatestCompletedRound

      if (rounds.length > 0) setPreviousRounds(rounds)
      setPreviousRoundsStatus(isComplete ? 'live' : 'reconnecting')

      if (!isComplete) {
        const retryDelay = PREVIOUS_ROUNDS_RETRY_DELAYS_MS[
          Math.min(
            retryIndex,
            PREVIOUS_ROUNDS_RETRY_DELAYS_MS.length - 1,
          )
        ]
        retryIndex += 1
        retryTimer = window.setTimeout(loadPreviousRounds, retryDelay)
      }
    }

    void loadPreviousRounds().catch(() => {
      if (!disposed && !controller.signal.aborted) {
        setPreviousRoundsStatus('unavailable')
        retryTimer = window.setTimeout(loadPreviousRounds, 5_000)
      }
    })

    return () => {
      disposed = true
      controller.abort()
      window.clearTimeout(retryTimer)
    }
  }, [previousRoundsRefreshSequence, roundStart])

  useEffect(() => {
    const controller = new AbortController()
    let retryTimer = 0
    let retryIndex = 0
    let disposed = false

    const loadTarget = async () => {
      try {
        const nextTargetPrice = await fetchBtcRoundTarget(
          roundStart,
          controller.signal,
        )

        if (disposed) return

        setTargetData({
          roundStart,
          price: nextTargetPrice,
          status: 'live',
        })
      } catch {
        if (disposed || controller.signal.aborted) return

        setTargetData({
          roundStart,
          price: null,
          status: retryIndex === 0 ? 'unavailable' : 'reconnecting',
        })
        const retryDelay = TARGET_RETRY_DELAYS_MS[
          Math.min(retryIndex, TARGET_RETRY_DELAYS_MS.length - 1)
        ]
        retryIndex += 1
        retryTimer = window.setTimeout(loadTarget, retryDelay)
      }
    }

    void loadTarget()

    return () => {
      disposed = true
      controller.abort()
      window.clearTimeout(retryTimer)
    }
  }, [roundStart])

  useEffect(() => {
    let socket: WebSocket | null = null
    let heartbeatTimer = 0
    let reconnectTimer = 0
    let reconnectTestTimer = 0
    let disposed = false

    const clearHeartbeat = () => window.clearInterval(heartbeatTimer)
    const forceReconnectForTest = () => socket?.close(4000, 'reconnect-test')

    const connect = (isReconnect = false) => {
      if (disposed) return

      setConnectionStatus(isReconnect ? 'reconnecting' : 'connecting')
      socket = new WebSocket(CHAINLINK_RTDS_URL)

      socket.onopen = () => {
        if (disposed || !socket) return

        socket.send(JSON.stringify({
          action: 'subscribe',
          subscriptions: [
            {
              topic: 'crypto_prices_twap_sixty',
              type: 'update',
              filters: '{"symbol":"btc/usd"}',
            },
          ],
        }))
        clearHeartbeat()
        heartbeatTimer = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) socket.send('PING')
        }, 5_000)
      }

      socket.onmessage = (event) => {
        if (disposed || event.data === 'PONG') return

        try {
          const message = JSON.parse(String(event.data)) as ChainlinkMessage
          const symbol = message.payload?.symbol?.toLowerCase()
          const value = Number(message.payload?.value)

          if (symbol !== 'btc/usd' || !Number.isFinite(value) || value <= 0) {
            return
          }

          const receivedAt = Date.now()
          const chartSecond = Math.floor(receivedAt / 1000)

          setCurrentPrice(value)
          setCurrentPriceUpdatedAt(receivedAt)
          setConnectionStatus('live')

          if (
            receivedAt >= roundStartRef.current
            && chartSecond !== lastChartSecondRef.current
          ) {
            lastChartSecondRef.current = chartSecond
            setPoints((current) => [
              ...current,
              { timestamp: receivedAt, value },
            ].slice(-MAX_HISTORY_POINTS))
          }
        } catch {
          // RTDS também pode enviar confirmações de controle que não são JSON.
        }
      }

      socket.onerror = () => {
        if (!disposed) setConnectionStatus('reconnecting')
      }

      socket.onclose = () => {
        clearHeartbeat()
        if (disposed) return

        setConnectionStatus('reconnecting')
        reconnectTimer = window.setTimeout(
          () => connect(true),
          RECONNECT_DELAY_MS,
        )
      }
    }

    connect()
    const reconnectTestDelay = Number(
      new URLSearchParams(window.location.search).get('testMarketReconnect'),
    )
    if (
      import.meta.env.DEV
      && Number.isFinite(reconnectTestDelay)
      && reconnectTestDelay > 0
    ) {
      reconnectTestTimer = window.setTimeout(
        forceReconnectForTest,
        reconnectTestDelay,
      )
    }

    return () => {
      disposed = true
      clearHeartbeat()
      window.clearTimeout(reconnectTimer)
      window.clearTimeout(reconnectTestTimer)
      socket?.close()
    }
  }, [])

  const currentStatus = useMemo<MarketDataStatus>(() => {
    if (connectionStatus !== 'live') return connectionStatus
    if (
      currentPriceUpdatedAt === null
      || now - currentPriceUpdatedAt > CURRENT_PRICE_STALE_MS
    ) {
      return 'stale'
    }

    return 'live'
  }, [connectionStatus, currentPriceUpdatedAt, now])
  const remainingSeconds = Math.max(0, Math.ceil((roundEnd - now) / 1000))
  const isTargetForCurrentRound = targetData.roundStart === roundStart
  const visibleCurrentPrice = currentStatus === 'live' ? currentPrice : null
  const currentRoundPoints = points.filter(
    ({ timestamp }) => timestamp >= roundStart,
  )
  const visiblePoints = currentRoundPoints.length > 0
    ? currentRoundPoints
    : visibleCurrentPrice === null
      ? []
      : [{ timestamp: roundStart, value: visibleCurrentPrice }]

  return {
    roundStart,
    roundEnd,
    roundSlug: getBtcRoundSlug(roundStart),
    date: marketDateFormatter.format(roundStart),
    startTime: marketTimeFormatter.format(roundStart),
    endTime: marketTimeFormatter.format(roundEnd),
    minutes: String(Math.floor(remainingSeconds / 60)).padStart(2, '0'),
    seconds: String(remainingSeconds % 60).padStart(2, '0'),
    remainingSeconds,
    targetPrice: isTargetForCurrentRound ? targetData.price : null,
    currentPrice: visibleCurrentPrice,
    currentPriceUpdatedAt,
    points: visiblePoints,
    previousRounds,
    targetStatus: isTargetForCurrentRound ? targetData.status : 'connecting',
    currentStatus,
    previousRoundsStatus,
  }
}
