import type { PricePoint } from '../components/priceChartModel.ts'
import {
  STUDY_PRICE_JITTER,
  STUDY_PRICE_OSCILLATORS,
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

const OPEN_SECOND = Math.floor(STUDY_ROUND_ELAPSED_AT_OPEN_MS / POINT_INTERVAL_MS)

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

const createNoise = (seed: string, length: number) => {
  const random = createSeededRandom(hashSeed(seed))
  const values = Array.from({ length }, () => random() - 0.5)

  return values
}

/**
 * Ruído por segundo do trecho anterior à abertura. O último valor é zerado para
 * a série chegar exatamente em US$80.012,40 no instante em que a tarefa abre.
 */
const createRipple = (seed: string) => {
  const values = createNoise(seed, OPEN_SECOND + 1)
    .map((value) => value * 2 * RIPPLE_AMPLITUDE)

  values[values.length - 1] = 0
  return values
}

/** Ruído do trecho ao vivo. O primeiro valor é zerado pelo mesmo motivo. */
const createLiveJitter = (seed: string, length: number) => {
  const values = createNoise(seed, length)
    .map((value) => value * 2 * STUDY_PRICE_JITTER)

  values[0] = 0
  return values
}

/**
 * Caminhada do preço depois da abertura, em dólares em torno de US$80.012,40.
 *
 * É uma soma de senoides de períodos não harmônicos, deslocadas para valer zero
 * no instante da abertura. Sendo função pura do tempo decorrido, a curva é
 * idêntica para todo participante — um filme, não um sorteio — e um ponto já
 * desenhado nunca muda de valor quando a série cresce.
 */
export const getStudyPriceDrift = (elapsedSinceOpenMs: number) => (
  STUDY_PRICE_OSCILLATORS.reduce((total, { periodMs, amplitude, phase }) => {
    const angle = (2 * Math.PI * elapsedSinceOpenMs) / periodMs + phase

    return total + amplitude * (Math.sin(angle) - Math.sin(phase))
  }, 0)
)

export interface StudyPriceNoise {
  ripple: readonly number[]
  jitter: readonly number[]
}

export const createStudyPriceNoise = (
  seed: string,
  liveSeconds: number,
): StudyPriceNoise => ({
  ripple: createRipple(`${seed}-ripple`),
  jitter: createLiveJitter(`${seed}-jitter`, Math.max(1, liveSeconds + 1)),
})

/**
 * Valor da série num instante da rodada, contado do início dela.
 *
 * Antes da abertura, as oito âncoras de `STUDY_PRICE_POINTS` são esticadas sobre
 * os cinco minutos anteriores. Depois, o preço passa a caminhar. Os dois trechos
 * se encontram exatamente em US$80.012,40, então a emenda não produz degrau e a
 * primeira tela é sempre a mesma para todo mundo.
 */
export const getStudyPriceAt = (
  elapsedMs: number,
  noise: StudyPriceNoise,
): number => {
  if (elapsedMs < STUDY_ROUND_ELAPSED_AT_OPEN_MS) {
    const progress = elapsedMs / STUDY_ROUND_ELAPSED_AT_OPEN_MS
    const index = Math.min(
      noise.ripple.length - 1,
      Math.max(0, Math.floor(elapsedMs / POINT_INTERVAL_MS)),
    )

    return Math.round(
      (interpolateAnchors(progress) + noise.ripple[index]) * 100,
    ) / 100
  }

  const sinceOpenMs = elapsedMs - STUDY_ROUND_ELAPSED_AT_OPEN_MS
  const index = Math.min(
    noise.jitter.length - 1,
    Math.max(0, Math.floor(sinceOpenMs / POINT_INTERVAL_MS)),
  )
  const value = STUDY_VALUES.initialCurrentPrice
    + getStudyPriceDrift(sinceOpenMs)
    + noise.jitter[index]

  return Math.round(value * 100) / 100
}

/** Série da rodada corrente, de um ponto por segundo. */
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
  const noise = createStudyPriceNoise(seed, count)

  return Array.from({ length: count }, (_, index) => {
    const offsetMs = index * POINT_INTERVAL_MS

    return {
      timestamp: roundStart + offsetMs,
      value: getStudyPriceAt(offsetMs, noise),
    }
  })
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
  const roundSeries = buildStudyRoundSeries(roundStart, virtualNow, seed)

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
