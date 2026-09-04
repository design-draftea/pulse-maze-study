/**
 * Ambiente mínimo de navegador para os testes do estudo.
 *
 * O cenário é preparado antes do primeiro render, lendo `window.location` e
 * escrevendo em `localStorage`. Testar isso sem um DOM inteiro exige apenas
 * essas duas peças, então elas são construídas aqui em vez de trazer jsdom para
 * o repositório só por causa de quatro tarefas.
 */
export interface FakeStorage extends Storage {
  readonly entries: Map<string, string>
}

export const createFakeStorage = (): FakeStorage => {
  const entries = new Map<string, string>()

  return {
    entries,
    get length() {
      return entries.size
    },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, String(value))
    },
    removeItem: (key: string) => {
      entries.delete(key)
    },
    clear: () => {
      throw new Error(
        'localStorage.clear() não pode ser usado: apagaria chaves fora do estudo.',
      )
    },
  } as FakeStorage
}

export interface FakeWindow {
  location: { href: string }
  localStorage: FakeStorage
  history: {
    state: unknown
    replaceState: (state: unknown, title: string, url: string) => void
    pushState: (state: unknown, title: string, url: string) => void
    replaceCalls: string[]
    pushCalls: string[]
  }
}

export const installFakeWindow = (href: string): FakeWindow => {
  const storage = createFakeStorage()
  const fake: FakeWindow = {
    location: { href },
    localStorage: storage,
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
  }

  ;(globalThis as { window?: unknown }).window = fake
  ;(globalThis as { localStorage?: unknown }).localStorage = storage

  return fake
}

export const uninstallFakeWindow = () => {
  delete (globalThis as { window?: unknown }).window
  delete (globalThis as { localStorage?: unknown }).localStorage
}
