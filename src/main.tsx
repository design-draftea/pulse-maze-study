import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { resumeMazeAutoEnd } from './services/mazeStep'
import { installTask1ViewportExperiment } from './services/mazeTask1Viewport'

const disposeViewportExperiment = installTask1ViewportExperiment()
if (import.meta.hot) import.meta.hot.dispose(disposeViewportExperiment)
resumeMazeAutoEnd()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
