import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { PricePoint } from '../components/PriceChart'
import {
  appendRollingPricePoint,
  appendRoundPricePoint,
  mergePricePointSeries,
} from '../components/priceChartModel'
import {
  BTC_DISPLAY_TIME_ZONE,
  BTC_ROUND_DURATION_MS,
  fetchBtcMinutePoints,
  fetchBtcRoundMinutePoints,
  fetchBtcRoundTarget,
  fetchPreviousBtcRounds,
  getBtcRoundSlug,
  getBtcRoundStart,
  getPreviousBtcRoundStarts,
  type HistoricalBtcRound,
} from '../services/marketData'
import {
  deserializeMarketRoundCache,
  MARKET_ROUND_CACHE_KEY,
  serializeMarketRoundCache,
  upsertCachedMarketRound,
  type BtcPriceSource,
  type CachedMarketRound,
  type RoundDataSource,
} from '../services/marketFallback'
import { useBtcPriceFeeds } from './useBtcPriceFeeds'

export type MarketDataStatus =
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'stale'
  | 'unavailable'

const MAX_HISTORY_POINTS = BTC_ROUND_DURATION_MS / 1000 + 1
const RANGE_HISTORY_DURATION_MS = 60 * 60_000
const MAX_RANGE_HISTORY_POINTS = RANGE_HISTORY_DURATION_MS / 1000 + 1
const ROUND_BACKFILL_RETRY_DELAYS_MS = [2_000, 5_000, 15_000]
const CLOCK_INTERVAL_MS = 250
const TARGET_FALLBACK_DELAY_MS = 3_000
const TARGET_FALLBACK_RETRY_MS = 250
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

export type BtcMarketRoundState = {
  now: number
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
  currentPriceSource: BtcPriceSource | null
  targetSource: RoundDataSource | null
  points: PricePoint[]
  historyPoints: PricePoint[]
  previousRounds: HistoricalBtcRound[]
  targetStatus: MarketDataStatus
  currentStatus: MarketDataStatus
  previousRoundsStatus: MarketDataStatus
}

const readRoundCache = () => {
  if (typeof window === 'undefined') return []
  return deserializeMarketRoundCache(
    window.localStorage.getItem(MARKET_ROUND_CACHE_KEY),
  )
}

const isPositivePrice = (value: number | null): value is number => (
  value !== null && Number.isFinite(value) && value > 0
)

const toHistoricalRound = (
  round: CachedMarketRound,
): HistoricalBtcRound | null => {
  if (!isPositivePrice(round.finalPrice)) return null

  return {
    id: getBtcRoundSlug(round.roundStart),
    roundStart: round.roundStart,
    roundEnd: round.roundStart + BTC_ROUND_DURATION_MS,
    targetPrice: round.targetPrice,
    finalPrice: round.finalPrice,
    result: round.result ?? (round.finalPrice > round.targetPrice ? 'up' : 'down'),
  }
}

const hasForcedBackfillFailure = () => {
  if (!import.meta.env.DEV) return false

  return new URLSearchParams(window.location.search)
    .get('testDataFailure')
    ?.split(',')
    .map((value) => value.trim().toLowerCase())
    .includes('backfill') ?? false
}

const hasForcedFailure = (failure: string) => {
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

export function useResilientBtcMarketRound(): BtcMarketRoundState {
  const [now, setNow] = useState(() => Date.now())
  const roundStart = getBtcRoundStart(now)
  const roundEnd = roundStart + BTC_ROUND_DURATION_MS
  const priceFeed = useBtcPriceFeeds(roundStart, now)
  const [targetData, setTargetData] = useState<{
    roundStart: number
    price: number | null
    status: MarketDataStatus
    source: RoundDataSource | null
  }>(() => ({
    roundStart,
    price: null,
    status: 'connecting',
    source: null,
  }))
  const [pointSeries, setPointSeries] = useState<{
    roundStart: number
    points: PricePoint[]
  }>(() => ({ roundStart, points: [] }))
  const [initialRoundStart] = useState(roundStart)
  const [backfillSeries, setBackfillSeries] = useState<{
    roundStart: number
    points: PricePoint[]
  }>(() => ({ roundStart, points: [] }))
  const [observedHistoryPoints, setObservedHistoryPoints] = useState<PricePoint[]>([])
  const [rangeBackfillPoints, setRangeBackfillPoints] = useState<PricePoint[]>([])
  const [officialPreviousRounds, setOfficialPreviousRounds] = useState<
    HistoricalBtcRound[]
  >([])
  const [previousRoundsStatus, setPreviousRoundsStatus] = useState<MarketDataStatus>(
    'connecting',
  )
  const [previousRoundsRefreshSequence, setPreviousRoundsRefreshSequence] = useState(0)
  const [rangeHistoryRefreshSequence, setRangeHistoryRefreshSequence] = useState(0)
  const [cachedRounds, setCachedRounds] = useState<CachedMarketRound[]>(
    readRoundCache,
  )
  const cachedRoundsRef = useRef(cachedRounds)
  const priceFeedRef = useRef(priceFeed)
  const roundSnapshotRef = useRef({
    roundStart,
    targetPrice: null as number | null,
    currentPrice: null as number | null,
  })

  const updateRoundCache = useCallback((
    update: (current: CachedMarketRound[]) => CachedMarketRound[],
  ) => {
    setCachedRounds((current) => {
      const next = update(current)
      cachedRoundsRef.current = next
      return next
    })
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS)
    let syncFrame = 0

    const syncWithWallClock = () => {
      window.cancelAnimationFrame(syncFrame)
      syncFrame = window.requestAnimationFrame(() => {
        setNow(Date.now())
        setPreviousRoundsRefreshSequence((current) => current + 1)
        setRangeHistoryRefreshSequence((current) => current + 1)
      })
    }
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') syncWithWallClock()
    }

    window.addEventListener('focus', syncWithWallClock)
    window.addEventListener('pageshow', syncWithWallClock)
    document.addEventListener('visibilitychange', syncWhenVisible)

    return () => {
      window.clearInterval(timer)
      window.cancelAnimationFrame(syncFrame)
      window.removeEventListener('focus', syncWithWallClock)
      window.removeEventListener('pageshow', syncWithWallClock)
      document.removeEventListener('visibilitychange', syncWhenVisible)
    }
  }, [])

  useEffect(() => {
    priceFeedRef.current = priceFeed
  }, [priceFeed])

  useEffect(() => {
    cachedRoundsRef.current = cachedRounds
    window.localStorage.setItem(
      MARKET_ROUND_CACHE_KEY,
      serializeMarketRoundCache(cachedRounds),
    )
  }, [cachedRounds])

  useEffect(() => {
    const syncRoundCache = (event: StorageEvent) => {
      if (event.key !== MARKET_ROUND_CACHE_KEY) return
      const next = deserializeMarketRoundCache(event.newValue)
      cachedRoundsRef.current = next
      setCachedRounds(next)
    }

    window.addEventListener('storage', syncRoundCache)
    return () => window.removeEventListener('storage', syncRoundCache)
  }, [])

  useEffect(() => {
    if (!isPositivePrice(priceFeed.value) || priceFeed.updatedAt === null) return

    const timestamp = Math.max(roundStart, priceFeed.updatedAt)
    const value = priceFeed.value

    const updateFrame = window.requestAnimationFrame(() => {
      setPointSeries((current) => {
        const isNewRound = current.roundStart !== roundStart
        const startingPoints = isNewRound
          ? [{ timestamp: roundStart, value }]
          : current.points
        const nextPoints = appendRoundPricePoint(
          startingPoints,
          { timestamp, value },
          roundStart,
          MAX_HISTORY_POINTS,
        )

        if (
          !isNewRound
          && nextPoints.length === current.points.length
          && nextPoints.every((point, index) => point === current.points[index])
        ) return current

        return { roundStart, points: nextPoints }
      })
      setObservedHistoryPoints((current) => appendRollingPricePoint(
        current,
        { timestamp, value },
        timestamp - RANGE_HISTORY_DURATION_MS,
        MAX_RANGE_HISTORY_POINTS,
      ))
    })

    return () => window.cancelAnimationFrame(updateFrame)
  }, [priceFeed.updatedAt, priceFeed.value, roundStart])

  useEffect(() => {
    const controller = new AbortController()
    let retryTimer = 0
    let retryIndex = 0
    let disposed = false

    const loadRoundBackfill = async () => {
      try {
        if (hasForcedBackfillFailure()) throw new Error('forced backfill failure')

        const points = await fetchBtcRoundMinutePoints(
          roundStart,
          Date.now(),
          controller.signal,
        )
        if (disposed || points.length === 0) return

        setBackfillSeries({ roundStart, points })
      } catch {
        if (disposed || controller.signal.aborted) return
        if (retryIndex >= ROUND_BACKFILL_RETRY_DELAYS_MS.length) return

        const retryDelay = ROUND_BACKFILL_RETRY_DELAYS_MS[retryIndex]
        retryIndex += 1
        retryTimer = window.setTimeout(() => void loadRoundBackfill(), retryDelay)
      }
    }

    void loadRoundBackfill()

    return () => {
      disposed = true
      controller.abort()
      window.clearTimeout(retryTimer)
    }
  }, [roundStart])

  useEffect(() => {
    const controller = new AbortController()
    let retryTimer = 0
    let retryIndex = 0
    let disposed = false
    const requestedAt = Date.now()

    const loadRangeBackfill = async () => {
      try {
        if (hasForcedBackfillFailure()) throw new Error('forced backfill failure')

        const points = await fetchBtcMinutePoints(
          requestedAt - RANGE_HISTORY_DURATION_MS,
          requestedAt,
          controller.signal,
        )
        if (disposed || points.length === 0) return

        setRangeBackfillPoints(points)
      } catch {
        if (disposed || controller.signal.aborted) return
        if (retryIndex >= ROUND_BACKFILL_RETRY_DELAYS_MS.length) return

        const retryDelay = ROUND_BACKFILL_RETRY_DELAYS_MS[retryIndex]
        retryIndex += 1
        retryTimer = window.setTimeout(() => void loadRangeBackfill(), retryDelay)
      }
    }

    void loadRangeBackfill()

    return () => {
      disposed = true
      controller.abort()
      window.clearTimeout(retryTimer)
    }
  }, [rangeHistoryRefreshSequence, roundStart])

  useEffect(() => {
    const previousSnapshot = roundSnapshotRef.current
    const targetForCurrentRound = targetData.roundStart === roundStart
      ? targetData.price
      : null

    if (previousSnapshot.roundStart !== roundStart) {
      const completedTarget = previousSnapshot.targetPrice
      const completedFinal = previousSnapshot.currentPrice
      if (
        isPositivePrice(completedTarget)
        && isPositivePrice(completedFinal)
      ) {
        updateRoundCache((current) => upsertCachedMarketRound(current, {
          roundStart: previousSnapshot.roundStart,
          targetPrice: completedTarget,
          finalPrice: completedFinal,
          result: completedFinal > completedTarget ? 'up' : 'down',
          source: current.find(
            ({ roundStart: cachedStart }) => cachedStart === previousSnapshot.roundStart,
          )?.source ?? 'local',
        }))
      }

      roundSnapshotRef.current = {
        roundStart,
        targetPrice: targetForCurrentRound,
        currentPrice: priceFeed.value,
      }
      return
    }

    if (isPositivePrice(targetForCurrentRound)) {
      previousSnapshot.targetPrice = targetForCurrentRound
    }
    if (isPositivePrice(priceFeed.value)) {
      previousSnapshot.currentPrice = priceFeed.value
    }
  }, [
    priceFeed.value,
    roundStart,
    targetData.price,
    targetData.roundStart,
    updateRoundCache,
  ])

  useEffect(() => {
    const cachedCurrentRound = cachedRoundsRef.current.find(
      ({ roundStart: cachedStart }) => cachedStart === roundStart,
    )
    if (cachedCurrentRound) {
      setTargetData({
        roundStart,
        price: cachedCurrentRound.targetPrice,
        status: 'live',
        source: cachedCurrentRound.source,
      })
      return undefined
    }

    const previousRoundFinal = cachedRoundsRef.current.find(
      ({ roundStart: cachedStart }) => (
        cachedStart === roundStart - BTC_ROUND_DURATION_MS
      ),
    )?.finalPrice ?? null
    const provisionalPrice = isPositivePrice(previousRoundFinal)
      ? previousRoundFinal
      : priceFeedRef.current.value
    const controller = new AbortController()
    let retryTimer = 0
    let fallbackTimer = 0
    let retryIndex = 0
    let lockedLocally = false
    let disposed = false

    setTargetData({
      roundStart,
      price: provisionalPrice,
      status: 'connecting',
      source: provisionalPrice === null ? null : 'local',
    })

    const lockLocalTarget = () => {
      if (disposed || lockedLocally) return

      const fallbackPrice = priceFeedRef.current.value ?? previousRoundFinal
      if (!isPositivePrice(fallbackPrice)) {
        fallbackTimer = window.setTimeout(
          lockLocalTarget,
          TARGET_FALLBACK_RETRY_MS,
        )
        return
      }

      lockedLocally = true
      setTargetData({
        roundStart,
        price: fallbackPrice,
        status: 'live',
        source: 'local',
      })
      updateRoundCache((current) => upsertCachedMarketRound(current, {
        roundStart,
        targetPrice: fallbackPrice,
        finalPrice: null,
        result: null,
        source: 'local',
      }))
    }

    const loadTarget = async () => {
      try {
        if (hasForcedFailure('target')) throw new Error('forced target failure')
        const nextTargetPrice = await fetchBtcRoundTarget(
          roundStart,
          controller.signal,
        )
        if (disposed || lockedLocally) return

        window.clearTimeout(fallbackTimer)
        setTargetData({
          roundStart,
          price: nextTargetPrice,
          status: 'live',
          source: 'polymarket',
        })
        updateRoundCache((current) => upsertCachedMarketRound(current, {
          roundStart,
          targetPrice: nextTargetPrice,
          finalPrice: null,
          result: null,
          source: 'polymarket',
        }))
      } catch {
        if (disposed || controller.signal.aborted || lockedLocally) return

        const retryDelay = TARGET_RETRY_DELAYS_MS[
          Math.min(retryIndex, TARGET_RETRY_DELAYS_MS.length - 1)
        ]
        retryIndex += 1
        retryTimer = window.setTimeout(loadTarget, retryDelay)
      }
    }

    fallbackTimer = window.setTimeout(lockLocalTarget, TARGET_FALLBACK_DELAY_MS)
    void loadTarget()

    return () => {
      disposed = true
      controller.abort()
      window.clearTimeout(retryTimer)
      window.clearTimeout(fallbackTimer)
    }
  }, [roundStart, updateRoundCache])

  useEffect(() => {
    const controller = new AbortController()
    let retryTimer = 0
    let retryIndex = 0
    let disposed = false

    const loadPreviousRounds = async () => {
      try {
        if (hasForcedFailure('history')) throw new Error('forced history failure')
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

        if (rounds.length > 0) {
          setOfficialPreviousRounds(rounds)
          updateRoundCache((current) => rounds.reduce((cached, official) => {
            const existing = cached.find(
              ({ roundStart: cachedStart }) => cachedStart === official.roundStart,
            )
            if (existing?.source === 'local' && existing.finalPrice !== null) {
              return cached
            }

            return upsertCachedMarketRound(cached, {
              roundStart: official.roundStart,
              targetPrice: official.targetPrice,
              finalPrice: official.finalPrice,
              result: official.result,
              source: 'polymarket',
            })
          }, current))
        }
        setPreviousRoundsStatus(isComplete ? 'live' : 'reconnecting')

        if (!isComplete) {
          const retryDelay = PREVIOUS_ROUNDS_RETRY_DELAYS_MS[
            Math.min(retryIndex, PREVIOUS_ROUNDS_RETRY_DELAYS_MS.length - 1)
          ]
          retryIndex += 1
          retryTimer = window.setTimeout(
            () => void loadPreviousRounds(),
            retryDelay,
          )
        }
      } catch {
        if (disposed || controller.signal.aborted) return

        setPreviousRoundsStatus('reconnecting')
        retryTimer = window.setTimeout(
          () => void loadPreviousRounds(),
          5_000,
        )
      }
    }

    void loadPreviousRounds()

    return () => {
      disposed = true
      controller.abort()
      window.clearTimeout(retryTimer)
    }
  }, [previousRoundsRefreshSequence, roundStart, updateRoundCache])

  const previousRounds = useMemo(() => {
    const byRoundStart = new Map<number, HistoricalBtcRound>()
    const expectedStarts = getPreviousBtcRoundStarts(
      roundStart,
      PREVIOUS_ROUNDS_COUNT,
    )

    cachedRounds.forEach((round) => {
      const historical = toHistoricalRound(round)
      if (historical) byRoundStart.set(historical.roundStart, historical)
    })
    officialPreviousRounds.forEach((round) => {
      if (!byRoundStart.has(round.roundStart)) {
        byRoundStart.set(round.roundStart, round)
      }
    })

    return expectedStarts.flatMap((expectedStart) => {
      const round = byRoundStart.get(expectedStart)
      return round ? [round] : []
    })
  }, [cachedRounds, officialPreviousRounds, roundStart])

  const remainingSeconds = Math.max(0, Math.ceil((roundEnd - now) / 1000))
  const isTargetForCurrentRound = targetData.roundStart === roundStart
  const currentStatus: MarketDataStatus = priceFeed.isFresh
    ? 'live'
    : priceFeed.value === null
      ? 'connecting'
      : 'stale'
  const seriesPoints = useMemo(() => {
    const currentRoundPoints = pointSeries.roundStart === roundStart
      ? pointSeries.points
      : []
    const roundBackfillPoints = backfillSeries.roundStart === roundStart
      ? backfillSeries.points
      : []

    if (roundBackfillPoints.length === 0) return currentRoundPoints

    const livePoints = roundStart === initialRoundStart
      ? currentRoundPoints.filter(({ timestamp }) => timestamp !== roundStart)
      : currentRoundPoints
    const firstLiveTimestamp = livePoints[0]?.timestamp
      ?? Number.POSITIVE_INFINITY

    return [
      ...roundBackfillPoints.filter(
        ({ timestamp }) => timestamp < firstLiveTimestamp,
      ),
      ...livePoints,
    ]
  }, [backfillSeries, initialRoundStart, pointSeries, roundStart])
  const visiblePoints = seriesPoints.length > 0
    ? seriesPoints
    : !isPositivePrice(priceFeed.value)
      ? []
      : [{
          timestamp: Math.max(roundStart, priceFeed.updatedAt ?? now),
          value: priceFeed.value,
        }]
  const historyPoints = useMemo(() => {
    const earliestTimestamp = now - RANGE_HISTORY_DURATION_MS
    const mergedPoints = mergePricePointSeries(
      rangeBackfillPoints,
      observedHistoryPoints,
      earliestTimestamp,
    )

    if (mergedPoints.length > 0) return mergedPoints
    if (!isPositivePrice(priceFeed.value)) return []

    return [{
      timestamp: Math.max(earliestTimestamp, priceFeed.updatedAt ?? now),
      value: priceFeed.value,
    }]
  }, [now, observedHistoryPoints, priceFeed.updatedAt, priceFeed.value, rangeBackfillPoints])

  return {
    now,
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
    currentPrice: priceFeed.value,
    currentPriceUpdatedAt: priceFeed.updatedAt,
    currentPriceSource: priceFeed.source,
    targetSource: isTargetForCurrentRound ? targetData.source : null,
    points: visiblePoints,
    historyPoints,
    previousRounds,
    targetStatus: isTargetForCurrentRound ? targetData.status : 'connecting',
    currentStatus,
    previousRoundsStatus: previousRounds.length === PREVIOUS_ROUNDS_COUNT
      ? 'live'
      : previousRoundsStatus,
  }
}
