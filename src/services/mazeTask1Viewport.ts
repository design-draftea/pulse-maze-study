/** Keep the task-1 opt-in and enable the same behavior in the other Maze tasks. */
export function isTask1ViewportExperiment(search: string): boolean {
  const params = new URLSearchParams(search)
  const task = params.get('task')
  return (task === 'onboarding' && params.get('viewportFix') === '1') ||
    (params.get('lwt') === 'true' && (task === null || ['onboarding', 'buy', 'sell', 'tracking'].includes(task)))
}

/** Refresh initial mobile geometry without taking over subsequent user scrolling. */
export function installTask1ViewportExperiment(): () => void {
  if (!isTask1ViewportExperiment(window.location.search)) return () => {}

  let interacted = false
  let frame = 0
  let starting = true
  const widgetDocuments = new Set<Document>()
  const interactionEvents = ['pointerdown', 'touchstart', 'keydown', 'wheel'] as const
  const viewport = window.visualViewport
  const stopResetting = () => { interacted = true }
  const resetTop = () => {
    if (!starting || interacted || window.location.hash) return
    // The widget can arrive after the original one-second startup window.
    // Listen inside its document as well so dragging its controls releases the guard.
    try {
      const widget = document.getElementById('maze-tester-widget') as HTMLIFrameElement | null
      const doc = widget?.contentDocument
      if (doc && !widgetDocuments.has(doc)) {
        widgetDocuments.add(doc)
        interactionEvents.forEach(event => doc.addEventListener(event, stopResetting, { capture: true, passive: true }))
      }
    } catch { /* Cross-origin widgets remain untouched. */ }
    if (window.scrollY !== 0 || window.scrollX !== 0) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }
  const onStartupScroll = () => {
    if (starting && !interacted) resetTop()
  }
  const refresh = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      resetTop()
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
  window.addEventListener('scroll', onStartupScroll, { passive: true })
  viewport?.addEventListener('resize', refresh)
  refresh()
  const timers = [100, 350, 750].map(delay => window.setTimeout(refresh, delay))
  // Bounded polling catches late widget insertion/focus without observing chart mutations.
  const startupPoll = window.setInterval(resetTop, 100)
  const startupTimer = window.setTimeout(() => {
    starting = false
    window.clearInterval(startupPoll)
    window.removeEventListener('scroll', onStartupScroll)
  }, 8000)

  return () => {
    cancelAnimationFrame(frame)
    timers.forEach(clearTimeout)
    clearTimeout(startupTimer)
    window.clearInterval(startupPoll)
    window.removeEventListener('pointerdown', stopResetting)
    window.removeEventListener('touchstart', stopResetting)
    window.removeEventListener('keydown', stopResetting)
    window.removeEventListener('wheel', stopResetting)
    window.removeEventListener('load', refresh)
    window.removeEventListener('scroll', onStartupScroll)
    widgetDocuments.forEach(doc => interactionEvents.forEach(event => doc.removeEventListener(event, stopResetting, true)))
    viewport?.removeEventListener('resize', refresh)
  }
}
