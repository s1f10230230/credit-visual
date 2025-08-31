import React from 'react'
import ReactDOM from 'react-dom/client'
import AppWithAuth from './AppWithAuth'
import './index.css'
import './debug-rakuten-apple'
import './test-rakuten-live'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithAuth />
  </React.StrictMode>,
)