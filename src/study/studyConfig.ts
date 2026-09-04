import type { StudyTask } from './studyTypes.ts'

/** Versão do estudo, exposta no build, no elemento raiz e no diagnóstico. */
export const STUDY_VERSION = 'maze-v1'

/** Prefixo único de armazenamento. Nunca colide com as chaves do Pulse principal. */
export const STUDY_STORAGE_PREFIX = 'pulse.maze.v1'

export const STUDY_TASKS: readonly StudyTask[] = [
  'onboarding',
  'buy',
  'sell',
  'help',
] as const

/**
 * Todos os números da pesquisa em um lugar só. Participantes diferentes veem
 * exatamente estes valores, então qualquer ajuste aqui muda o que a coleta mede
 * e exige uma nova tag.
 */
export const STUDY_VALUES = {
  targetPrice: 80_000,
  initialCurrentPrice: 80_012.40,
  /** US$2.040,00 em centavos, igual ao seed da carteira do protótipo. */
  initialBalanceCents: 204_000,
  buyAmount: 10,
  upBuyPrice: 0.67,
  downBuyPrice: 0.33,
  /** Melhor oferta de compra do livro: o que a venda recebe por participação. */
  sellPrice: 0.61,
  downSellPrice: 0.27,
} as const

export const STUDY_ROUND_DURATION_MS = 15 * 60 * 1000
/** A pessoa entra com dez minutos restantes. */
export const STUDY_INITIAL_REMAINING_MS = 10 * 60 * 1000
/**
 * O contador para aos cinco minutos. Nenhuma rodada vira durante uma missão do
 * Maze, então o relógio nunca alcança zero e o cenário nunca se reinicia sozinho.
 */
export const STUDY_FLOOR_REMAINING_MS = 5 * 60 * 1000

/** Deslocamento fixo entre o início da rodada e a abertura da tarefa. */
export const STUDY_ROUND_ELAPSED_AT_OPEN_MS =
  STUDY_ROUND_DURATION_MS - STUDY_INITIAL_REMAINING_MS

/**
 * Âncoras da série do gráfico. A abertura de uma mesma tarefa sempre produz a
 * mesma forma: os pontos intermediários são interpolados, nunca sorteados.
 */
export const STUDY_PRICE_POINTS = [
  79_996.20,
  79_999.80,
  80_003.10,
  80_001.70,
  80_006.40,
  80_009.20,
  80_008.10,
  80_012.40,
] as const

/** Profundidade simulada: participações disponíveis no melhor preço. */
export const STUDY_BOOK_DEPTH = 100_000

export const STUDY_TIME_ZONE = new Intl.DateTimeFormat()
  .resolvedOptions()
  .timeZone
