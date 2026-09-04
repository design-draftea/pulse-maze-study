export const ENTRY_FEED_MIN_INTERVAL = 7500
export const ENTRY_FEED_MAX_INTERVAL = 16000

const clampUnit = (value: number) => Math.min(1, Math.max(0, value))

export const getNextEntryDelay = (randomValue = Math.random()) => {
  const normalizedRandom = Number.isFinite(randomValue)
    ? clampUnit(randomValue)
    : 0.5

  return Math.round(
    ENTRY_FEED_MIN_INTERVAL +
      (ENTRY_FEED_MAX_INTERVAL - ENTRY_FEED_MIN_INTERVAL) * normalizedRandom,
  )
}
