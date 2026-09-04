import { useCallback, useState } from 'react'

const ONBOARDING_INVITE_STORAGE_KEY = 'pulse.onboarding.invite.dismissed'

const markInviteDismissed = () => {
  try {
    window.localStorage.setItem(ONBOARDING_INVITE_STORAGE_KEY, '1')
  } catch {
    // Persistence is best-effort; the invite still stops pulsing in memory.
  }
}

const loadInviteDismissed = () => {
  const url = new URL(window.location.href)

  // O protótipo roda em testes com usuários, então vários testadores dividem o
  // mesmo aparelho. Sem um reset explícito, só o primeiro deles veria o
  // convite. Mesmo contrato do `?resetWallet=1` em `usePrototypeWallet`.
  if (url.searchParams.get('resetOnboarding') === '1') {
    try {
      window.localStorage.removeItem(ONBOARDING_INVITE_STORAGE_KEY)
    } catch {
      // O convite volta a pulsar em memória mesmo sem storage disponível.
    }

    url.searchParams.delete('resetOnboarding')
    window.history.replaceState(window.history.state, '', url)
    return false
  }

  try {
    return window.localStorage.getItem(ONBOARDING_INVITE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * O pulsante atrás do botão de onboarding existe só para o botão ser
 * encontrado. Ele morre na primeira abertura do bottom sheet — abrir já provou
 * que a pessoa achou o botão — e não volta mais. O botão em si permanece.
 */
export function useOnboardingInvite() {
  const [isDismissed, setIsDismissed] = useState(loadInviteDismissed)

  const dismissInvite = useCallback(() => {
    setIsDismissed((dismissed) => {
      if (dismissed) {
        return dismissed
      }

      markInviteDismissed()
      return true
    })
  }, [])

  return { isInviting: !isDismissed, dismissInvite }
}
