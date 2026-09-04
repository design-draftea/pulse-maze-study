import { useCallback, useState } from 'react'
import { STUDY_STORAGE_KEYS, writeStudyJson } from '../study/studyStorage.ts'
import type { StudyScenario } from '../study/studyTypes.ts'

/**
 * O pulsante atrás do botão de onboarding existe só para o botão ser
 * encontrado. Ele morre na primeira abertura do bottom sheet e não volta mais.
 *
 * No estudo, quem decide se ele aparece é o cenário da tarefa, não o histórico
 * do aparelho: `task=onboarding` precisa do convite pulsando para medir se a
 * pessoa o encontra, e as outras três tarefas precisam dele oculto para não
 * competir com a missão. A persistência serve apenas para um reload no meio da
 * missão não trazer o convite de volta.
 */
export function useOnboardingInvite(scenario: StudyScenario) {
  const [isDismissed, setIsDismissed] = useState(
    () => scenario.onboarding.completed,
  )

  const dismissInvite = useCallback(() => {
    setIsDismissed((dismissed) => {
      if (dismissed) return dismissed

      writeStudyJson(STUDY_STORAGE_KEYS.onboarding, { completed: true })
      return true
    })
  }, [])

  return { isInviting: !isDismissed, dismissInvite }
}
