/**
 * Gerador determinístico usado em todo o estudo. `Math.random()` sem seed não
 * controla preço, evento visual ou resultado em lugar nenhum desta cópia: dois
 * participantes precisam ver exatamente a mesma coisa.
 */
export const createSeededRandom = (seed: number) => {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** Semente estável derivada de um texto, para cada tarefa ter a sua. */
export const hashSeed = (value: string) => {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}
