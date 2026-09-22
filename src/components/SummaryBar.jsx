/**
 * SummaryBar Component
 * Sticky summary showing transaction preview (recipients, total, USD value)
 *
 * All internal classes are namespaced with an 'sb-' prefix so they cannot
 * collide with legacy global styles (.summary-item, .summary-label, ...).
 * The root keeps the 'summary-bar' class purely as an external styling hook
 * (index.css targets `.summary-bar.dashboard-summary` via the className prop).
 *
 * Props:
 *   - recipientCount: number
 *   - totalAmount: number
 *   - usdValue?: number
 *   - symbol: string (ETH, USDC, etc.)
 *   - isApprovalRequired?: boolean
 *   - balanceWarning?: string|null (renders an amber inline warning chip with role="status")
 *   - className?: string
 */

// Display-only: at most 6 decimals, trailing zeros dropped (0.850000 -> 0.85)
const formatDisplay = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? String(Number(num.toFixed(6))) : '0';
};

export function SummaryBar({
  recipientCount,
  totalAmount,
  usdValue,
  symbol,
  isApprovalRequired = false,
  balanceWarning = null,
  className = ''
}) {
  return (
    <div className={`sb-bar summary-bar ${className}`}>
      <div className="sb-container">
        {/* Recipient Count */}
        <div className="sb-item">
          <span className="sb-label">Recipients</span>
          <span className="sb-value">
            {recipientCount}
          </span>
        </div>

        {/* Divider */}
        <div className="sb-divider"></div>

        {/* Total Amount */}
        <div className="sb-item sb-highlight">
          <span className="sb-label">Total {symbol}</span>
          <span className="sb-value">
            {formatDisplay(totalAmount)}
          </span>
        </div>

        {/* Average per recipient — only meaningful once there is a batch */}
        {recipientCount > 0 && totalAmount > 0 && (
          <>
            <div className="sb-divider sb-optional"></div>
            <div className="sb-item sb-optional">
              <span className="sb-label">Avg / recipient</span>
              <span className="sb-value">
                {formatDisplay(totalAmount / recipientCount)}
              </span>
            </div>
          </>
        )}

        {/* USD Value (if available) */}
        {usdValue !== undefined && usdValue > 0 && (
          <>
            <div className="sb-divider"></div>
            <div className="sb-item">
              <span className="sb-label">USD Value</span>
              <span className="sb-value">
                ${usdValue.toFixed(2)}
              </span>
            </div>
          </>
        )}

        {recipientCount === 0 && (
          <span className="sb-hint">Add recipients to see your batch totals</span>
        )}

        {/* Approval Required Badge */}
        {isApprovalRequired && (
          <>
            <div className="sb-badge sb-warning">
              <svg className="sb-badge-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
              <span>Approval Required</span>
            </div>
          </>
        )}
      </div>

      {/* Balance Warning (e.g. "Total exceeds your balance (need 4.0 ETH, have 1.2 ETH)") */}
      {balanceWarning && (
        <div className="sb-balance-warning" role="status">
          <svg className="sb-warning-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
          </svg>
          <span>{balanceWarning}</span>
        </div>
      )}

      <style>{`
        .sb-bar {
          position: sticky;
          top: 68px;
          z-index: 40;
          width: 100%;
          background: var(--bg-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          padding: var(--space-3) var(--space-5);
          margin: 0;
        }

        .sb-container {
          display: flex;
          align-items: center;
          gap: var(--space-5);
          max-width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .sb-item {
          flex: none;
          display: flex;
          flex-direction: row;
          align-items: baseline;
          gap: var(--space-2);
          white-space: nowrap;
        }

        .sb-label {
          display: inline;
          margin: 0;
          font-size: 0.6875rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-tertiary);
          font-weight: 600;
        }

        .sb-value {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--text-primary);
          font-variant-numeric: tabular-nums;
          font-family: 'JetBrains Mono', 'SF Mono', monospace;
        }

        .sb-item.sb-highlight .sb-value {
          color: var(--accent);
        }

        .sb-divider {
          flex: none;
          width: 1px;
          height: 18px;
          background: var(--border-subtle);
        }

        .sb-hint {
          margin-left: auto;
          font-size: 0.8125rem;
          color: var(--text-muted);
          white-space: nowrap;
        }

        .sb-badge {
          margin-left: auto;
          flex: none;
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }

        .sb-badge.sb-warning {
          background: var(--warning-muted);
          color: var(--warning);
        }

        .sb-badge-icon {
          flex: none;
          width: 14px;
          height: 14px;
        }

        .sb-balance-warning {
          display: inline-flex;
          align-items: flex-start;
          gap: var(--space-2);
          margin-top: var(--space-2);
          padding: var(--space-1) var(--space-3);
          border-radius: var(--radius-md);
          background: var(--warning-muted);
          color: var(--warning);
          font-size: 0.75rem;
          font-weight: 500;
          line-height: 1.5;
        }

        .sb-warning-icon {
          flex: none;
          width: 14px;
          height: 14px;
          margin-top: 2px;
        }

        /* Responsive */
        @media (max-width: 640px) {
          .sb-bar {
            padding: var(--space-3) var(--space-4);
            margin-bottom: var(--space-4);
          }

          .sb-container {
            gap: var(--space-3);
          }

          .sb-optional,
          .sb-hint {
            display: none;
          }

          .sb-label {
            font-size: 0.625rem;
          }

          .sb-value {
            font-size: 0.875rem;
          }

          .sb-item.sb-highlight .sb-value {
            font-size: 1rem;
          }

          .sb-divider {
            height: 20px;
          }

          .sb-badge {
            font-size: 0.7rem;
            padding: var(--space-1) var(--space-2);
          }

          .sb-badge-icon {
            width: 12px;
            height: 12px;
          }
        }

        /* Scrollbar styling */
        .sb-container::-webkit-scrollbar {
          height: 4px;
        }

        .sb-container::-webkit-scrollbar-track {
          background: transparent;
        }

        .sb-container::-webkit-scrollbar-thumb {
          background: var(--accent-muted);
          border-radius: var(--radius-full);
        }

        .sb-container::-webkit-scrollbar-thumb:hover {
          background: var(--accent);
        }
      `}</style>
    </div>
  );
}

export default SummaryBar;
