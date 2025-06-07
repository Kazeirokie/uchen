import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import Decrypt from './Decrypt'
import  TransferOwnership  from './TransferOwnership'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Decrypt />
    <TransferOwnership />
  </StrictMode>,
)
