import { createSeededRandom, hashSeed } from '../study/studyRandom.ts'

export const ENTRY_FEED_MIN_INTERVAL = 7500
export const ENTRY_FEED_MAX_INTERVAL = 16000

const clampUnit = (value: number) => Math.min(1, Math.max(0, value))

/**
 * Cadência das entradas simuladas do gráfico. É pura ambientação visual, mas
 * ainda assim precisa ser determinística: dois participantes têm de ver a mesma
 * tela nos mesmos instantes, senão a gravação de um mostra movimento onde a do
 * outro mostra uma pausa.
 */
const studyRandom = createSeededRandom(hashSeed('study-entry-feed'))

export const getNextEntryDelay = (randomValue = studyRandom()) => {
  const normalizedRandom = Number.isFinite(randomValue)
    ? clampUnit(randomValue)
    : 0.5

  return Math.round(
    ENTRY_FEED_MIN_INTERVAL +
      (ENTRY_FEED_MAX_INTERVAL - ENTRY_FEED_MIN_INTERVAL) * normalizedRandom,
  )
}
