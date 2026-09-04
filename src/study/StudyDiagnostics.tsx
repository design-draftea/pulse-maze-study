import type { OutcomeMarketState } from '../services/outcomeMarket.ts'
import type { PrototypeWalletPosition } from '../services/prototypeWallet.ts'
import { STUDY_VERSION } from './studyConfig.ts'
import { getCurrentMazeStep } from './studyMazeNavigation.ts'
import type { StudyMarketRoundState } from './studyMarketRound.ts'
import { resetStudyStorage } from './studyStorage.ts'
import type { StudyScenario } from './studyTypes.ts'
import './StudyDiagnostics.css'

interface StudyDiagnosticsProps {
  balanceCents: number
  market: OutcomeMarketState
  position: PrototypeWalletPosition
  round: StudyMarketRoundState
  scenario: StudyScenario
}

const formatCents = (cents: number) => `US$${(cents / 100).toFixed(2)}`

/**
 * Painel de QA. Só existe com `?debugStudy=1`, então nenhum participante o vê
 * — as URLs entregues ao Maze não carregam o parâmetro. Serve para conferir, em
 * um aparelho real, que a tarefa carregou o cenário certo e que o `mazeStep`
 * está avançando.
 */
export function StudyDiagnostics({
  balanceCents,
  market,
  position,
  round,
  scenario,
}: StudyDiagnosticsProps) {
  const rows: Array<[string, string]> = [
    ['versión', STUDY_VERSION],
    ['task', scenario.task],
    ['scenario', scenario.id],
    ['mazeStep', getCurrentMazeStep(window.location.href) ?? '—'],
    ['saldo', formatCents(balanceCents)],
    ['posición UP', position.up.toFixed(6)],
    ['posición DOWN', position.down.toFixed(6)],
    ['precio objetivo', `US$${round.targetPrice.toFixed(2)}`],
    ['precio actual', `US$${round.currentPrice.toFixed(2)}`],
    ['UP / DOWN', `${market.displayPrices.up} / ${market.displayPrices.down}`],
    ['restante', `${round.minutes}:${round.seconds}`],
    ['puntos', String(round.points.length)],
  ]

  const handleReset = () => {
    resetStudyStorage()
    window.location.reload()
  }

  return (
    <aside className="study-diagnostics" aria-label="Diagnóstico del estudio">
      {rows.map(([label, value]) => (
        <div className="study-diagnostics__row" key={label}>
          <span className="study-diagnostics__label">{label}</span>
          <span className="study-diagnostics__value">{value}</span>
        </div>
      ))}
      <button
        className="study-diagnostics__reset"
        type="button"
        onClick={handleReset}
      >
        Reiniciar escenario
      </button>
    </aside>
  )
}
