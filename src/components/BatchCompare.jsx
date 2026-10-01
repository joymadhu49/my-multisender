import { DEMO_RECIPIENTS, DEMO_AMOUNT, DEMO_SYMBOL } from './FlowDemo'

// Side-by-side: paying the demo batch one transfer at a time vs. one
// MultiSend transaction. Counts only — no invented gas or price figures.
const n = DEMO_RECIPIENTS.length

const Stats = ({ count }) => (
  <dl className="compare-stats">
    <div><dt>Transactions</dt><dd>{count}</dd></div>
    <div><dt>Signatures</dt><dd>{count}</dd></div>
    <div><dt>Explorer links</dt><dd>{count}</dd></div>
  </dl>
)

function BatchCompare() {
  return (
    <div className="compare">
      <article className="compare-card">
        <header className="compare-head">
          <span className="compare-kicker">Without batching</span>
          <h3>{n} transfers, one at a time</h3>
        </header>
        <ul className="compare-txs">
          {DEMO_RECIPIENTS.map((addr, i) => (
            <li key={addr} className="compare-tx">
              <span className="compare-tx-id">Tx {i + 1}</span>
              <span className="compare-tx-addr">{addr}</span>
              <span className="compare-tx-sign">Sign</span>
            </li>
          ))}
        </ul>
        <Stats count={n} />
      </article>

      <article className="compare-card is-better">
        <header className="compare-head">
          <span className="compare-kicker">With MultiSend</span>
          <h3>{n} transfers, one transaction</h3>
        </header>
        <div className="compare-batch">
          <div className="compare-tx is-batch">
            <span className="compare-tx-id">Tx 1</span>
            <span className="compare-tx-addr">MultiSend · sendNative</span>
            <span className="compare-tx-sign">Sign</span>
          </div>
          <ul className="compare-tree">
            {DEMO_RECIPIENTS.map((addr) => (
              <li key={addr}>
                <span className="compare-tx-addr">{addr}</span>
                <span className="compare-tree-amt">{DEMO_AMOUNT} {DEMO_SYMBOL}</span>
              </li>
            ))}
          </ul>
        </div>
        <Stats count={1} />
      </article>

      <p className="compare-note">
        Every EVM transaction carries a fixed 21,000-gas overhead before it moves a single token. Batching pays that overhead once instead of once per recipient — the longer the list, the more you save.
      </p>
    </div>
  )
}

export default BatchCompare
