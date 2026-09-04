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

/**
 * Osciladores da caminhada de preço depois da abertura da tarefa.
 *
 * Períodos não harmônicos somados não se repetem dentro dos dez minutos da
 * missão, então a linha não desenha um padrão reconhecível. A soma das
 * amplitudes limita o passeio a cerca de US$28 em torno do preço de abertura:
 * largo o bastante para o gráfico ter relevo e o indicador de direção voltar a
 * funcionar, estreito o bastante para o preço objetivo continuar sendo uma
 * referência plausível.
 */
export const STUDY_PRICE_OSCILLATORS = [
  { periodMs: 37_000, amplitude: 3.1, phase: 0.7 },
  { periodMs: 91_000, amplitude: 7.4, phase: 2.1 },
  { periodMs: 211_000, amplitude: 11.2, phase: 4.4 },
  { periodMs: 523_000, amplitude: 6.3, phase: 1.3 },
] as const

/** Ruído por segundo somado à caminhada, em dólares. */
export const STUDY_PRICE_JITTER = 0.6

/**
 * Quanto o preço de UP se move por dólar de variação do Bitcoin.
 *
 * UP e DOWN acompanham o preço porque é assim que um mercado de previsão se
 * comporta: subir em direção ao objetivo encarece o lado que aposta nisso. A
 * sensibilidade é deliberadamente baixa — no pior alinhamento dos osciladores o
 * preço se move menos de 1¢ a cada três segundos, que é a tolerância da
 * proteção de execução do betslip. Acima disso, a confirmação de uma compra
 * seria recusada no meio da tarefa e o participante veria um erro que não
 * existe no produto.
 */
export const STUDY_UP_SENSITIVITY_PER_DOLLAR = 0.0016

/** Limites do preço de UP. DOWN é sempre o complemento. */
export const STUDY_UP_PRICE_RANGE = { min: 0.55, max: 0.8 } as const

/** Diferença entre a melhor oferta de compra e a de venda, em cada lado. */
export const STUDY_BOOK_SPREAD = 0.06

/** Profundidade simulada: participações disponíveis no melhor preço. */
export const STUDY_BOOK_DEPTH = 100_000

export const STUDY_TIME_ZONE = new Intl.DateTimeFormat()
  .resolvedOptions()
  .timeZone
