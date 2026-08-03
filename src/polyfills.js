// Node globals expected by @solana/web3.js in the browser. The production
// bundle inlines Buffer, but the Vite dev server does not — this module must
// be the FIRST import in main.jsx so it evaluates before web3.js does.
import { Buffer } from 'buffer'

if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer
}
