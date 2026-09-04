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
 * Relógio virtual da tarefa.
 *
 * A rodada tem 15 minutos conceituais e a pessoa entra com dez restantes. O
 * contador avança normalmente e para aos cinco minutos: nenhuma rodada pode
 * virar durante uma missão do Maze, senão o cenário se reiniciaria no meio da
 * compra e o participante veria números diferentes dos que a tarefa descreve.
 */
export const getStudyElapsedInRoundMs = (
  openedAt: number,
  now: number,
): number => {
  const sinceOpen = Math.max(0, now - openedAt)
  const elapsed = STUDY_ROUND_DURATION_MS - STUDY_INITIAL_REMAINING_MS + sinceOpen

  return Math.min(
    elapsed,
    STUDY_ROUND_DURATION_MS - STUDY_FLOOR_REMAINING_MS,
  )
}

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
    currentPrice: scenario.market.currentPrice,
    currentPriceUpdatedAt: virtualNow,
    currentPriceSource: 'study',
    targetSource: 'study',
    points: buildStudyRoundSeries(roundStart, virtualNow, scenario.id),
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

  // O preço é constante durante a missão, então a série só cresce quando o
  // segundo vira. Recalcular a cada 250ms produziria a mesma lista e faria o
  // gráfico remontar quatro vezes por segundo.
  const secondTick = Math.floor(now / 1_000)

  return useMemo(
    () => buildStudyMarketRound(scenario, secondTick * 1_000),
    [scenario, secondTick],
  )
}

export const STUDY_TARGET_PRICE = STUDY_VALUES.targetPrice
