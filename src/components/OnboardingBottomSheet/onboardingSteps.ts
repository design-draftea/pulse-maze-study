export interface OnboardingStep {
  id: string
  title: string
  body: string
}

/**
 * Os quatro cards do Figma: `onboarding-01` (564:6369), `onboarding-02`
 * (564:6929), `onboarding-03` (564:7019) e `onboarding-04` (564:7078). Os
 * bullets do sheet vêm de `ONBOARDING_STEP_TOTAL`, e a ilustração de cada passo
 * é resolvida por `id` no mapa do `OnboardingBottomSheet`.
 */
export const ONBOARDING_STEP_TOTAL = 4

export const onboardingSteps: OnboardingStep[] = [
  {
    id: 'choice',
    title: 'Elige UP o DOWN',
    body: 'Solo decides una cosa: si el precio del BTC va a terminar arriba o abajo del precio objetivo de la ronda.',
  },
  {
    id: 'round',
    title: 'Cada ronda dura 15 minutos',
    body: 'Cuando el reloj llega a cero, el precio final define el resultado. No hay nada más que hacer: se resuelve solo.',
  },
  {
    id: 'price',
    title: 'El % indica el precio',
    body: 'Con $10 a 67¢ recibes 14.93 participaciones. Si aciertas, recibes $1 por cada participación.',
  },
  {
    id: 'sell',
    title: 'Puedes vender antes',
    body: 'Si cambias de idea, vendes tu entrada al valor del momento sin esperar a que termine la ronda.',
  },
]
