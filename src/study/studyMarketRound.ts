import { useEffect, useMemo, useState } from 'react'
import type { PricePoint } from '../components/priceChartModel.ts'
import {
  STUDY_FLOOR_REMAINING_MS,
  STUDY_INITIAL_REMAINING_MS,
  STUDY_ROUND_DURATION_MS,
  STUDY_TIME_ZONE,
  STUDY_VALUES,
} from './studyConfig.ts'
import { buildStudyPreviousRounds } from './studyPreviousRounds.ts'
import {
  buildStudyHistorySeries,
  buildStudyRoundSeries,
  createStudyPriceNoise,
  getStudyPriceAt,
} from './studyPriceSeries.ts'
import { getStudyRoundStart } from './studyScenarios.ts'
import type { StudyPreviousRound, StudyScenario } from './studyTypes.ts'

const CLOCK_INTERVAL_MS = 250

/** Única origem de dados desta cópia. Nenhum serviço de mercado é consultado. */
export type StudyDataSource = 'study'

export interface StudyMarketRoundState {
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
  targetPrice: number
  currentPrice: number
  currentPriceUpdatedAt: number
  currentPriceSource: StudyDataSource
  targetSource: StudyDataSource
  points: PricePoint[]
  historyPoints: PricePoint[]
  previousRounds: StudyPreviousRound[]
  targetStatus: 'live'
  currentStatus: 'live'
  previousRoundsStatus: 'live'
}

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  timeZone: STUDY_TIME_ZONE,
})
const timeFormatter = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: STUDY_TIME_ZONE,
})

/**
 * Relógio virtual da tarefa, único para o contador e para o mercado.
 *
 * A rodada tem 15 minutos conceituais e a pessoa entra com catorze restantes. O
 * contador avança normalmente e só para faltando um minuto: nenhuma rodada pode
 * virar durante uma missão do Maze, senão o cenário se reiniciaria no meio da
 * compra e o participante veria números diferentes dos que a tarefa descreve.
 *
 * Contador e mercado compartilham este relógio de propósito. Separá-los abriria
 * a chance de o gráfico desenhar um ponto num instante que o cabeçalho não
 * reconhece; com um relógio só, o último ponto da série está sempre exatamente
 * a um minuto do fim da rodada, que é o que o contador afirma.
 */
export const getStudyElapsedInRoundMs = (
  openedAt: number,
  now: number,
): number => Math.min(
  STUDY_ROUND_DURATION_MS
  - STUDY_INITIAL_REMAINING_MS
  + Math.max(0, now - openedAt),
  STUDY_ROUND_DURATION_MS - STUDY_FLOOR_REMAINING_MS,
)

export const getStudyRemainingSeconds = (
  openedAt: number,
  now: number,
): number => Math.ceil(
  (STUDY_ROUND_DURATION_MS - getStudyElapsedInRoundMs(openedAt, now)) / 1000,
)

export const buildStudyMarketRound = (
  scenario: StudyScenario,
  now: number,
): StudyMarketRoundState => {
  const roundStart = getStudyRoundStart(scenario.openedAt)
  const roundEnd = roundStart + STUDY_ROUND_DURATION_MS
  const elapsedMs = getStudyElapsedInRoundMs(scenario.openedAt, now)
  const virtualNow = roundStart + elapsedMs
  const remainingSeconds = getStudyRemainingSeconds(scenario.openedAt, now)
  const points = buildStudyRoundSeries(roundStart, virtualNow, scenario.id)
  // O preço exibido é o último ponto da série, e não um valor calculado à
  // parte: a ponta do gráfico, a etiqueta e o card `Precio actual` precisam
  // concordar em todo quadro.
  const currentPrice = points.at(-1)?.value
    ?? getStudyPriceAt(elapsedMs, createStudyPriceNoise(scenario.id, 1))

  return {
    now: virtualNow,
    roundStart,
    roundEnd,
    roundSlug: `study-15m-${scenario.task}`,
    date: dateFormatter.format(roundStart),
    startTime: timeFormatter.format(roundStart),
    endTime: timeFormatter.format(roundEnd),
    minutes: String(Math.floor(remainingSeconds / 60)).padStart(2, '0'),
    seconds: String(remainingSeconds % 60).padStart(2, '0'),
    remainingSeconds,
    targetPrice: scenario.market.targetPrice,
    currentPrice,
    currentPriceUpdatedAt: virtualNow,
    currentPriceSource: 'study',
    targetSource: 'study',
    points,
    historyPoints: buildStudyHistorySeries(roundStart, virtualNow, scenario.id),
    previousRounds: buildStudyPreviousRounds(roundStart),
    targetStatus: 'live',
    currentStatus: 'live',
    previousRoundsStatus: 'live',
  }
}

export function useStudyMarketRound(
  scenario: StudyScenario,
): StudyMarketRoundState {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      CLOCK_INTERVAL_MS,
    )

    return () => window.clearInterval(timer)
  }, [])

  // A série tem um ponto por segundo, então recalcular a cada 250ms produziria
  // a mesma lista e faria o gráfico remontar quatro vezes por segundo.
  const secondTick = Math.floor(now / 1_000)

  return useMemo(
    () => buildStudyMarketRound(scenario, secondTick * 1_000),
    [scenario, secondTick],
  )
}

export const STUDY_TARGET_PRICE = STUDY_VALUES.targetPrice
