import { STUDY_ROUND_DURATION_MS } from './studyConfig.ts'
import type { StudyPreviousRound } from './studyTypes.ts'

/**
 * Dez rodadas encerradas, cinco UP e cinco DOWN, sempre nesta ordem. Nenhum
 * resultado depende do relógio real nem de uma chamada de rede; só os horários
 * são relativos ao início da rodada corrente, para o histórico parecer contínuo
 * com o que a pessoa está vendo.
 *
 * O placar equilibrado é deliberado: um histórico enviesado viraria um sinal, e
 * o conteúdo do produto insiste que cada rodada é independente.
 */
const STUDY_PREVIOUS_ROUND_DEFINITIONS = [
  { targetPrice: 79_980.00, finalPrice: 79_992.00, result: 'up' },
  { targetPrice: 80_015.50, finalPrice: 80_003.20, result: 'down' },
  { targetPrice: 79_968.40, finalPrice: 79_981.10, result: 'up' },
  { targetPrice: 80_042.10, finalPrice: 80_027.60, result: 'down' },
  { targetPrice: 79_995.30, finalPrice: 80_008.90, result: 'up' },
  { targetPrice: 80_021.70, finalPrice: 80_009.40, result: 'down' },
  { targetPrice: 79_957.80, finalPrice: 79_970.20, result: 'up' },
  { targetPrice: 80_033.60, finalPrice: 80_019.90, result: 'down' },
  { targetPrice: 79_988.10, finalPrice: 80_001.50, result: 'up' },
  { targetPrice: 80_007.40, finalPrice: 79_994.30, result: 'down' },
] as const satisfies readonly Omit<
  StudyPreviousRound,
  'id' | 'roundStart' | 'roundEnd'
>[]

export const STUDY_PREVIOUS_ROUNDS_COUNT =
  STUDY_PREVIOUS_ROUND_DEFINITIONS.length

/** A mais recente primeiro, como a Home espera. */
export const buildStudyPreviousRounds = (
  currentRoundStart: number,
): StudyPreviousRound[] => (
  STUDY_PREVIOUS_ROUND_DEFINITIONS.map((definition, index) => {
    const roundStart = currentRoundStart - (index + 1) * STUDY_ROUND_DURATION_MS

    return {
      id: `study-round-${index + 1}`,
      roundStart,
      roundEnd: roundStart + STUDY_ROUND_DURATION_MS,
      targetPrice: definition.targetPrice,
      finalPrice: definition.finalPrice,
      result: definition.result,
    }
  })
)
