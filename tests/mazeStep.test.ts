import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMazeStepUrl,
  getMazeStep,
  markMazeStep,
} from '../src/services/mazeStep.ts'

const BASE = 'https://design-draftea.github.io/pulse-maze-study/'

interface FakeWindow {
  location: { href: string; reload: () => void }
  reloads: number
  timers: Array<() => void>
  setTimeout: (callback: () => void) => number
  history: {
    state: unknown
    replaceState: (state: unknown, title: string, url: string) => void
    pushState: (state: unknown, title: string, url: string) => void
    replaceCalls: string[]
    pushCalls: string[]
  }
}

const installWindow = (href: string): FakeWindow => {
  const fake: FakeWindow = {
    location: { href },
    history: {
      state: null,
      replaceCalls: [],
      pushCalls: [],
      replaceState(state, _title, url) {
        this.state = state
        this.replaceCalls.push(url)
        fake.location.href = new URL(url, fake.location.href).toString()
      },
      pushState(state, _title, url) {
        this.state = state
        this.pushCalls.push(url)
        fake.location.href = new URL(url, fake.location.href).toString()
      },
    },
    reloads: 0,
    timers: [] as Array<() => void>,
    setTimeout(callback: () => void) {
      fake.timers.push(callback)
      return fake.timers.length
    },
  }

  fake.location.reload = () => { fake.reloads += 1 }
  ;(globalThis as { window?: unknown }).window = fake
  return fake
}

/** Executa os temporizadores que o código agendou, sem esperar de verdade. */
const correrTemporizadores = (fake: FakeWindow) => {
  const pendentes = [...fake.timers]
  fake.timers.length = 0
  pendentes.forEach((run) => run())
}

test.afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

test('marca o passo na URL', () => {
  const fake = installWindow(BASE)

  markMazeStep('onboarding-complete')

  assert.equal(fake.location.href, `${BASE}?mazeStep=onboarding-complete`)
})

test('substitui o passo anterior em vez de acumular', () => {
  const fake = installWindow(`${BASE}?mazeStep=onboarding-open`)

  markMazeStep('onboarding-complete')

  assert.equal(fake.location.href, `${BASE}?mazeStep=onboarding-complete`)
})

test('preserva o hash da navegação interna', () => {
  const fake = installWindow(`${BASE}#entradas`)

  markMazeStep('entries-open')

  assert.equal(fake.location.href, `${BASE}?mazeStep=entries-open#entradas`)
})

/**
 * A aplicação já navega por hash e por `pushState`. Uma entrada de histórico por
 * marco faria o botão voltar exigir vários toques no meio da tarefa.
 */
test('não empilha histórico', () => {
  const fake = installWindow(BASE)

  markMazeStep('onboarding-open')
  markMazeStep('onboarding-complete')

  assert.equal(fake.history.pushCalls.length, 0)
  assert.equal(fake.history.replaceCalls.length, 2)
})

test('o mesmo passo chamado duas vezes não reescreve nada', () => {
  const fake = installWindow(`${BASE}?mazeStep=assistant-open`)

  markMazeStep('assistant-open')

  assert.deepEqual(fake.history.replaceCalls, [])
})

test('a URL é a mesma para todo participante no mesmo ponto', () => {
  const primeiro = buildMazeStepUrl(BASE, 'purchase-complete')
  const segundo = buildMazeStepUrl(
    `${BASE}?mazeStep=buy-betslip-open`,
    'purchase-complete',
  )

  assert.equal(primeiro, segundo)
  assert.equal(getMazeStep(primeiro), 'purchase-complete')
})

// ---------------------------------------------------------------------------
// URL da tarefa de venda
// ---------------------------------------------------------------------------

/**
 * O parâmetro da tarefa precisa sobreviver a cada marco, senão a semeadura da
 * entrada deixaria de valer no meio da missão e a URL de sucesso mudaria de
 * forma no meio do caminho.
 */
test('o parâmetro da tarefa sobrevive à marcação dos passos', () => {
  const fake = installWindow(`${BASE}?task=sell`)

  markMazeStep('entries-open')
  assert.equal(fake.location.href, `${BASE}?task=sell&mazeStep=entries-open`)

  markMazeStep('sale-complete')
  assert.equal(fake.location.href, `${BASE}?task=sell&mazeStep=sale-complete`)
})

test('a venda preserva o hash de Entradas junto do parâmetro da tarefa', () => {
  const fake = installWindow(`${BASE}?task=sell&mazeStep=entries-open#entradas`)

  markMazeStep('sale-complete')

  assert.equal(
    fake.location.href,
    `${BASE}?task=sell&mazeStep=sale-complete#entradas`,
  )
})

// ---------------------------------------------------------------------------
// Ordem dos parâmetros
// ---------------------------------------------------------------------------

/**
 * O Maze compara URLs como texto e acrescenta o `lwt` dele por conta própria.
 * Se o nosso passo entrasse depois dele durante o teste, e antes dele ao abrir o
 * link direto, o caminho gravado nunca bateria com o percorrido.
 */
test('o passo vem antes do que o Maze acrescenta, venha ele antes ou depois', () => {
  const mazeAbriuPrimeiro = buildMazeStepUrl(
    `${BASE}?lwt=true`,
    'purchase-complete',
  )
  const linkAbertoDireto = buildMazeStepUrl(
    `${BASE}?mazeStep=purchase-complete&lwt=true`,
    'purchase-complete',
  )

  assert.equal(mazeAbriuPrimeiro, `${BASE}?mazeStep=purchase-complete&lwt=true`)
  assert.equal(linkAbertoDireto, mazeAbriuPrimeiro)
})

test('a tarefa vem antes do passo, e os dois antes do resto', () => {
  assert.equal(
    buildMazeStepUrl(`${BASE}?lwt=true&task=sell`, 'sale-complete'),
    `${BASE}?task=sell&mazeStep=sale-complete&lwt=true`,
  )
})

test('a ordem é a mesma qualquer que seja a de chegada', () => {
  const ordens = [
    `${BASE}?lwt=true&task=sell&mazeStep=entries-open`,
    `${BASE}?task=sell&lwt=true&mazeStep=entries-open`,
    `${BASE}?mazeStep=entries-open&task=sell&lwt=true`,
  ].map((href) => buildMazeStepUrl(href, 'sale-complete'))

  assert.equal(new Set(ordens).size, 1)
  assert.equal(ordens[0], `${BASE}?task=sell&mazeStep=sale-complete&lwt=true`)
})

test('sem parâmetros do Maze, a URL continua enxuta', () => {
  assert.equal(
    buildMazeStepUrl(BASE, 'onboarding-complete'),
    `${BASE}?mazeStep=onboarding-complete`,
  )
})


// ---------------------------------------------------------------------------
// Recarga no passo de sucesso
// ---------------------------------------------------------------------------

/**
 * O snippet do Maze não intercepta `pushState` nem `replaceState`, e a
 * documentação deles diz que uma URL alterada sem recarregamento não é
 * detectada numa aplicação de página única. Sem a recarga, a pessoa chega ao fim
 * da tarefa e o bloco nunca fecha.
 */
test('o passo de sucesso recarrega a página', () => {
  const fake = installWindow(`${BASE}?mazeStep=buy-betslip-open`)

  markMazeStep('purchase-complete')

  assert.equal(fake.location.href, `${BASE}?mazeStep=purchase-complete`)
  assert.equal(fake.reloads, 0, 'não pode recarregar antes do aviso aparecer')

  correrTemporizadores(fake)
  assert.equal(fake.reloads, 1)
})

test('os passos intermediários não recarregam', () => {
  const fake = installWindow(BASE)

  markMazeStep('buy-betslip-open')
  markMazeStep('entries-open')
  correrTemporizadores(fake)

  assert.equal(fake.reloads, 0)
})

test('os quatro passos de sucesso recarregam', () => {
  const finais = [
    'onboarding-complete',
    'purchase-complete',
    'sale-complete',
    'past-entries-open',
  ] as const

  finais.forEach((step) => {
    const fake = installWindow(BASE)
    markMazeStep(step)
    correrTemporizadores(fake)

    assert.equal(fake.reloads, 1, `${step} não recarregou`)
  })
})

test('a URL já está correta antes da recarga', () => {
  const fake = installWindow(`${BASE}?task=sell&lwt=true#entradas`)

  markMazeStep('sale-complete')

  // A recarga acontece sobre esta URL, então é ela que o Maze vai registrar.
  assert.equal(
    fake.location.href,
    `${BASE}?task=sell&mazeStep=sale-complete&lwt=true#entradas`,
  )
})
