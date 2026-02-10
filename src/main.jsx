import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initTheme } from '@/lib/theme'
import { isTestEnv } from '@/lib/env'

initTheme();
if (typeof document !== 'undefined') {
  document.documentElement.dataset.env = isTestEnv() ? 'test' : 'prod';
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
