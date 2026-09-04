import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent as ReactAnimationEvent,
  type CSSProperties,
} from 'react'
import {
  BuyBetslip,
  type BetslipOperationMode,
  type BetslipSuccessDetails,
  type PurchaseSuccessDetails,
  type SaleSuccessDetails,
} from './components/BuyBetslip/BuyBetslip'
import { Header } from './components/Header/Header'
import { HomeOpenEntries } from './components/HomeOpenEntries/HomeOpenEntries'
import {
  MarketChoice,
  type MarketSide,
} from './components/MarketChoice/MarketChoice'
import { MobileOnly } from './components/MobileOnly/MobileOnly'
import { Movements } from './components/Movements/Movements'
import { OnboardingBottomSheet } from './components/OnboardingBottomSheet'
import { OpenEntries } from './components/OpenEntries/OpenEntries'
import {
  Navbar,
  type NavbarItemId,
} from './components/Navbar/Navbar'
import { MarketPriceChart } from './components/MarketPriceChart/MarketPriceChart'
import { PriceComparison } from './components/PriceComparison/PriceComparison'
import {
  ProfileBottomSheet,
  type ProfileBottomSheetMode,
} from './components/ProfileBottomSheet'
import { PulseFooter } from './components/PulseFooter/PulseFooter'
import {
  PreviousRounds,
  type PreviousRound,
} from './components/PreviousRounds/PreviousRounds'
import { PurchaseSuccessToast } from './components/PurchaseSuccessToast'
import {
  RoundWinToast,
  type RoundWinDetails,
} from './components/RoundWinToast/RoundWinToast'
import { SubHeader } from './components/SubHeader/SubHeader'
import { useAnimatedMarketPrice } from './hooks/useAnimatedMarketPrice'
import { useDeferredAssetWarmup } from './hooks/useDeferredAssetWarmup'
import { useMockChartEntries } from './hooks/useMockChartEntries'
import { useOnboardingInvite } from './hooks/useOnboardingInvite'
import { usePrototypeWallet } from './hooks/usePrototypeWallet'
import {
  BTC_DISPLAY_TIME_ZONE,
  BTC_ROUND_DURATION_MS,
  getBtcRoundSlug,
} from './services/marketData'
import { StudyDiagnostics } from './study/StudyDiagnostics.tsx'
import { STUDY_VERSION } from './study/studyConfig.ts'
import { useStudyMarketRound } from './study/studyMarketRound.ts'
import { markMazeStep } from './study/studyMazeNavigation.ts'
import { useStudyOutcomeMarket } from './study/studyOutcomeMarket.ts'
import { getStudyResolution } from './study/studyScenarios.ts'
import {
  getWalletPosition,
  getWalletProfileMetrics,
  type PrototypeWalletCostBasis,
  type PrototypeWalletPosition,
} from './services/prototypeWallet'
import type { HelpAssistantActionId } from './services/helpAssistant'
import { buildHelpAssistantSnapshot } from './services/helpAssistantSnapshot'
import './App.css'

const MARKET_HEADER_COMPACT_SCROLL_Y = 80
const DEFAULT_CONTENT_BOTTOM_INSET = 114
// Os atalhos de demonstração e de injeção de falha do Pulse principal não
// existem aqui. Um participante que caísse num deles veria uma rodada de cinco
// segundos ou um mercado indisponível, e a sessão entraria na análise como se
// fosse o comportamento normal do produto.
const PAGE_TRANSITION_FALLBACK_MS = 700
const MOVEMENTS_HASH = '#movimientos'
const ENTRIES_HASH = '#entradas'
const balanceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

type AppSection = 'home' | 'movements' | 'entries'
type PageTransitionDirection = 'forward' | 'backward'
type PageTransitionPhase = 'exiting' | 'entering'

interface PageTransitionState {
  direction: PageTransitionDirection
  phase: PageTransitionPhase
  scrollY: number
  source: AppSection
  target: AppSection
}

const SECTION_ORDER: Record<AppSection, number> = {
  home: 0,
  movements: 1,
  entries: 2,
}

const getAppSection = (): AppSection => {
  if (window.location.hash === MOVEMENTS_HASH) return 'movements'
  if (window.location.hash === ENTRIES_HASH) return 'entries'
  return 'home'
}

// O topo é reafirmado no frame seguinte porque a rota anterior deixa o fluxo no
// mesmo instante do reset: a altura do documento encolhe logo depois da
// chamada síncrona e o Chrome do iOS reaplica o deslocamento anterior.
const resetScrollTop = () => {
  window.scrollTo({ top: 0, left: 0 })
  window.requestAnimationFrame(() => {
    if (window.scrollY !== 0) window.scrollTo({ top: 0, left: 0 })
  })
}

function App() {
  useDeferredAssetWarmup()

  const resolution = getStudyResolution()
  if (resolution.status !== 'ready') {
    throw new Error('App montado sem um cenário de estudo preparado.')
  }
  const { scenario, isDebug } = resolution
  const studyTask = scenario.task

  const [activeSection, setActiveSection] = useState<AppSection>(getAppSection)
  const [pageTransition, setPageTransition] = useState<
    PageTransitionState | null
  >(null)
  const [isMarketHeaderCompact, setIsMarketHeaderCompact] = useState(false)
  const [isMarketHeaderPinned, setIsMarketHeaderPinned] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const {
    isInviting: isOnboardingInviting,
    dismissInvite: dismissOnboardingInvite,
  } = useOnboardingInvite(scenario)
  const [profileSheetMode, setProfileSheetMode] = useState<ProfileBottomSheetMode>('profile')
  const [selectedSide, setSelectedSide] = useState<MarketSide | null>(null)
  const [betslipInitialOperationMode, setBetslipInitialOperationMode] = useState<
    BetslipOperationMode
  >('buy')
  const [isPurchaseLoading, setIsPurchaseLoading] = useState(false)
  const [purchaseSuccess, setPurchaseSuccess] = useState<
    BetslipSuccessDetails | null
  >(null)
  const [contentBottomInset, setContentBottomInset] = useState(
    DEFAULT_CONTENT_BOTTOM_INSET,
  )
  const marketRound = useStudyMarketRound(scenario)
  const {
    balanceCents,
    currentCostBasis,
    currentPosition,
    movements,
    pendingRoundStarts,
    settledEntries,
    walletState,
    purchase,
    sell,
    settleRound,
  } = usePrototypeWallet(marketRound.roundStart)
  const outcomeMarket = useStudyOutcomeMarket(scenario, marketRound.roundSlug)
  const currentRoundMarketValueCents = useMemo(() => {
    let totalValueCents = 0

    for (const side of ['up', 'down'] as const) {
      const participations = currentPosition[side]
      if (participations <= 0) continue

      const quote = outcomeMarket.quoteSell(side, participations)
      if (!quote?.complete) return null
      totalValueCents += Math.round(quote.grossValue * 100)
    }

    return totalValueCents
  }, [currentPosition, outcomeMarket])
  const profileMetrics = useMemo(() => getWalletProfileMetrics(
    walletState,
    marketRound.roundStart,
    currentRoundMarketValueCents,
  ), [currentRoundMarketValueCents, marketRound.roundStart, walletState])
  const [roundWin, setRoundWin] = useState<RoundWinDetails | null>(null)
  const [latestCompletedRound, setLatestCompletedRound] = useState<
    PreviousRound | null
  >(null)
  const [lastSeenCompletedRoundStart, setLastSeenCompletedRoundStart] = useState<
    number | null
  >(null)

  // A carteira muda no início da confirmação da venda, então a posição zera
  // cerca de 2,3s antes do aviso de sucesso. O card fica retido com este
  // instantâneo até o aviso aparecer, e só então sai animado.
  const [saleExit, setSaleExit] = useState<{
    side: MarketSide
    position: PrototypeWalletPosition
    costBasis: PrototypeWalletCostBasis
    isLeaving: boolean
  } | null>(null)
  const activeSectionRef = useRef(activeSection)
  const pageTransitionRef = useRef<PageTransitionState | null>(null)
  const pageTransitionTimerRef = useRef<number | null>(null)
  const helpNavigationTimerRef = useRef<number | null>(null)
  const marketHeaderSlotRef = useRef<HTMLDivElement>(null)
  const roundSnapshotRef = useRef({
    roundStart: marketRound.roundStart,
    targetPrice: marketRound.targetPrice,
    currentPrice: marketRound.currentPrice,
  })
  const animatedMarketPrice = useAnimatedMarketPrice(marketRound.currentPrice)
  const chartEntries = useMockChartEntries(marketRound.currentPrice !== null)
  // O relógio virtual para aos cinco minutos restantes, então a rodada nunca
  // entra em fechamento durante uma missão do Maze. O estado continua existindo
  // porque a interface o consome; ele simplesmente não é alcançado.
  const isRoundClosing = marketRound.remainingSeconds > 0
    && marketRound.remainingSeconds <= 5
  const displayedMinutes = marketRound.minutes
  const displayedSeconds = marketRound.seconds

  const commitSectionChange = useCallback((nextSection: AppSection) => {
    // A tarefa de venda começa na Home justamente para medir se a pessoa acha
    // `Entradas` sozinha, então este é o marco que separa procurar de encontrar.
    if (nextSection === 'entries') markMazeStep(studyTask, 'entries-open')
    activeSectionRef.current = nextSection
    resetScrollTop()
    if (nextSection === 'home') {
      setIsMarketHeaderCompact(false)
      setIsMarketHeaderPinned(false)
    }
    setActiveSection(nextSection)
    setSelectedSide(null)
    setBetslipInitialOperationMode('buy')
    setPurchaseSuccess(null)
    setContentBottomInset(DEFAULT_CONTENT_BOTTOM_INSET)
  }, [studyTask])

  useEffect(() => {
    markMazeStep(studyTask, 'start')
  }, [studyTask])

  const transitionToSection = useCallback((nextSection: AppSection) => {
    const currentTransition = pageTransitionRef.current

    if (currentTransition) {
      if (nextSection === currentTransition.source) {
        if (pageTransitionTimerRef.current !== null) {
          window.clearTimeout(pageTransitionTimerRef.current)
          pageTransitionTimerRef.current = null
        }
        pageTransitionRef.current = null
        setPageTransition(null)
        window.scrollTo({ top: currentTransition.scrollY, left: 0 })
      }
      return
    }

    const currentSection = activeSectionRef.current
    if (nextSection === currentSection) return

    const direction: PageTransitionDirection = SECTION_ORDER[nextSection]
      > SECTION_ORDER[currentSection]
      ? 'forward'
      : 'backward'
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    if (prefersReducedMotion) {
      commitSectionChange(nextSection)
      return
    }

    const transition: PageTransitionState = {
      direction,
      phase: 'exiting',
      scrollY: window.scrollY,
      source: currentSection,
      target: nextSection,
    }

    pageTransitionRef.current = transition
    setPageTransition(transition)

    pageTransitionTimerRef.current = window.setTimeout(() => {
      const current = pageTransitionRef.current
      if (!current || current.source !== transition.source
        || current.target !== transition.target) return

      pageTransitionTimerRef.current = null
      pageTransitionRef.current = null
      commitSectionChange(current.target)
      setPageTransition(null)
    }, PAGE_TRANSITION_FALLBACK_MS)
  }, [commitSectionChange])

  const handleOutgoingRouteAnimationEnd = useCallback((
    event: ReactAnimationEvent<HTMLDivElement>,
  ) => {
    if (event.target !== event.currentTarget
      || event.animationName !== 'pulse-route-fade-out') return

    const currentTransition = pageTransitionRef.current
    if (!currentTransition || currentTransition.phase !== 'exiting') return

    resetScrollTop()
    if (currentTransition.target === 'home') {
      setIsMarketHeaderCompact(false)
      setIsMarketHeaderPinned(false)
    }
    const enteringTransition: PageTransitionState = {
      ...currentTransition,
      phase: 'entering',
    }

    pageTransitionRef.current = enteringTransition
    setPageTransition(enteringTransition)
  }, [])

  const handleIncomingRouteAnimationEnd = useCallback((
    event: ReactAnimationEvent<HTMLDivElement>,
  ) => {
    if (event.target !== event.currentTarget
      || event.animationName !== 'pulse-route-fade-in') return

    const currentTransition = pageTransitionRef.current
    if (!currentTransition || currentTransition.phase !== 'entering') return

    if (pageTransitionTimerRef.current !== null) {
      window.clearTimeout(pageTransitionTimerRef.current)
      pageTransitionTimerRef.current = null
    }
    pageTransitionRef.current = null
    commitSectionChange(currentTransition.target)
    setPageTransition(null)
  }, [commitSectionChange])

  useEffect(() => () => {
    if (pageTransitionTimerRef.current !== null) {
      window.clearTimeout(pageTransitionTimerRef.current)
    }
    if (helpNavigationTimerRef.current !== null) {
      window.clearTimeout(helpNavigationTimerRef.current)
    }
  }, [])

  useEffect(() => {
    // A Navbar navega por pushState e a aplicação reposiciona o scroll sozinha.
    // Sem isto o navegador restaura o deslocamento salvo da entrada de
    // histórico e desfaz o reset durante a transição.
    if (!('scrollRestoration' in window.history)) return
    const previousScrollRestoration = window.history.scrollRestoration

    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [])

  useEffect(() => {
    const syncSectionWithUrl = () => {
      transitionToSection(getAppSection())
    }

    window.addEventListener('hashchange', syncSectionWithUrl)
    window.addEventListener('popstate', syncSectionWithUrl)

    return () => {
      window.removeEventListener('hashchange', syncSectionWithUrl)
      window.removeEventListener('popstate', syncSectionWithUrl)
    }
  }, [transitionToSection])

  useEffect(() => {
    const updateMarketHeaderState = () => {
      setIsMarketHeaderPinned(
        (marketHeaderSlotRef.current?.getBoundingClientRect().top ?? 1) <= 0,
      )
      setIsMarketHeaderCompact(
        window.scrollY >= MARKET_HEADER_COMPACT_SCROLL_Y,
      )
    }

    updateMarketHeaderState()
    window.addEventListener('scroll', updateMarketHeaderState, {
      passive: true,
    })

    return () => window.removeEventListener('scroll', updateMarketHeaderState)
  }, [])

  useEffect(() => {
    if (!isRoundClosing) return undefined

    const closingFrame = window.requestAnimationFrame(() => {
      setSelectedSide(null)
      setPurchaseSuccess(null)
      setContentBottomInset(DEFAULT_CONTENT_BOTTOM_INSET)
    })

    return () => window.cancelAnimationFrame(closingFrame)
  }, [isRoundClosing])

  // A rodada do estudo nunca vira, então este efeito nunca liquida nada. Ele
  // permanece porque é o caminho que a interface percorreria no produto, e
  // removê-lo esconderia a diferença entre a cópia e o Pulse principal.
  useEffect(() => {
    const previousRound = roundSnapshotRef.current

    if (previousRound.roundStart !== marketRound.roundStart) {
      const targetPrice = previousRound.targetPrice
      const finalPrice = previousRound.currentPrice

      if (targetPrice !== null && finalPrice !== null) {
        const winner: MarketSide = finalPrice > targetPrice ? 'up' : 'down'

        setLatestCompletedRound({
          id: getBtcRoundSlug(previousRound.roundStart),
          roundStart: previousRound.roundStart,
          roundEnd: previousRound.roundStart + BTC_ROUND_DURATION_MS,
          targetPrice,
          finalPrice,
          result: winner,
        })

        const settlement = settleRound(previousRound.roundStart, winner, {
          roundEnd: previousRound.roundStart + BTC_ROUND_DURATION_MS,
          targetPrice,
          finalPrice,
        })
        const totalReceived = settlement.payoutCents / 100

        if (totalReceived > 0) {
          setRoundWin({
            roundStart: previousRound.roundStart,
            totalReceived,
          })
        }
      }

      setSelectedSide(null)
      setPurchaseSuccess(null)
      setContentBottomInset(DEFAULT_CONTENT_BOTTOM_INSET)
      roundSnapshotRef.current = {
        roundStart: marketRound.roundStart,
        targetPrice: marketRound.targetPrice,
        currentPrice: marketRound.currentPrice,
      }
      return
    }

    if (marketRound.targetPrice !== null) {
      previousRound.targetPrice = marketRound.targetPrice
    }
    if (marketRound.currentPrice !== null) {
      previousRound.currentPrice = marketRound.currentPrice
    }
  }, [
    marketRound.currentPrice,
    marketRound.roundStart,
    marketRound.targetPrice,
    settleRound,
  ])

  const pendingRoundStartsKey = pendingRoundStarts.join(',')

  const handlePurchaseLoadingChange = useCallback((isLoading: boolean) => {
    setIsPurchaseLoading(isLoading)
    if (isLoading) setPurchaseSuccess(null)
  }, [])

  const dismissPurchaseSuccess = useCallback(() => {
    setPurchaseSuccess(null)
  }, [])

  const dismissRoundWin = useCallback(() => {
    setRoundWin(null)
  }, [])

  const handleProfileOpen = useCallback(() => {
    setProfileSheetMode('profile')
    setIsProfileOpen(true)
  }, [])

  const handleOnboardingOpen = useCallback(() => {
    dismissOnboardingInvite()
    markMazeStep(studyTask, 'onboarding-open')
    setIsOnboardingOpen(true)
  }, [dismissOnboardingInvite, studyTask])

  // Só o CTA final marca sucesso. Fechar no X, ou no arrasto, encerra o sheet
  // sem marco: a missão é entender o funcionamento, não abrir o guia.
  const handleOnboardingComplete = useCallback(() => {
    markMazeStep(studyTask, 'onboarding-complete')
  }, [studyTask])

  const handleHelpOpen = useCallback(() => {
    setProfileSheetMode('help')
    setIsProfileOpen(true)
  }, [])

  const handleAssistantOpen = useCallback(() => {
    markMazeStep(studyTask, 'assistant-open')
    setProfileSheetMode('help-assistant')
    setIsProfileOpen(true)
  }, [studyTask])

  // O assistente também é alcançado por dentro do sheet, pelo card do Centro de
  // ayuda. O marco precisa valer para todos os caminhos, senão a tarefa de ajuda
  // registraria só quem entrou pela Home.
  const handleAssistantReached = useCallback(() => {
    markMazeStep(studyTask, 'assistant-open')
  }, [studyTask])

  const handleAssistantAnswerShown = useCallback((faqId: string) => {
    if (faqId === 'price-difference') markMazeStep(studyTask, 'answer-shown')
  }, [studyTask])

  const handleProfileClose = useCallback(() => {
    setIsProfileOpen(false)
  }, [])

  const handleOnboardingClose = useCallback(() => {
    setIsOnboardingOpen(false)
  }, [])

  const handlePurchaseExecute = useCallback((details: PurchaseSuccessDetails) => {
    const result = purchase({
      roundStart: marketRound.roundStart,
      side: details.side,
      amount: details.amount,
      participations: details.participations,
    })

    return result.applied
  }, [marketRound.roundStart, purchase])

  const handleSaleExecute = useCallback((details: SaleSuccessDetails) => {
    const positionBeforeSale = currentPosition
    const costBasisBeforeSale = currentCostBasis
    const result = sell({
      roundStart: marketRound.roundStart,
      side: details.side,
      amountReceived: details.amountReceived,
      participations: details.participations,
      targetPrice: marketRound.targetPrice,
    })

    if (result.applied) {
      const remaining = getWalletPosition(
        result.state,
        marketRound.roundStart,
      )[details.side]

      // Venda parcial mantém o card, apenas com números menores; só a venda
      // total precisa da retenção, porque é a que faria o card sumir.
      if (remaining <= 0) {
        setSaleExit({
          side: details.side,
          position: positionBeforeSale,
          costBasis: costBasisBeforeSale,
          isLeaving: false,
        })
      }
    }

    return result.applied
  }, [
    currentCostBasis,
    currentPosition,
    marketRound.roundStart,
    marketRound.targetPrice,
    sell,
  ])

  const handleSaleExitEnd = useCallback(() => setSaleExit(null), [])

  const handleBetslipSuccess = useCallback((details: BetslipSuccessDetails) => {
    markMazeStep(
      studyTask,
      details.operation === 'sell' ? 'sale-complete' : 'purchase-complete',
    )
    setPurchaseSuccess(details)
    if (details.operation === 'sell') {
      setSaleExit((current) => (
        current ? { ...current, isLeaving: true } : null
      ))
    }
    setSelectedSide(null)
    setContentBottomInset(DEFAULT_CONTENT_BOTTOM_INSET)
  }, [studyTask])

  const handleBetslipOcclusionHeightChange = useCallback((height: number) => {
    setContentBottomInset(Math.max(DEFAULT_CONTENT_BOTTOM_INSET, height))
  }, [])

  const handleMarketSideSelect = useCallback((side: MarketSide) => {
    markMazeStep(studyTask, 'buy-betslip-open')
    setBetslipInitialOperationMode('buy')
    setSelectedSide(side)
  }, [studyTask])

  const handleEntrySell = useCallback((side: MarketSide) => {
    markMazeStep(studyTask, 'sell-betslip-open')
    setBetslipInitialOperationMode('sell')
    setSelectedSide(side)
  }, [studyTask])

  const handleNavigate = useCallback((item: NavbarItemId) => {
    const nextSection: AppSection = item === 'movements'
      ? 'movements'
      : item === 'entries' ? 'entries' : 'home'
    const currentNavigationTarget = pageTransitionRef.current?.target
      ?? activeSectionRef.current
    if (nextSection === currentNavigationTarget) return

    const url = new URL(window.location.href)

    url.hash = nextSection === 'movements'
      ? MOVEMENTS_HASH
      : nextSection === 'entries' ? ENTRIES_HASH : ''
    window.history.pushState(window.history.state, '', url)
    transitionToSection(nextSection)
  }, [transitionToSection])

  const handleAssistantNavigate = useCallback((action: HelpAssistantActionId) => {
    if (helpNavigationTimerRef.current !== null) {
      window.clearTimeout(helpNavigationTimerRef.current)
      helpNavigationTimerRef.current = null
    }

    if (action === 'entries') {
      handleNavigate('entries')
      return
    }

    if (action === 'movements') {
      handleNavigate('movements')
      return
    }

    handleNavigate('home')
    helpNavigationTimerRef.current = window.setTimeout(() => {
      helpNavigationTimerRef.current = null
      const previousRoundsSection = document.querySelector<HTMLElement>('.previous-rounds')
      if (!previousRoundsSection) return

      previousRoundsSection.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'center',
      })
    }, PAGE_TRANSITION_FALLBACK_MS + 100)
  }, [handleNavigate])

  const handleAnimatedRoundSeen = useCallback((roundStart: number) => {
    setLastSeenCompletedRoundStart((currentRoundStart) => (
      currentRoundStart === null
        ? roundStart
        : Math.max(currentRoundStart, roundStart)
    ))
  }, [])

  const visiblePreviousRounds = useMemo(() => {
    if (!latestCompletedRound) return marketRound.previousRounds

    const officialRound = marketRound.previousRounds.find(
      ({ roundStart }) => roundStart === latestCompletedRound.roundStart,
    )
    const newestRound = officialRound ?? latestCompletedRound

    return [
      newestRound,
      ...marketRound.previousRounds.filter(
        ({ roundStart }) => roundStart !== newestRound.roundStart,
      ),
    ].slice(0, 10)
  }, [latestCompletedRound, marketRound.previousRounds])
  // Retrato do estado real lido pelo assistente no envio de cada pergunta. Fica
  // num ref para que o getter continue estável enquanto o relógio da rodada
  // avança, e a resposta use os valores do instante em que a pessoa perguntou.
  const helpAssistantSnapshot = buildHelpAssistantSnapshot({
    isRoundClosing,
    market: {
      prices: outcomeMarket.displayPrices,
      status: outcomeMarket.status,
    },
    now: marketRound.now,
    pendingRoundStarts,
    position: currentPosition,
    positionCostCents: currentCostBasis,
    previousRounds: visiblePreviousRounds.map(({ result, roundStart }) => ({
      result,
      roundStart,
    })),
    quoteBuy: outcomeMarket.quoteBuy,
    quoteSell: outcomeMarket.quoteSell,
    round: {
      currentPrice: marketRound.currentPrice,
      endTime: marketRound.endTime,
      remainingSeconds: marketRound.remainingSeconds,
      targetPrice: marketRound.targetPrice,
    },
    settledEntries,
    wallet: profileMetrics,
  })
  const helpAssistantSnapshotRef = useRef(helpAssistantSnapshot)
  useEffect(() => {
    helpAssistantSnapshotRef.current = helpAssistantSnapshot
  })
  const getHelpAssistantSnapshot = useCallback(
    () => helpAssistantSnapshotRef.current,
    [],
  )

  const animatedPreviousRoundStart = latestCompletedRound
    && (
      lastSeenCompletedRoundStart === null
      || latestCompletedRound.roundStart > lastSeenCompletedRoundStart
    )
    ? latestCompletedRound.roundStart
    : null

  const appStyle = {
    '--pulse-content-bottom-inset': `${contentBottomInset}px`,
  } as CSSProperties
  const formattedBalance = balanceFormatter.format(balanceCents / 100)
  const hasActiveEntry = currentPosition.up > 0 || currentPosition.down > 0
  const homeSection = (
    <>
      <div ref={marketHeaderSlotRef} className="pulse-app__market-header-slot">
        <div
          className={`pulse-app__market-header${isMarketHeaderPinned ? ' pulse-app__market-header--pinned' : ''}${isMarketHeaderCompact ? ' pulse-app__market-header--compact' : ''}`}
          data-round-slug={marketRound.roundSlug}
          data-target-status={marketRound.targetStatus}
          data-target-source={marketRound.targetSource}
          data-current-status={marketRound.currentStatus}
          data-current-source={marketRound.currentPriceSource}
          data-current-updated-at={marketRound.currentPriceUpdatedAt}
          data-animated-market-price={animatedMarketPrice.value ?? ''}
          data-display-time-zone={BTC_DISPLAY_TIME_ZONE}
          data-previous-rounds-status={marketRound.previousRoundsStatus}
          data-outcome-market-status={outcomeMarket.status}
          data-outcome-market-source={outcomeMarket.source}
          data-outcome-market-locked={outcomeMarket.lockedForRound}
          data-outcome-market-up={outcomeMarket.displayPrices.up ?? ''}
          data-outcome-market-down={outcomeMarket.displayPrices.down ?? ''}
          data-outcome-market-up-asks={outcomeMarket.books.up?.asks.length ?? 0}
          data-outcome-market-down-asks={outcomeMarket.books.down?.asks.length ?? 0}
          data-outcome-market-up-bids={outcomeMarket.books.up?.bids.length ?? 0}
          data-outcome-market-down-bids={outcomeMarket.books.down?.bids.length ?? 0}
          data-outcome-market-updated-at={outcomeMarket.updatedAt ?? ''}
          data-wallet-pending-rounds={pendingRoundStartsKey}
        >
          <SubHeader
            isCompact={isMarketHeaderCompact}
            date={marketRound.date}
            startTime={marketRound.startTime}
            endTime={marketRound.endTime}
            minutes={displayedMinutes}
            seconds={displayedSeconds}
            isOnboardingOpen={isOnboardingOpen}
            isOnboardingInviting={isOnboardingInviting}
            onOnboardingOpen={handleOnboardingOpen}
          />
          <PriceComparison
            isCompact={isMarketHeaderCompact}
            targetPrice={marketRound.targetPrice}
            currentPrice={animatedMarketPrice.value}
          />
        </div>
      </div>
      <main className="pulse-app__content">
        <MarketPriceChart
          now={marketRound.now}
          points={marketRound.points}
          historyPoints={marketRound.historyPoints}
          targetPrice={marketRound.targetPrice}
          currentPrice={animatedMarketPrice.value}
          priceDirection={animatedMarketPrice.direction}
          directionAnimationSequence={
            animatedMarketPrice.directionAnimationSequence
          }
          entries={chartEntries}
          roundStart={marketRound.roundStart}
          currentSource={marketRound.currentPriceSource}
          currentStatus={marketRound.currentStatus}
          currentUpdatedAt={marketRound.currentPriceUpdatedAt}
        />
        <HomeOpenEntries
          roundStart={marketRound.roundStart}
          position={currentPosition}
          costBasis={currentCostBasis}
          successToast={purchaseSuccess}
          exitingEntry={saleExit}
          onExitEnd={handleSaleExitEnd}
          onSell={handleEntrySell}
        />
        <PreviousRounds
          animatedRoundStart={animatedPreviousRoundStart}
          onAnimatedRoundSeen={handleAnimatedRoundSeen}
          rounds={visiblePreviousRounds}
        />
        <PulseFooter
          onAssistantOpen={handleAssistantOpen}
          onHelpOpen={handleHelpOpen}
        />
      </main>
    </>
  )
  const getSectionContent = (section: AppSection) => (
    section === 'movements'
      ? <Movements movements={movements} />
      : section === 'entries'
        ? (
            <OpenEntries
              position={currentPosition}
              costBasis={currentCostBasis}
              startTime={marketRound.startTime}
              endTime={marketRound.endTime}
              minutes={displayedMinutes}
              seconds={displayedSeconds}
              targetPrice={marketRound.targetPrice}
              currentPrice={animatedMarketPrice.value}
              settledEntries={settledEntries}
              exitingEntry={saleExit}
              onExitEnd={handleSaleExitEnd}
              onViewMarket={() => handleNavigate('home')}
              onSell={handleEntrySell}
            />
          )
        : homeSection
  )
  const shouldShowHomeAction = activeSection === 'home'
    || pageTransition?.target === 'home'
  const shouldShowEntriesAction = activeSection === 'entries'
    || pageTransition?.target === 'entries'
  // `Vender` em Entradas seleciona um lado, mas o betslip só era montado na
  // Home, então o toque não abria nada. O controle de escolha UP/DOWN continua
  // exclusivo da Home.
  const shouldShowBetslip = selectedSide !== null
    && (shouldShowHomeAction || shouldShowEntriesAction)

  return (
    <>
      <div
        className={`pulse-app pulse-app--${activeSection}${pageTransition ? ` pulse-app--page-transition-${pageTransition.direction} pulse-app--page-transition-${pageTransition.phase}` : ''}${isPurchaseLoading ? ' pulse-app--purchase-loading' : ''}`}
        style={appStyle}
        data-study-version={STUDY_VERSION}
        data-study-task={studyTask}
        data-study-scenario={scenario.id}
        aria-busy={isPurchaseLoading}
        inert={isPurchaseLoading || isProfileOpen || isOnboardingOpen ? true : undefined}
      >
        <div className="pulse-app__background" aria-hidden="true" />

        <Header
          balance={formattedBalance}
          balanceCents={balanceCents}
          isProfileOpen={isProfileOpen}
          onProfileOpen={handleProfileOpen}
        />
        <div className="pulse-app__route-stage">
          {pageTransition && (
            <div
              className={`pulse-app__route pulse-app__route--outgoing pulse-app__route--${pageTransition.direction}`}
              data-active-section={pageTransition.source}
              aria-hidden="true"
              inert
              key={pageTransition.source}
              onAnimationEnd={handleOutgoingRouteAnimationEnd}
            >
              {getSectionContent(pageTransition.source)}
            </div>
          )}
          <div
            className={`pulse-app__route${pageTransition ? ` pulse-app__route--incoming pulse-app__route--${pageTransition.direction}` : ''}`}
            data-active-section={pageTransition?.target ?? activeSection}
            key={pageTransition?.target ?? activeSection}
            onAnimationEnd={pageTransition
              ? handleIncomingRouteAnimationEnd
              : undefined}
          >
            {getSectionContent(pageTransition?.target ?? activeSection)}
          </div>
        </div>

        {shouldShowBetslip ? (
          <BuyBetslip
            market={outcomeMarket}
            side={selectedSide}
            initialOperationMode={betslipInitialOperationMode}
            onSideChange={setSelectedSide}
            availableBalanceCents={balanceCents}
            participations={currentPosition}
            onOcclusionHeightChange={handleBetslipOcclusionHeightChange}
            onPurchaseLoadingChange={handlePurchaseLoadingChange}
            onPurchaseExecute={handlePurchaseExecute}
            onSaleExecute={handleSaleExecute}
            onSuccess={handleBetslipSuccess}
          />
        ) : shouldShowHomeAction && (
          <MarketChoice
            isClosing={isRoundClosing}
            prices={outcomeMarket.displayPrices}
            roundSlug={outcomeMarket.roundSlug}
            onSelect={handleMarketSideSelect}
          />
        )}
        <Navbar
          activeItem={pageTransition?.target ?? activeSection}
          hasActiveEntry={hasActiveEntry}
          onNavigate={handleNavigate}
        />

        <MobileOnly />
      </div>

      {isPurchaseLoading && (
        <div className="pulse-app__interaction-lock" aria-hidden="true" />
      )}

      {purchaseSuccess && (
        <PurchaseSuccessToast
          details={purchaseSuccess}
          onDismiss={dismissPurchaseSuccess}
        />
      )}

      {roundWin && (
        <RoundWinToast
          details={roundWin}
          onDismiss={dismissRoundWin}
        />
      )}

      <ProfileBottomSheet
        getHelpAssistantSnapshot={getHelpAssistantSnapshot}
        initialMode={profileSheetMode}
        isOpen={isProfileOpen}
        metrics={profileMetrics}
        onAssistantAnswerShown={handleAssistantAnswerShown}
        onAssistantNavigate={handleAssistantNavigate}
        onAssistantReached={handleAssistantReached}
        onClose={handleProfileClose}
      />

      <OnboardingBottomSheet
        isOpen={isOnboardingOpen}
        onClose={handleOnboardingClose}
        onComplete={handleOnboardingComplete}
      />

      {isDebug && (
        <StudyDiagnostics
          balanceCents={balanceCents}
          market={outcomeMarket}
          position={currentPosition}
          round={marketRound}
          scenario={scenario}
        />
      )}
    </>
  )
}

export default App
