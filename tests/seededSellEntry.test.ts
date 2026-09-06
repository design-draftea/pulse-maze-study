import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isSellTaskUrl,
  shouldSeedSellEntry,
  type SeedSellEntryDecision,
} from '../src/hooks/useSeededSellEntry.ts'

const RODADA = 1_788_727_500_000
const PROXIMA_RODADA = RODADA + 15 * 60 * 1000

const cenario = (
  overrides: Partial<SeedSellEntryDecision> = {},
): SeedSellEntryDecision => ({
  isSellTask: true,
  hasCompletedSale: false,
  hasOpenPosition: false,
  seededRound: null,
  roundStart: RODADA,
  ...overrides,
})

test('semeia ao abrir a tarefa sem posição', () => {
  assert.equal(shouldSeedSellEntry(cenario()), true)
})

test('não semeia fora da tarefa de venda', () => {
  assert.equal(shouldSeedSellEntry(cenario({ isSellTask: false })), false)
})

/** A entrada que a pessoa fez na tarefa anterior é sempre preferida à semeada. */
test('não semeia quando a pessoa já tem posição', () => {
  assert.equal(shouldSeedSellEntry(cenario({ hasOpenPosition: true })), false)
})

test('não semeia duas vezes na mesma rodada', () => {
  assert.equal(shouldSeedSellEntry(cenario({ seededRound: RODADA })), false)
})

/**
 * O caso que motivou a mudança: a rodada real vira a cada 15 minutos. Se virar
 * no meio da tarefa, a posição liquida e a pessoa fica sem nada para vender.
 */
test('repõe a entrada quando a rodada vira', () => {
  const depoisDaVirada = cenario({
    seededRound: RODADA,
    roundStart: PROXIMA_RODADA,
    hasOpenPosition: false,
  })

  assert.equal(shouldSeedSellEntry(depoisDaVirada), true)
})

/**
 * Sem esta trava, vender zeraria a posição e uma entrada nova nasceria em
 * seguida, desfazendo diante da pessoa o que ela acabou de fazer.
 */
test('não repõe depois da venda, nem na rodada seguinte', () => {
  assert.equal(
    shouldSeedSellEntry(cenario({ hasCompletedSale: true })),
    false,
  )
  assert.equal(
    shouldSeedSellEntry(cenario({
      hasCompletedSale: true,
      seededRound: RODADA,
      roundStart: PROXIMA_RODADA,
    })),
    false,
  )
})

test('a URL da venda é reconhecida pelo parâmetro da tarefa', () => {
  const base = 'https://design-draftea.github.io/pulse-maze-study/'

  assert.equal(isSellTaskUrl(`${base}?task=sell`), true)
  assert.equal(isSellTaskUrl(`${base}?task=sell&mazeStep=entries-open`), true)
  assert.equal(isSellTaskUrl(base), false)
  assert.equal(isSellTaskUrl(`${base}?task=buy`), false)
})
