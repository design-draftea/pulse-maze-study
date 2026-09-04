import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { StudyInvalidLink } from './study/StudyInvalidLink.tsx'
import { initializeStudy } from './study/studyScenarios.ts'

// O cenário é preparado antes do primeiro render: a carteira, o onboarding e o
// relógio da tarefa precisam já estar no lugar quando a interface montar, senão
// o participante veria o estado anterior por um quadro.
const resolution = initializeStudy()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {resolution.status === 'ready' ? <App /> : <StudyInvalidLink />}
  </StrictMode>,
)
