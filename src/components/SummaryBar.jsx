/**
 * SummaryBar Component
 * Sticky summary showing transaction preview (recipients, total, USD value)
 * 
 * Props:
 *   - recipientCount: number
 *   - totalAmount: number
 *   - usdValue?: number
 *   - symbol: string (ETH, USDC, etc.)
 *   - isApprovalRequired?: boolean
 *   - className?: string
 */

export function SummaryBar({
  recipientCount,
  totalAmount,
  usdValue,
  symbol,
  isApprovalRequired = false,
  className = ''
}) {
  return (
    <div className={`summary-bar ${className}`}>
      <div className="summary-container">
        {/* Recipient Count */}
        <div className="summary-item">
          <span className="summary-label">Recipients</span>
          <span className="summary-value">
            {recipientCount}
          </span>
        </div>

        {/* Divider */}
        <div className="summary-divider"></div>

        {/* Total Amount */}
        <div className="summary-item highlighted">
          <span className="summary-label">Total {symbol}</span>
          <span className="summary-value primary">
            {totalAmount.toFixed(6)}
          </span>
        </div>

        {/* USD Value (if available) */}
        {usdValue !== undefined && usdValue > 0 && (
          <>
            <div className="summary-divider"></div>
            <div className="summary-item">
              <span className="summary-label">USD Value</span>
              <span className="summary-value">
                ${usdValue.toFixed(2)}
              </span>
            </div>
          </>
        )}

        {/* Approval Required Badge */}
        {isApprovalRequired && (
          <>
            <div className="summary-divider"></div>
            <div className="summary-badge warning">
              <svg className="badge-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
              <span>Approval Required</span>
            </div>
          </>
        )}
      </div>

      <style>{`
        .summary-bar {
          position: sticky;
          top: 0;
          z-index: 40;
          width: 100%;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-subtle);
          backdrop-filter: blur(10px);
          padding: var(--space-4) var(--space-6);
          margin: 0 0 var(--space-6) 0;
        }

        .summary-container {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          max-width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          white-space: nowrap;
        }

        .summary-label {
          font-size: 0.625rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-tertiary);
          font-weight: 600;
        }

        .summary-value {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
          font-family: 'Monaco', 'Courier New', monospace;
        }

        .summary-value.primary {
          background: var(--gradient-accent);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-size: 1.125rem;
        }

        .summary-item.highlighted {
          flex-grow: 1;
          max-width: 200px;
        }

        .summary-divider {
          width: 1px;
          height: 24px;
          background: var(--border-subtle);
        }

        .summary-badge {
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

        .summary-badge.warning {
          background: var(--warning-muted);
          color: var(--warning);
        }

        .badge-icon {
          width: 14px;
          height: 14px;
        }

        /* Responsive */
        @media (max-width: 640px) {
          .summary-bar {
            padding: var(--space-3) var(--space-4);
            margin-bottom: var(--space-4);
          }

          .summary-container {
            gap: var(--space-3);
          }

          .summary-label {
            font-size: 0.6rem;
          }

          .summary-value {
            font-size: 0.875rem;
          }

          .summary-value.primary {
            font-size: 1rem;
          }

          .summary-divider {
            height: 20px;
          }

          .summary-badge {
            font-size: 0.7rem;
            padding: var(--space-1) var(--space-2);
          }

          .badge-icon {
            width: 12px;
            height: 12px;
          }
        }

        /* Scrollbar styling */
        .summary-container::-webkit-scrollbar {
          height: 4px;
        }

        .summary-container::-webkit-scrollbar-track {
          background: transparent;
        }

        .summary-container::-webkit-scrollbar-thumb {
          background: var(--accent-muted);
          border-radius: var(--radius-full);
        }

        .summary-container::-webkit-scrollbar-thumb:hover {
          background: var(--accent);
        }
      `}</style>
    </div>
  );
}

export default SummaryBar;
