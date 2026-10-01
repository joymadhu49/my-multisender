import { useCallback, useEffect, useRef, useState } from 'react'

// Animated walkthrough of a batch send: pasted list → one signature →
// contract fan-out → every recipient paid. The loop is driven by a single
// `phase` (0–3); CSS keyframes in index.css do the drawing, keyed off the
// per-element state classes below.

// Sample batch the demo replays (illustrative, not live data)
export const DEMO_RECIPIENTS = [
  '0x742d…bE91',
  '0xAb58…eC9B',
  '0x66f8…2054',
  '0x1f90…c326',
  '0x3f5C…f0bE',
  '0xDA9d…73Cf',
]
export const DEMO_AMOUNT = '0.25'
export const DEMO_SYMBOL = 'ETH'
export const DEMO_TOTAL = '1.5'

const STEPS = [
  {
    title: 'Paste your list',
    status: `Building batch · ${DEMO_RECIPIENTS.length} recipients · ${DEMO_TOTAL} ${DEMO_SYMBOL}`,
    description: 'Drop in addresses straight from a spreadsheet — one per line for equal payouts, or address + amount for custom ones. Typos and duplicates are flagged before you sign.',
    duration: 2800,
  },
  {
    title: 'Sign once',
    status: 'Waiting for your signature',
    description: 'Your wallet shows a single confirmation that covers the whole batch. Sending an ERC-20 token? Approve it first, then this is the only signature left.',
    duration: 2600,
  },
  {
    title: 'Contract fans out',
    status: 'Sending · 1 transaction in flight',
    description: 'The MultiSend contract splits the payment and forwards each amount directly to its recipient — all inside that same transaction. Funds never sit in the contract.',
    duration: 3000,
  },
  {
    title: 'Everyone’s paid',
    status: `Confirmed · ${DEMO_RECIPIENTS.length} wallets paid in 1 transaction`,
    description: 'One transaction hash, one explorer link. On EVM chains it’s all-or-nothing: if any single transfer fails, the whole batch reverts, so nobody gets half a payout.',
    duration: 3600,
  },
]

// Two drawings of the same diagram: a wide left-to-right flow and a
// stacked one for narrow screens (SVG text would get too small if the
// wide one were simply scaled down).
const LAYOUTS = {
  wide: {
    viewBox: '0 0 1000 420',
    list: { x: 8, y: 50, w: 210, h: 320 },
    listRows: DEMO_RECIPIENTS.map((_, i) => ({ x: 26, amountX: 202, y: 132 + i * 40 })),
    listArrow: 'M224,210 L252,210',
    wallet: { x: 260, y: 170, w: 150, h: 80 },
    bubble: { x: 260, y: 86, w: 150, h: 56, tip: 'M325,142 L335,154 L345,142 Z' },
    link: 'M410,210 L500,210',
    chip: { x: 425, y: 178, w: 60, h: 22 },
    contract: { x: 500, y: 162, w: 160, h: 96 },
    fans: DEMO_RECIPIENTS.map((_, i) => {
      const cy = 210 + (i - 2.5) * 62
      return `M660,210 C700,210 700,${cy} 740,${cy}`
    }),
    recipients: DEMO_RECIPIENTS.map((_, i) => ({ x: 740, y: 210 + (i - 2.5) * 62 - 23, w: 252, h: 46 })),
    receipt: { x: 300, y: 300, w: 320, h: 34 },
  },
  tall: {
    viewBox: '0 0 400 530',
    list: { x: 12, y: 8, w: 376, h: 124 },
    listRows: DEMO_RECIPIENTS.map((_, i) => {
      const col = Math.floor(i / 3)
      return { x: 28 + col * 184, amountX: 190 + col * 184, y: 74 + (i % 3) * 23 }
    }),
    listArrow: 'M200,138 L200,160',
    wallet: { x: 110, y: 164, w: 180, h: 68 },
    bubble: { x: 300, y: 170, w: 92, h: 56, tip: 'M300,190 L292,198 L300,206 Z' },
    link: 'M200,232 L200,276',
    chip: { x: 212, y: 243, w: 48, h: 22 },
    contract: { x: 110, y: 276, w: 180, h: 68 },
    fans: DEMO_RECIPIENTS.map((_, i) => {
      const cx = 38 + i * 64.8
      return `M200,344 C200,382 ${cx},372 ${cx},402`
    }),
    recipients: DEMO_RECIPIENTS.map((_, i) => ({ cx: 38 + i * 64.8, cy: 422, r: 20 })),
    receipt: { x: 50, y: 492, w: 300, h: 30 },
  },
}

// 24×24 stroke glyphs, drawn inside a node's icon tile
const WalletGlyph = () => (
  <>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 10h18" />
    <path d="M16 14.5h2" />
  </>
)
const ContractGlyph = () => (
  <>
    <path d="M8.5 8.5L5 12l3.5 3.5" />
    <path d="M15.5 8.5L19 12l-3.5 3.5" />
    <path d="M13.5 6.5l-3 11" />
  </>
)
const CheckPath = ({ cx, cy, s = 1 }) => (
  <path
    className="fd-check-mark"
    d={`M${cx - 4.5 * s},${cy + 0.2 * s} l${3 * s},${3 * s} l${6 * s},${-6.5 * s}`}
  />
)

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}

function FlowDemo() {
  const reducedMotion = usePrefersReducedMotion()
  // Reduced motion: no autoplay, start on the finished picture
  const [phase, setPhase] = useState(() => (reducedMotion ? 3 : 0))
  const [playing, setPlaying] = useState(() => !reducedMotion)
  const [inView, setInView] = useState(false)
  const inViewRef = useRef(false)
  // Bumped on every phase entry so the drawing remounts and its keyframes replay
  const [runId, setRunId] = useState(0)
  const [variant, setVariant] = useState('wide')
  const rootRef = useRef(null)
  const stageRef = useRef(null)

  useEffect(() => {
    if (reducedMotion) setPlaying(false)
  }, [reducedMotion])

  // Only animate while on screen; replay the current step on re-entry
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting
      if (visible && !inViewRef.current) setRunId((r) => r + 1)
      inViewRef.current = visible
      setInView(visible)
    }, { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Pick the drawing that fits the stage width
  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      setVariant(entry.contentRect.width < 680 ? 'tall' : 'wide')
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Autoplay: advance through the steps and loop back to the start
  useEffect(() => {
    if (!playing || !inView) return
    const timer = setTimeout(() => {
      setPhase((p) => (p + 1) % STEPS.length)
      setRunId((r) => r + 1)
    }, STEPS[phase].duration)
    return () => clearTimeout(timer)
  }, [phase, playing, inView, runId])

  const selectStep = useCallback((i) => {
    setPlaying(false)
    setPhase(i)
    setRunId((r) => r + 1)
  }, [])

  const togglePlay = () => {
    if (!playing) setRunId((r) => r + 1)
    setPlaying((p) => !p)
  }

  // pending → active → done, relative to the step an element belongs to
  const stateOf = (step) => (phase < step ? 'is-pending' : phase === step ? 'is-active' : 'is-done')
  const running = playing && inView

  const L = LAYOUTS[variant]
  const { wallet, contract, bubble, chip, receipt, list } = L
  const contractSub = phase < 2 ? 'Verified' : phase === 2 ? `Splitting ×${DEMO_RECIPIENTS.length}…` : 'Confirmed ✓'
  const recipientState = phase < 2 ? 'is-pending' : phase === 2 ? 'is-receiving' : 'is-paid'

  return (
    <div
      ref={rootRef}
      className={`flow-demo ${running ? '' : 'is-paused'}`}
      style={{ '--fd-dur': `${STEPS[phase].duration}ms` }}
    >
      <ol className="flow-steps" aria-label="Batch send steps">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <button
              type="button"
              className={`flow-step ${i === phase ? 'is-active' : ''} ${i < phase ? 'is-done' : ''}`}
              aria-current={i === phase ? 'step' : undefined}
              onClick={() => selectStep(i)}
            >
              <span className="flow-step-num">0{i + 1}</span>
              <span className="flow-step-title">{step.title}</span>
              <span className="flow-step-bar" aria-hidden="true">
                <span
                  key={`${runId}-${i}`}
                  className={`flow-step-fill ${i === phase && running ? 'is-running' : ''}`}
                />
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="flow-stage" ref={stageRef}>
        <div className="flow-stage-head">
          <span className={`flow-status ${phase === 3 ? 'is-done' : ''}`}>
            <span className="flow-status-dot" aria-hidden="true" />
            <span className="flow-stack">
              {STEPS.map((step, i) => (
                <span key={step.title} className={i === phase ? 'is-active' : ''}>{step.status}</span>
              ))}
            </span>
          </span>
          <button
            type="button"
            className="flow-toggle"
            onClick={togglePlay}
            aria-label={running ? 'Pause demo' : 'Play demo'}
          >
            {running ? (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z" /></svg>
            )}
            <span>{running ? 'Pause' : 'Play'}</span>
          </button>
        </div>

        <div className="flow-canvas">
          <svg
            className={`flow-svg flow-svg--${variant}`}
            viewBox={L.viewBox}
            role="img"
            aria-label={`Diagram: your wallet signs one transaction, the MultiSend contract splits it and pays ${DEMO_RECIPIENTS.length} recipient wallets ${DEMO_AMOUNT} ${DEMO_SYMBOL} each.`}
          >
            <defs>
              <marker id="fd-arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path className="fd-arrowhead" d="M1,1 L9,5 L1,9" />
              </marker>
            </defs>
            <g key={`${variant}-${runId}`}>
              {/* 1 · Recipient list */}
              <g className={`fd-list ${stateOf(0)}`}>
                <rect className="fd-card" x={list.x} y={list.y} width={list.w} height={list.h} rx="12" />
                <circle className="fd-list-dot" cx={list.x + 18} cy={list.y + 23} r="4" />
                <text className="fd-label" x={list.x + 30} y={list.y + 27}>recipients.csv</text>
                <text className="fd-meta" x={list.x + list.w - 16} y={list.y + 27} textAnchor="end">{DEMO_RECIPIENTS.length} rows</text>
                <line className="fd-rule" x1={list.x} x2={list.x + list.w} y1={list.y + 44} y2={list.y + 44} />
                {DEMO_RECIPIENTS.map((addr, i) => {
                  const row = L.listRows[i]
                  return (
                    <g key={addr} className="fd-row" style={{ '--i': i }}>
                      <text className="fd-mono" x={row.x} y={row.y}>{addr}</text>
                      <text className="fd-mono fd-mono-amount" x={row.amountX} y={row.y} textAnchor="end">{DEMO_AMOUNT}</text>
                    </g>
                  )
                })}
              </g>
              <path className="fd-arrow" d={L.listArrow} markerEnd="url(#fd-arrowhead)" />

              {/* 2 · Wallet signs once */}
              <g className={`fd-node fd-node--wallet ${stateOf(1)}`}>
                <rect className="fd-ring" x={wallet.x - 5} y={wallet.y - 5} width={wallet.w + 10} height={wallet.h + 10} rx="16" />
                <rect className="fd-card fd-node-box" x={wallet.x} y={wallet.y} width={wallet.w} height={wallet.h} rx="12" />
                <rect className="fd-tile" x={wallet.x + 14} y={wallet.y + wallet.h / 2 - 17} width="34" height="34" rx="9" />
                <g className="fd-glyph" transform={`translate(${wallet.x + 19} ${wallet.y + wallet.h / 2 - 12})`}><WalletGlyph /></g>
                <text className="fd-title" x={wallet.x + 60} y={wallet.y + wallet.h / 2 - 3}>Your wallet</text>
                {phase === 1 ? (
                <>
                  <text className="fd-sub fd-sub-ask" x={wallet.x + 60} y={wallet.y + wallet.h / 2 + 15}>Signing…</text>
                  <text className="fd-sub fd-sub-ok" x={wallet.x + 60} y={wallet.y + wallet.h / 2 + 15}>Signed ✓</text>
                </>
              ) : (
                <text className="fd-sub" x={wallet.x + 60} y={wallet.y + wallet.h / 2 + 15}>{phase === 0 ? 'Ready' : 'Signed ✓'}</text>
              )}
              </g>
              <g className={`fd-bubble ${stateOf(1)}`}>
                <rect className="fd-bubble-box" x={bubble.x} y={bubble.y} width={bubble.w} height={bubble.h} rx="10" />
                <path className="fd-bubble-box" d={bubble.tip} />
                <g className="fd-bubble-ask">
                  <text className="fd-bubble-title" x={bubble.x + bubble.w / 2} y={bubble.y + 23} textAnchor="middle">
                    {variant === 'wide' ? 'Confirm transaction' : 'Confirm'}
                  </text>
                  <text className="fd-bubble-sub" x={bubble.x + bubble.w / 2} y={bubble.y + 41} textAnchor="middle">
                    {variant === 'wide' ? `${DEMO_RECIPIENTS.length} transfers · ${DEMO_TOTAL} ${DEMO_SYMBOL}` : `${DEMO_TOTAL} ${DEMO_SYMBOL}`}
                  </text>
                </g>
                <g className="fd-bubble-ok">
                  <text className="fd-bubble-title fd-bubble-title--ok" x={bubble.x + bubble.w / 2} y={bubble.y + 33} textAnchor="middle">✓ Signed</text>
                </g>
              </g>

              {/* 3 · One transaction to the contract, which fans out */}
              <g className="fd-guides">
                <path className="fd-guide" d={L.link} />
                {L.fans.map((d) => <path key={d} className="fd-guide" d={d} />)}
              </g>
              <g className={`fd-wires ${stateOf(2)}`}>
                <path className="fd-wire" d={L.link} pathLength="100" />
                {L.fans.map((d, i) => (
                  <path key={d} className="fd-wire fd-wire--fan" d={d} pathLength="100" style={{ '--i': i }} />
                ))}
                <path className="fd-comet" d={L.link} pathLength="100" />
                {L.fans.map((d, i) => (
                  <path key={d} className="fd-comet fd-comet--fan" d={d} pathLength="100" style={{ '--i': i }} />
                ))}
              </g>
              <g className={`fd-chip ${stateOf(2)}`}>
                <rect x={chip.x} y={chip.y} width={chip.w} height={chip.h} rx={chip.h / 2} />
                <text x={chip.x + chip.w / 2} y={chip.y + 15} textAnchor="middle">1 tx</text>
              </g>

              <g className={`fd-node fd-node--contract ${stateOf(2)}`}>
                <rect className="fd-ring" x={contract.x - 5} y={contract.y - 5} width={contract.w + 10} height={contract.h + 10} rx="16" />
                <rect className="fd-card fd-node-box" x={contract.x} y={contract.y} width={contract.w} height={contract.h} rx="12" />
                <rect className="fd-tile" x={contract.x + 14} y={contract.y + contract.h / 2 - 17} width="34" height="34" rx="9" />
                <g className="fd-glyph" transform={`translate(${contract.x + 19} ${contract.y + contract.h / 2 - 12})`}><ContractGlyph /></g>
                <text className="fd-title fd-title--display" x={contract.x + 60} y={contract.y + contract.h / 2 - 3}>MultiSend</text>
                <text className="fd-sub" x={contract.x + 60} y={contract.y + contract.h / 2 + 15}>{contractSub}</text>
              </g>

              {/* 4 · Recipients get paid */}
              {DEMO_RECIPIENTS.map((addr, i) => {
                const r = L.recipients[i]
                if (variant === 'wide') {
                  const cy = r.y + r.h / 2
                  return (
                    <g key={addr} className={`fd-rcpt ${recipientState}`} style={{ '--i': i }}>
                      <rect className="fd-card fd-rcpt-box" x={r.x} y={r.y} width={r.w} height={r.h} rx="10" />
                      <circle className="fd-avatar" cx={r.x + 24} cy={cy} r="11" />
                      <g className="fd-check"><circle className="fd-check-bg" cx={r.x + 24} cy={cy} r="11" /><CheckPath cx={r.x + 24} cy={cy} s={0.9} /></g>
                      <text className="fd-mono" x={r.x + 44} y={cy + 4.5}>{addr}</text>
                      <text className="fd-amount" x={r.x + r.w - 14} y={cy + 4.5} textAnchor="end">+{DEMO_AMOUNT} {DEMO_SYMBOL}</text>
                    </g>
                  )
                }
                return (
                  <g key={addr} className={`fd-rcpt ${recipientState}`} style={{ '--i': i }}>
                    <circle className="fd-card fd-rcpt-box" cx={r.cx} cy={r.cy} r={r.r} />
                    <circle className="fd-avatar" cx={r.cx} cy={r.cy} r={r.r - 7} />
                    <g className="fd-check"><circle className="fd-check-bg" cx={r.cx} cy={r.cy} r={r.r - 4} /><CheckPath cx={r.cx} cy={r.cy} s={1.1} /></g>
                    <text className="fd-mono fd-mono--tiny" x={r.cx} y={r.cy + 38} textAnchor="middle">{addr.slice(0, 6)}</text>
                    <text className="fd-amount fd-amount--tiny" x={r.cx} y={r.cy + 54} textAnchor="middle">+{DEMO_AMOUNT}</text>
                  </g>
                )
              })}

              <g className={`fd-receipt ${stateOf(3)}`}>
                <rect x={receipt.x} y={receipt.y} width={receipt.w} height={receipt.h} rx={receipt.h / 2} />
                <text x={receipt.x + receipt.w / 2} y={receipt.y + receipt.h / 2 + 4.5} textAnchor="middle">
                  ✓ 1 transaction · {DEMO_RECIPIENTS.length} recipients · {DEMO_TOTAL} {DEMO_SYMBOL}
                </text>
              </g>
            </g>
          </svg>
        </div>

        <div className="flow-caption flow-stack">
          {STEPS.map((step, i) => (
            <p key={step.title} className={i === phase ? 'is-active' : ''}>
              <span className="flow-caption-step">Step {i + 1} of {STEPS.length} · {step.title}</span>
              {step.description}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

export default FlowDemo
