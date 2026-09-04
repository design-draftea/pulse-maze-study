import type { PricePoint } from '../components/priceChartModel.ts'
import {
  STUDY_PRICE_POINTS,
  STUDY_ROUND_DURATION_MS,
  STUDY_ROUND_ELAPSED_AT_OPEN_MS,
  STUDY_VALUES,
} from './studyConfig.ts'
import { createSeededRandom, hashSeed } from './studyRandom.ts'

const POINT_INTERVAL_MS = 1_000
const HISTORY_INTERVAL_MS = 60_000
const HISTORY_SPAN_MS = 60 * 60 * 1000
/** Amplitude da ondulação determinística entre duas âncoras, em dólares. */
const RIPPLE_AMPLITUDE = 0.9

const interpolateAnchors = (progress: number) => {
  const anchors = STUDY_PRICE_POINTS
  const lastIndex = anchors.length - 1
  const scaled = Math.min(Math.max(progress, 0), 1) * lastIndex
  const lowerIndex = Math.min(Math.floor(scaled), lastIndex - 1)
  const localProgress = scaled - lowerIndex
  const lower = anchors[lowerIndex]
  const upper = anchors[lowerIndex + 1]

  return lower + (upper - lower) * localProgress
}

/**
 * Valor da série num instante do trecho observado.
 *
 * As oito âncoras de `STUDY_PRICE_POINTS` são esticadas sobre os cinco minutos
 * que antecedem a abertura da tarefa, e uma ondulação de amplitude fixa —
 * sorteada por um gerador com semente, portanto igual para todo mundo — quebra
 * a linha reta entre elas. O último ponto é fixado no preço atual para a ponta
 * do gráfico, a etiqueta e o card `Precio actual` nunca discordarem.
 */
export const getStudyPriceAt = (
  elapsedMs: number,
  ripple: readonly number[],
): number => {
  if (elapsedMs >= STUDY_ROUND_ELAPSED_AT_OPEN_MS) {
    return STUDY_VALUES.initialCurrentPrice
  }

  const progress = elapsedMs / STUDY_ROUND_ELAPSED_AT_OPEN_MS
  const index = Math.min(
    ripple.length - 1,
    Math.max(0, Math.floor(elapsedMs / POINT_INTERVAL_MS)),
  )

  return Math.round((interpolateAnchors(progress) + ripple[index]) * 100) / 100
}

const createRipple = (seed: string, length: number) => {
  const random = createSeededRandom(hashSeed(seed))

  return Array.from(
    { length },
    () => (random() - 0.5) * 2 * RIPPLE_AMPLITUDE,
  )
}

/**
 * Série da rodada corrente, de um ponto por segundo. Depois da abertura da
 * tarefa o preço permanece em US$80.012,40: as cotações precisam ficar estáveis
 * durante a missão, e um preço que se move sozinho mudaria o ganho potencial
 * enquanto a pessoa lê a tela.
 */
export const buildStudyRoundSeries = (
  roundStart: number,
  virtualNow: number,
  seed = 'study-round',
): PricePoint[] => {
  const elapsedMs = Math.max(
    0,
    Math.min(virtualNow - roundStart, STUDY_ROUND_DURATION_MS),
  )
  const count = Math.floor(elapsedMs / POINT_INTERVAL_MS) + 1
  const ripple = createRipple(
    seed,
    Math.floor(STUDY_ROUND_ELAPSED_AT_OPEN_MS / POINT_INTERVAL_MS) + 1,
  )
  const points = Array.from({ length: count }, (_, index) => {
    const offsetMs = index * POINT_INTERVAL_MS

    return {
      timestamp: roundStart + offsetMs,
      value: getStudyPriceAt(offsetMs, ripple),
    }
  })

  const lastPoint = points.at(-1)
  if (lastPoint && lastPoint.timestamp !== roundStart + elapsedMs) {
    points.push({
      timestamp: roundStart + elapsedMs,
      value: getStudyPriceAt(elapsedMs, ripple),
    })
  }

  return points
}

/**
 * Última hora em resolução de um minuto, para os ranges `5M`, `15M` e `1H`.
 * Atravessa as rodadas anteriores com a mesma semente, então a forma também é
 * idêntica entre participantes.
 */
export const buildStudyHistorySeries = (
  roundStart: number,
  virtualNow: number,
  seed = 'study-history',
): PricePoint[] => {
  const start = virtualNow - HISTORY_SPAN_MS
  const count = Math.floor(HISTORY_SPAN_MS / HISTORY_INTERVAL_MS) + 1
  const random = createSeededRandom(hashSeed(seed))
  const drift = Array.from({ length: count }, () => (random() - 0.5) * 18)
  const roundSeries = buildStudyRoundSeries(roundStart, virtualNow)

  const history = Array.from({ length: count }, (_, index) => {
    const timestamp = start + index * HISTORY_INTERVAL_MS
    const progress = index / Math.max(1, count - 1)
    // A hora anterior converge para a âncora inicial da rodada corrente, então
    // a emenda entre as duas séries não produz um degrau.
    const base = STUDY_PRICE_POINTS[0]
      + (STUDY_VALUES.initialCurrentPrice - STUDY_PRICE_POINTS[0]) * progress

    return {
      timestamp,
      value: Math.round((base + drift[index]) * 100) / 100,
    }
  }).filter(({ timestamp }) => timestamp < roundStart)

  return [...history, ...roundSeries]
}
