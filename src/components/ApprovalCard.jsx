/**
 * ApprovalCard Component
 * Prominent card showing token approval requirement with action button
 * Manages states: ready, approving, approved
 * 
 * Props:
 *   - tokenSymbol: string - Token symbol (USDC, DAI, etc.)
 *   - isApproving: boolean - Loading state
 *   - isApproved: boolean - Approved state (shows checkmark)
 *   - onApprove: () => void - Callback when approve button clicked
 *   - onDismiss?: () => void - Optional callback to dismiss after approval
 */

export function ApprovalCard({
  tokenSymbol = 'Token',
  isApproving = false,
  isApproved = false,
  onApprove,
  onDismiss,
  className = ''
}) {
  return (
    <div className={`approval-card ${isApproved ? 'approved' : ''} ${className}`}>
      <div className="approval-content">
        {/* Icon */}
        <div className="approval-icon">
          {isApproved ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          ) : isApproving ? (
            <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            {isApproved
              ? `${tokenSymbol} Approved`
              : 'Token Approval Required'}
          </h3>
          <p className="approval-description">
            {isApproved
              ? `You can now send ${tokenSymbol} to multiple recipients`
              : `You need to approve ${tokenSymbol} before sending. This is a one-time action.`}
          </p>
        </div>

        {/* Action Button */}
        {!isApproved && (
          <button
            className="approval-button"
            onClick={onApprove}
            disabled={isApproving}
            aria-busy={isApproving}
          >
            {isApproving ? (
              <>
                <svg className="button-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" opacity="0.2" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
                <span>Approving...</span>
              </>
            ) : (
              <>
                <span>Approve {tokenSymbol}</span>
              </>
            )}
          </button>
        )}

        {/* Approved State - Dismiss Button */}
        {isApproved && onDismiss && (
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
          background: linear-gradient(
            135deg,
            var(--warning-muted) 0%,
            rgba(255, 170, 0, 0.04) 100%
          );
          border: 1px solid var(--warning);
          border-opacity: 0.3;
          margin-bottom: var(--space-6);
          animation: slideIn 0.3s ease-out;
        }

        .approval-card.approved {
          background: linear-gradient(
            135deg,
            var(--success-muted) 0%,
            rgba(0, 255, 136, 0.04) 100%
          );
          border-color: var(--success);
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

        .approval-icon .spinner {
          animation: spin 2s linear infinite;
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
          background: var(--accent-hover);
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(255, 170, 0, 0.3);
        }

        .approval-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .button-spinner {
          width: 16px;
          height: 16px;
          animation: spin 2s linear infinite;
        }

        .approval-dismiss {
          flex-shrink: 0;
          padding: var(--space-3) var(--space-5);
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--text-primary);
          border: 1px solid var(--success);
          border-opacity: 0.3;
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

        @keyframes spin {
          to {
            transform: rotate(360deg);
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
