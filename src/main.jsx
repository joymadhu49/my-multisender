import './polyfills' // MUST stay first: Buffer global for @solana/web3.js
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './appkit' // initialize Reown AppKit (createAppKit) before App mounts
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
