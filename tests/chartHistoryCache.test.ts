import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deserializeChartHistory, serializeChartHistory, readChartHistory,
  writeChartHistory, RANGE_HISTORY_DURATION_MS,
} from '../src/services/chartHistoryCache.ts'
import { mergePricePointSeries, appendRollingPricePoint } from '../src/components/priceChartModel.ts'

const now = Date.UTC(2026, 8, 4, 15, 0, 5)
const points = Array.from({ length: 40 }, (_, i) => ({
  timestamp: now - (40 - i) * 1000, value: 100 + Math.sin(i),
}))

test('F5 restaura valores e timestamps inclusive atravessando a virada', () => {
  const restored = deserializeChartHistory(serializeChartHistory(points, now), now + 1000)
  assert.deepEqual(restored, points)
  const next = { timestamp: now + 1000, value: 102 }
  assert.deepEqual(appendRollingPricePoint(restored, next, now - RANGE_HISTORY_DURATION_MS, 3601), [...points, next])
})

test('remove pontos expirados, futuros e inválidos; ordena e conserva o último do segundo', () => {
  const earliest = now - RANGE_HISTORY_DURATION_MS
  const raw = JSON.stringify({ version: 1, points: [
    { timestamp: now - 900, value: 103 },
    { timestamp: earliest - 1, value: 1 },
    { timestamp: now + 1, value: 1 },
    { timestamp: now - 1000, value: 101 },
    { timestamp: earliest, value: 90 },
    { timestamp: now, value: 0 }, null, {},
    { timestamp: '100', value: 1 }, { timestamp: now, value: '1' },
  ] })
  assert.deepEqual(deserializeChartHistory(raw, now), [
    { timestamp: earliest, value: 90 }, { timestamp: now - 900, value: 103 },
  ])
})

test('cache ausente, corrompido ou incompatível equivale a vazio', () => {
  for (const raw of [null, '', '{', 'null', '[]', '{}', '{"version":2,"points":[]}', '{"version":1,"points":{}}']) {
    assert.deepEqual(deserializeChartHistory(raw, now), [])
  }
})

test('limita uma hora a 3601 pontos e normaliza também ao salvar', () => {
  const many = Array.from({ length: 8000 }, (_, i) => ({ timestamp: now - i * 500, value: 100 }))
  const restored = deserializeChartHistory(serializeChartHistory(many, now), now)
  assert.equal(restored.length, 3601)
  assert.equal(restored[0].timestamp, now - RANGE_HISTORY_DURATION_MS + 500)
  assert.equal(restored.at(-1)?.timestamp, now)
})

test('pontos restaurados têm prioridade sobre candles no mesmo segundo', () => {
  const restored = deserializeChartHistory(serializeChartHistory(points, now), now)
  const merged = mergePricePointSeries(points.map(p => ({ ...p, value: 999 })), restored, now - 60000)
  assert.deepEqual(merged, points)
})

test('falhas no acesso, leitura ou gravação não interrompem o app', () => {
  const fail = () => { throw new Error('storage unavailable') }
  assert.deepEqual(readChartHistory(now, fail), [])
  assert.doesNotThrow(() => writeChartHistory(points, now, fail))
  const storage = { getItem: fail, setItem: fail }
  assert.deepEqual(readChartHistory(now, () => storage), [])
  assert.doesNotThrow(() => writeChartHistory(points, now, () => storage))
})
