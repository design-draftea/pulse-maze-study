/** Opt-in experiment: never enable on the shared purchase/start URL. */
export function isTask1ViewportExperiment(search: string): boolean {
  const params = new URLSearchParams(search)
  return params.get('task') === 'onboarding' && params.get('viewportFix') === '1'
}

/** Refresh initial mobile geometry without taking over subsequent user scrolling. */
export function installTask1ViewportExperiment(): () => void {
  if (!isTask1ViewportExperiment(window.location.search)) return () => {}

  let interacted = false
  let frame = 0
  let starting = true
  const viewport = window.visualViewport
  const stopResetting = () => { interacted = true }
  const refresh = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      if (starting && !interacted && !window.location.hash) {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      }
      // Consumers (including the task overlay) can remeasure after browser chrome settles.
      // Do not alter the Maze iframe's styles, drag position or completion events.
      window.dispatchEvent(new Event('resize'))
    })
  }
  window.addEventListener('pointerdown', stopResetting, { passive: true })
  window.addEventListener('touchstart', stopResetting, { passive: true })
  window.addEventListener('keydown', stopResetting)
  window.addEventListener('wheel', stopResetting, { passive: true })
  window.addEventListener('load', refresh)
  viewport?.addEventListener('resize', refresh)
  refresh()
  const timers = [100, 350, 750].map(delay => window.setTimeout(refresh, delay))
  const startupTimer = window.setTimeout(() => { starting = false }, 1000)

  return () => {
    cancelAnimationFrame(frame)
    timers.forEach(clearTimeout)
    clearTimeout(startupTimer)
    window.removeEventListener('pointerdown', stopResetting)
    window.removeEventListener('touchstart', stopResetting)
    window.removeEventListener('keydown', stopResetting)
    window.removeEventListener('wheel', stopResetting)
    window.removeEventListener('load', refresh)
    viewport?.removeEventListener('resize', refresh)
  }
}
