import { useEffect, useRef, useState } from 'react'
import {
  createMarketPriceTrendState,
  getActiveMarketPriceDirection,
  updateMarketPriceTrend,
  type MarketPriceDirection,
} from '../services/marketPriceDirection'

export type { MarketPriceDirection } from '../services/marketPriceDirection'

type AnimatedMarketPrice = {
  value: number | null
  direction: MarketPriceDirection | null
  directionAnimationSequence: number
}

const PRICE_ANIMATION_DURATION_MS = 360
const DIRECTION_CYCLE_DURATION_MS = 740
const DIRECTION_CYCLE_PAUSE_MS = 120
const DIRECTION_LOOP_POLL_MS = 40

export function useAnimatedMarketPrice(
  targetPrice: number | null,
): AnimatedMarketPrice {
  const currentValueRef = useRef(targetPrice)
  const trendStateRef = useRef(createMarketPriceTrendState())
  const renderedDirectionRef = useRef<MarketPriceDirection | null>(null)
  const directionCycleStartedAtRef = useRef(0)
  const directionAnimationSequenceRef = useRef(0)
  const [animatedValue, setAnimatedValue] = useState(targetPrice)
  const [directionState, setDirectionState] = useState<{
    direction: MarketPriceDirection | null
    directionAnimationSequence: number
  }>({
    direction: null,
    directionAnimationSequence: 0,
  })

  useEffect(() => {
    const startValue = currentValueRef.current
    let frameId = 0

    if (
      targetPrice === null
      || startValue === null
      || startValue === targetPrice
    ) {
      currentValueRef.current = targetPrice
      setAnimatedValue(targetPrice)
      return
    }

    const startedAt = window.performance.now()

    setAnimatedValue(startValue)

    const animate = (frameTime: number) => {
      const progress = Math.min(
        1,
        (frameTime - startedAt) / PRICE_ANIMATION_DURATION_MS,
      )
      const easedProgress = 1 - (1 - progress) ** 3
      const nextValue = startValue
        + (targetPrice - startValue) * easedProgress

      currentValueRef.current = nextValue
      setAnimatedValue(nextValue)

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate)
      }
    }

    // Oculta a página, os quadros param e o valor animado congela no meio do
    // caminho. Na volta ele salta para o preço real em vez de continuar
    // suavizando a partir de um número que já não vale.
    const snapToTarget = () => {
      if (document.visibilityState !== 'visible') return

      window.cancelAnimationFrame(frameId)
      currentValueRef.current = targetPrice
      setAnimatedValue(targetPrice)
    }

    frameId = window.requestAnimationFrame(animate)
    document.addEventListener('visibilitychange', snapToTarget)

    return () => {
      document.removeEventListener('visibilitychange', snapToTarget)
      window.cancelAnimationFrame(frameId)
    }
  }, [targetPrice])

  useEffect(() => {
    if (targetPrice === null) {
      trendStateRef.current = createMarketPriceTrendState()
      renderedDirectionRef.current = null
      directionCycleStartedAtRef.current = 0
      setDirectionState({
        direction: null,
        directionAnimationSequence: directionAnimationSequenceRef.current,
      })
      return
    }

    trendStateRef.current = updateMarketPriceTrend(
      trendStateRef.current,
      targetPrice,
      window.performance.now(),
    )
  }, [targetPrice])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = window.performance.now()
      const desiredDirection = getActiveMarketPriceDirection(
        trendStateRef.current,
        now,
      )
      const elapsedSinceCycle = now - directionCycleStartedAtRef.current

      if (desiredDirection === null) {
        if (
          renderedDirectionRef.current !== null
          && elapsedSinceCycle >= DIRECTION_CYCLE_DURATION_MS
        ) {
          renderedDirectionRef.current = null
          setDirectionState({
            direction: null,
            directionAnimationSequence:
              directionAnimationSequenceRef.current,
          })
        }
        return
      }

      if (
        renderedDirectionRef.current !== null
        && elapsedSinceCycle
          < DIRECTION_CYCLE_DURATION_MS + DIRECTION_CYCLE_PAUSE_MS
      ) {
        return
      }

      renderedDirectionRef.current = desiredDirection
      directionCycleStartedAtRef.current = now
      directionAnimationSequenceRef.current += 1
      setDirectionState({
        direction: desiredDirection,
        directionAnimationSequence: directionAnimationSequenceRef.current,
      })
    }, DIRECTION_LOOP_POLL_MS)

    return () => window.clearInterval(timer)
  }, [])

  return {
    value: animatedValue,
    ...directionState,
  }
}
