import {
  deserializeWalletState,
  type PrototypeWalletState,
} from '../services/prototypeWallet.ts'
import {
  STUDY_ROUND_ELAPSED_AT_OPEN_MS,
  STUDY_TASKS,
  STUDY_VALUES,
} from './studyConfig.ts'
import {
  STUDY_DEBUG_PARAM,
  STUDY_MAZE_STEP_PARAM,
  STUDY_RESET_PARAM,
  STUDY_TASK_PARAM,
} from './studyMazeNavigation.ts'
import {
  readStudyJson,
  readStudyTask,
  removeStudyValue,
  resetStudyStorage,
  STUDY_STORAGE_KEYS,
  writeStudyJson,
  writeStudyTask,
  writeStudyValue,
} from './studyStorage.ts'
import { createStudyWalletState } from './studyWalletSeeds.ts'
import type {
  StudyScenario,
  StudySection,
  StudyTask,
} from './studyTypes.ts'

export const isStudyTask = (value: unknown): value is StudyTask => (
  typeof value === 'string' && (STUDY_TASKS as readonly string[]).includes(value)
)

/**
 * As quatro tarefas começam na Home. A venda também: medir se a pessoa
 * encontra `Entradas` sozinha é parte da missão, então o link não pode entregar
 * a seção pronta.
 */
const START_SECTION_BY_TASK: Record<StudyTask, StudySection> = {
  onboarding: 'home',
  buy: 'home',
  sell: 'home',
  help: 'home',
}

const ONBOARDING_COMPLETED_BY_TASK: Record<StudyTask, boolean> = {
  onboarding: false,
  buy: true,
  sell: true,
  help: true,
}

interface StoredStudyMarket {
  task: StudyTask
  openedAt: number
  roundStart: number
}

export type StudyResolution =
  | { status: 'invalid'; requestedTask: string | null }
  | { status: 'ready'; scenario: StudyScenario; isDebug: boolean }

/**
 * O início da rodada é derivado do instante da abertura, e não do relógio de
 * parede: assim a pessoa sempre entra com dez minutos restantes, sem depender
 * de que hora ela abriu o link.
 */
export const getStudyRoundStart = (openedAt: number) => (
  openedAt - STUDY_ROUND_ELAPSED_AT_OPEN_MS
)

const createMarketState = () => ({
  targetPrice: STUDY_VALUES.targetPrice,
  currentPrice: STUDY_VALUES.initialCurrentPrice,
  prices: {
    up: STUDY_VALUES.upBuyPrice,
    down: STUDY_VALUES.downBuyPrice,
  },
  sellPrices: {
    up: STUDY_VALUES.sellPrice,
    down: STUDY_VALUES.downSellPrice,
  },
})

const buildScenario = (
  task: StudyTask,
  openedAt: number,
  wallet: PrototypeWalletState,
): StudyScenario => ({
  id: `${task}-maze-v1`,
  task,
  startSection: START_SECTION_BY_TASK[task],
  market: createMarketState(),
  wallet,
  onboarding: { completed: ONBOARDING_COMPLETED_BY_TASK[task] },
  openedAt,
})

const seedScenario = (task: StudyTask, openedAt: number): StudyScenario => {
  const roundStart = getStudyRoundStart(openedAt)
  const wallet = createStudyWalletState(task, roundStart)

  writeStudyTask(task)
  writeStudyJson(STUDY_STORAGE_KEYS.market, {
    task,
    openedAt,
    roundStart,
  } satisfies StoredStudyMarket)
  writeStudyJson(STUDY_STORAGE_KEYS.onboarding, {
    completed: ONBOARDING_COMPLETED_BY_TASK[task],
  })
  writeStudyValue(STUDY_STORAGE_KEYS.wallet, JSON.stringify(wallet))

  return buildScenario(task, openedAt, wallet)
}

const restoreScenario = (
  task: StudyTask,
  stored: StoredStudyMarket,
): StudyScenario => {
  const walletRaw = window.localStorage.getItem(STUDY_STORAGE_KEYS.wallet)
  const wallet = deserializeWalletState(walletRaw)
  const onboarding = readStudyJson<{ completed: boolean }>(
    STUDY_STORAGE_KEYS.onboarding,
  )
  const scenario = buildScenario(task, stored.openedAt, wallet)

  return onboarding === null
    ? scenario
    : { ...scenario, onboarding: { completed: onboarding.completed === true } }
}

/**
 * Prepara o cenário antes do primeiro render.
 *
 * O Maze sempre envia a pessoa para a URL com `mazeStep=start`, então essa é a
 * fronteira que reinicia o seed: cada abertura de tarefa restaura exatamente o
 * mesmo estado para todos os participantes. Um reload no meio da missão chega
 * com um `mazeStep` posterior e conserva o que já aconteceu, porque perder a
 * compra recém-feita por causa de um reload seria pior do que repeti-la.
 */
export const prepareStudyScenario = (
  now = Date.now(),
): StudyResolution => {
  const url = new URL(window.location.href)
  const requestedTask = url.searchParams.get(STUDY_TASK_PARAM)
  const isDebug = url.searchParams.get(STUDY_DEBUG_PARAM) === '1'

  if (!isStudyTask(requestedTask)) {
    return { status: 'invalid', requestedTask }
  }

  const hasResetRequest = url.searchParams.get(STUDY_RESET_PARAM) === '1'

  if (hasResetRequest) {
    resetStudyStorage()
    url.searchParams.delete(STUDY_RESET_PARAM)
    window.history.replaceState(window.history.state, '', url.toString())
  }

  const step = url.searchParams.get(STUDY_MAZE_STEP_PARAM)
  const storedTask = readStudyTask()
  const storedMarket = readStudyJson<StoredStudyMarket>(
    STUDY_STORAGE_KEYS.market,
  )
  const canRestore = !hasResetRequest
    && storedTask === requestedTask
    && storedMarket !== null
    && storedMarket.task === requestedTask
    && Number.isFinite(storedMarket.openedAt)
    && step !== null
    && step !== 'start'

  if (!canRestore) {
    // Trocar de tarefa nunca herda o estado da anterior: o namespace inteiro
    // sai antes do novo seed entrar.
    resetStudyStorage()
    removeStudyValue(STUDY_STORAGE_KEYS.wallet)

    return {
      status: 'ready',
      scenario: seedScenario(requestedTask, now),
      isDebug,
    }
  }

  return {
    status: 'ready',
    scenario: restoreScenario(requestedTask, storedMarket),
    isDebug,
  }
}

let resolution: StudyResolution | null = null

export const initializeStudy = (now = Date.now()): StudyResolution => {
  resolution = prepareStudyScenario(now)
  return resolution
}

export const getStudyResolution = (): StudyResolution => {
  if (resolution === null) {
    throw new Error(
      'O estudo precisa ser inicializado antes do primeiro render.',
    )
  }

  return resolution
}

export const getStudyScenario = (): StudyScenario => {
  const current = getStudyResolution()

  if (current.status !== 'ready') {
    throw new Error('Nenhum cenário disponível para uma tarefa inválida.')
  }

  return current.scenario
}
