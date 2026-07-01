/**
 * ApprovalCard Component
 * Step indicator card for the ERC-20 approval step (step 1 of 2)
 * Manages stages: idle, wallet (confirm in wallet), pending (on-chain), approved
 *
 * Props:
 *   - tokenSymbol: string - Token symbol (USDC, DAI, etc.)
 *   - isApproving: boolean - Legacy loading state (derives stage 'wallet')
 *   - isApproved: boolean - Legacy approved state (derives stage 'approved')
 *   - onApprove: () => void - Callback when approve button clicked
 *   - onDismiss?: () => void - Optional callback to dismiss after approval
 *   - approvalAmount?: string - Human-readable allowance, e.g. "120.5 USDC"
 *   - unlimited?: boolean - Unlimited-allowance checkbox state
 *   - onUnlimitedChange?: (v: boolean) => void - Checkbox handler (checkbox hidden when absent)
 *   - txHash?: string|null - Approval transaction hash
 *   - explorerUrl?: string|null - Explorer base URL; link = explorerUrl + '/tx/' + txHash
 *   - stage?: 'idle'|'wallet'|'pending'|'approved' - Explicit stage; defaults derive from legacy props
 */

export function ApprovalCard({
  tokenSymbol = 'Token',
  isApproving = false,
  isApproved = false,
  onApprove,
  onDismiss,
  approvalAmount,
  unlimited = false,
  onUnlimitedChange,
  txHash = null,
  explorerUrl = null,
  stage,
  className = ''
}) {
  // Back-compat: derive stage from legacy isApproving/isApproved when not provided
  const resolvedStage = stage ?? (isApproved ? 'approved' : isApproving ? 'wallet' : 'idle')
  const approved = resolvedStage === 'approved'
  const busy = resolvedStage === 'wallet' || resolvedStage === 'pending'
  const showTxLink = Boolean(
    txHash && explorerUrl && (resolvedStage === 'pending' || approved)
  )

  const buttonLabel = unlimited
    ? `Approve unlimited ${tokenSymbol}`
    : approvalAmount
      ? `Approve ${approvalAmount}`
      : `Approve ${tokenSymbol}`

  const stageLabel = resolvedStage === 'wallet'
    ? 'Confirm in your wallet…'
    : 'Approving — pending on-chain…'

  const baseDescription = `ERC-20 tokens require a one-time approval transaction before the batch send (step 2).`
  const allowanceDetail = unlimited
    ? ` An unlimited ${tokenSymbol} allowance will be requested, so future sends skip this approval.`
    : approvalAmount
      ? ` This approval covers ${approvalAmount}.`
      : ''

  return (
    <div className={`approval-card ${approved ? 'approved' : ''} ${className}`}>
      <div className="approval-content">
        {/* Icon */}
        <div className="approval-icon">
          {approved ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          ) : busy ? (
            <svg className="ac-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" opacity="0.2" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
          )}
        </div>

        {/* Text Content */}
        <div className="approval-text">
          <h3 className="approval-title">
            {approved
              ? `Step 1 of 2 · ${tokenSymbol} Approved`
              : `Step 1 of 2 · Approve ${tokenSymbol}`}
          </h3>
          <p className="approval-description">
            {approved
              ? `Approval confirmed. You can now send ${tokenSymbol} to multiple recipients (step 2).`
              : `${baseDescription}${allowanceDetail}`}
          </p>

          {/* Unlimited allowance opt-in */}
          {!approved && typeof onUnlimitedChange === 'function' && (
            <label className="approval-unlimited">
              <input
                type="checkbox"
                checked={unlimited}
                onChange={(e) => onUnlimitedChange(e.target.checked)}
                disabled={busy}
              />
              <span>Approve unlimited instead (skips future approvals)</span>
            </label>
          )}

          {/* Approval transaction link */}
          {showTxLink && (
            <a
              className="approval-tx-link"
              href={`${explorerUrl}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View approval transaction ↗
            </a>
          )}
        </div>

        {/* Action Button */}
        {!approved && (
          <button
            className="approval-button"
            onClick={onApprove}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? (
              <>
                <svg className="button-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" opacity="0.2" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
                <span>{stageLabel}</span>
              </>
            ) : (
              <span>{buttonLabel}</span>
            )}
          </button>
        )}

        {/* Approved State - Dismiss Button */}
        {approved && onDismiss && (
          <button
            className="approval-dismiss"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        )}
      </div>

      <style>{`
        .approval-card {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          padding: var(--space-5);
          border-radius: var(--radius-lg);
          background: var(--warning-muted);
          border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent);
          margin-bottom: var(--space-6);
          animation: slideIn 0.3s ease-out;
        }

        .approval-card.approved {
          background: var(--success-muted);
          border-color: color-mix(in srgb, var(--success) 35%, transparent);
          animation: pulse 0.5s ease-out;
        }

        .approval-content {
          display: flex;
          align-items: flex-start;
          gap: var(--space-4);
        }

        .approval-icon {
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--warning-muted);
          color: var(--warning);
          font-weight: 700;
        }

        .approval-card.approved .approval-icon {
          background: var(--success-muted);
          color: var(--success);
        }

        .approval-icon svg {
          width: 24px;
          height: 24px;
        }

        /* Self-contained spinner; .ac-spinner avoids the global .spinner border ring */
        .ac-spinner {
          width: 24px;
          height: 24px;
          border: none;
          animation: ac-spin 2s linear infinite;
        }

        .approval-text {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .approval-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .approval-description {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .approval-unlimited {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          font-size: 0.8125rem;
          color: var(--text-secondary);
          cursor: pointer;
          user-select: none;
          width: fit-content;
        }

        .approval-unlimited input {
          width: 14px;
          height: 14px;
          margin: 0;
          flex-shrink: 0;
          accent-color: var(--warning);
          cursor: pointer;
        }

        .approval-unlimited input:disabled {
          cursor: not-allowed;
        }

        .approval-tx-link {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-decoration: underline;
          text-underline-offset: 2px;
          width: fit-content;
          transition: color 0.15s ease;
        }

        .approval-tx-link:hover {
          color: var(--text-primary);
        }

        .approval-card.approved .approval-tx-link {
          color: var(--success);
        }

        .approval-button {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-5);
          border-radius: var(--radius-md);
          background: var(--warning);
          color: var(--bg-base);
          border: none;
          font-weight: 700;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .approval-button:hover:not(:disabled) {
          background: color-mix(in srgb, var(--warning) 90%, black);
          transform: translateY(-2px);
          box-shadow: 0 8px 16px color-mix(in srgb, var(--warning) 30%, transparent);
        }

        .approval-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .button-spinner {
          width: 16px;
          height: 16px;
          animation: ac-spin 2s linear infinite;
        }

        .approval-dismiss {
          flex-shrink: 0;
          padding: var(--space-3) var(--space-5);
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--text-primary);
          border: 1px solid var(--success);
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .approval-dismiss:hover {
          background: var(--success-muted);
          border-color: var(--success);
        }

        /* Animations */
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        @keyframes ac-spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Touch targets */
        @media (pointer: coarse) {
          .approval-button {
            min-height: 44px;
          }
        }

        /* Responsive */
        @media (max-width: 640px) {
          .approval-card {
            padding: var(--space-4);
            margin-bottom: var(--space-4);
          }

          .approval-content {
            flex-direction: column;
            align-items: stretch;
          }

          .approval-icon {
            width: 40px;
            height: 40px;
          }

          .approval-icon svg {
            width: 20px;
            height: 20px;
          }

          .approval-button {
            width: 100%;
            padding: var(--space-3) var(--space-4);
            font-size: 0.875rem;
            white-space: normal;
          }

          .approval-dismiss {
            width: 100%;
            padding: var(--space-3) var(--space-4);
          }
        }
      `}</style>
    </div>
  );
}

export default ApprovalCard;
