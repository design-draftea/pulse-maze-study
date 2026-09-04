import { STUDY_STORAGE_PREFIX } from './studyConfig.ts'
import type { StudyTask } from './studyTypes.ts'

/**
 * Todo o armazenamento do estudo vive sob um prefixo próprio. A cópia de
 * pesquisa nunca lê nem escreve as chaves do Pulse principal, e o reset nunca
 * usa `localStorage.clear()`: um participante pode estar com outra aba aberta
 * no mesmo aparelho, e apagar tudo apagaria o que não é nosso.
 */
export const STUDY_STORAGE_KEYS = {
  wallet: `${STUDY_STORAGE_PREFIX}.wallet`,
  onboarding: `${STUDY_STORAGE_PREFIX}.onboarding`,
  market: `${STUDY_STORAGE_PREFIX}.market`,
  task: `${STUDY_STORAGE_PREFIX}.task`,
} as const

export type StudyStorageKey =
  (typeof STUDY_STORAGE_KEYS)[keyof typeof STUDY_STORAGE_KEYS]

export const STUDY_STORAGE_KEY_LIST: readonly StudyStorageKey[] =
  Object.values(STUDY_STORAGE_KEYS)

const isStudyKey = (key: string) => key.startsWith(`${STUDY_STORAGE_PREFIX}.`)

export const readStudyValue = (key: StudyStorageKey): string | null => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export const writeStudyValue = (key: StudyStorageKey, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // A persistência é best-effort: o cenário continua íntegro em memória.
  }
}

export const removeStudyValue = (key: StudyStorageKey) => {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Idem: sem storage, o cenário simplesmente não sobrevive ao reload.
  }
}

/**
 * Apaga apenas o namespace do estudo, varrendo as chaves reais do storage em
 * vez da lista declarada. Assim uma chave criada por uma versão anterior do
 * estudo também sai, e nada fora do prefixo é tocado.
 */
export const resetStudyStorage = () => {
  try {
    const keys: string[] = []

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (key !== null && isStudyKey(key)) keys.push(key)
    }

    keys.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Sem storage não há o que limpar.
  }
}

export const readStudyTask = (): StudyTask | null => (
  readStudyValue(STUDY_STORAGE_KEYS.task) as StudyTask | null
)

export const writeStudyTask = (task: StudyTask) => {
  writeStudyValue(STUDY_STORAGE_KEYS.task, task)
}

export const readStudyJson = <Value>(key: StudyStorageKey): Value | null => {
  const raw = readStudyValue(key)
  if (raw === null) return null

  try {
    return JSON.parse(raw) as Value
  } catch {
    return null
  }
}

export const writeStudyJson = (key: StudyStorageKey, value: unknown) => {
  try {
    writeStudyValue(key, JSON.stringify(value))
  } catch {
    // Valor não serializável não deve derrubar a tarefa.
  }
}
