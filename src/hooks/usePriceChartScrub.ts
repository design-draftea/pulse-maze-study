import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

type PriceChartScrubOptions = {
  leftBoundary: number
  markerX: number
  // Só o LIVE disputa o gesto com o arrasto do histórico. Nas outras faixas um
  // movimento horizontal não tem outro dono e pode alimentar a leitura direto.
  hasCompetingPan: boolean
  onScrubStart: () => void
}

type ScrubDragState = {
  pointerId: number
  originLeft: number
  startX: number
  startY: number
  isActive: boolean
}

// A leitura nasce de um toque mantido, e não do primeiro pixel de movimento:
// é o que deixa a rolagem vertical da página passar intacta pelo gráfico.
const SCRUB_LONG_PRESS_MS = 140
const SCRUB_CANCEL_DISTANCE_PX = 8

export const usePriceChartScrub = ({
  leftBoundary,
  markerX,
  hasCompetingPan,
  onScrubStart,
}: PriceChartScrubOptions) => {
  const [scrubX, setScrubX] = useState<number | null>(null)
  const dragRef = useRef<ScrubDragState | null>(null)
  const timerRef = useRef(0)
  const contextRef = useRef({
    leftBoundary,
    markerX,
    hasCompetingPan,
    onScrubStart,
  })

  useEffect(() => {
    contextRef.current = { leftBoundary, markerX, hasCompetingPan, onScrubStart }
  })

  const cancelScrub = useCallback(() => {
    window.clearTimeout(timerRef.current)
    timerRef.current = 0
    dragRef.current = null
    setScrubX(null)
  }, [])

  useEffect(() => cancelScrub, [cancelScrub])

  const clampToPlot = useCallback((x: number) => {
    const context = contextRef.current

    return Math.min(context.markerX, Math.max(context.leftBoundary, x))
  }, [])

  const handlePointerDown = useCallback((
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    const target = event.currentTarget
    const pointerId = event.pointerId
    const drag: ScrubDragState = {
      pointerId,
      originLeft: target.getBoundingClientRect().left,
      startX: event.clientX,
      startY: event.clientY,
      isActive: false,
    }

    window.clearTimeout(timerRef.current)
    dragRef.current = drag
    timerRef.current = window.setTimeout(() => {
      if (dragRef.current !== drag) return

      drag.isActive = true
      try {
        target.setPointerCapture(pointerId)
      } catch {
        // Um ponteiro já liberado pelo navegador não impede a leitura.
      }
      contextRef.current.onScrubStart()
      setScrubX(clampToPlot(drag.startX - drag.originLeft))
    }, SCRUB_LONG_PRESS_MS)
  }, [clampToPlot])

  const handlePointerMove = useCallback((
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    const drag = dragRef.current
    if (drag === null || drag.pointerId !== event.pointerId) return

    if (!drag.isActive) {
      const movedVertically = Math.abs(event.clientY - drag.startY)
        >= SCRUB_CANCEL_DISTANCE_PX
      const movedHorizontally = Math.abs(event.clientX - drag.startX)
        >= SCRUB_CANCEL_DISTANCE_PX

      if (
        movedVertically
        || (movedHorizontally && contextRef.current.hasCompetingPan)
      ) cancelScrub()

      return
    }

    setScrubX(clampToPlot(event.clientX - drag.originLeft))
  }, [cancelScrub, clampToPlot])

  const handlePointerEnd = useCallback((
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    const drag = dragRef.current
    if (drag === null || drag.pointerId !== event.pointerId) return

    if (drag.isActive) {
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      } catch {
        // O navegador pode ter liberado a captura antes do fim do gesto.
      }
    }

    cancelScrub()
  }, [cancelScrub])

  return {
    cancelScrub,
    isScrubbing: scrubX !== null,
    scrubX,
    scrubHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerEnd,
      onPointerCancel: handlePointerEnd,
    },
  }
}
