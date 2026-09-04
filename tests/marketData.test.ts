import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BTC_ROUND_DURATION_MS,
  getBtcRoundStart,
  getPreviousBtcRoundStarts,
} from '../src/services/marketData.ts'

test('calcula a rodada atual em blocos contínuos de 15 minutos', () => {
  const tenTwentyNine = Date.UTC(2026, 8, 1, 10, 29, 59)
  const tenFifteen = Date.UTC(2026, 8, 1, 10, 15, 0)

  assert.equal(getBtcRoundStart(tenTwentyNine), tenFifteen)
})

test('lista as 10 rodadas concluídas imediatamente anteriores', () => {
  const currentRoundStart = Date.UTC(2026, 8, 1, 10, 15, 0)
  const rounds = getPreviousBtcRoundStarts(currentRoundStart, 10)

  assert.equal(rounds.length, 10)
  assert.equal(rounds[0], Date.UTC(2026, 8, 1, 10, 0, 0))
  assert.equal(rounds[9], Date.UTC(2026, 8, 1, 7, 45, 0))
  assert.equal(rounds[0] - rounds[1], BTC_ROUND_DURATION_MS)
})
