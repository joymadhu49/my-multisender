/**
 * RecipientInput Component
 * Textarea with quick-add functionality, parse warnings, and mode-specific placeholder
 * 
 * Props:
 *   - value: string
 *   - onChange: (value: string) => void
 *   - sendMode: 'same' | 'custom'
 *   - parseWarnings: { invalid: number, duplicates: number }
 *   - quickAddAddress: string
 *   - onQuickAddAddressChange: (value: string) => void
 *   - quickAddAmount?: string
 *   - onQuickAddAmountChange?: (value: string) => void
 *   - onQuickAdd: () => void
 *   - isQuickAddDisabled?: boolean
 */

export function RecipientInput({
  value,
  onChange,
  sendMode = 'same',
  parseWarnings = { invalid: 0, duplicates: 0 },
  quickAddAddress,
  onQuickAddAddressChange,
  quickAddAmount,
  onQuickAddAmountChange,
  onQuickAdd,
  isQuickAddDisabled = false,
}) {
  return (
    <div className="recipient-input-wrapper">
      {/* Textarea Section */}
      <div className="recipient-textarea-section">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={sendMode === 'same'
            ? "Paste addresses (one per line)\n0x742d35Cc6634C0532925a3b844Bc9e7595f5bE91\n0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
            : "Address, Amount (one per line)\n0x742d35Cc6634C0532925a3b844Bc9e7595f5bE91, 0.1\n0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B, 0.25"
          }
          className="recipient-textarea"
          rows="8"
          spellCheck="false"
        />

        {/* Paste Helper Text */}
        <div className="textarea-helper">
          <svg className="helper-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z" />
          </svg>
          <span>
            {sendMode === 'same'
              ? 'One address per line'
              : 'Format: Address, Amount (one per line)'}
          </span>
        </div>
      </div>

      {/* Quick Add Section */}
      <div className="quick-add-section">
        <div className="quick-add-inputs">
          <input
            type="text"
            value={quickAddAddress}
            onChange={(e) => onQuickAddAddressChange(e.target.value)}
            placeholder="Quick add address"
            className="quick-add-address"
            spellCheck="false"
          />

          {sendMode === 'custom' && (
            <input
              type="number"
              value={quickAddAmount || ''}
              onChange={(e) => onQuickAddAmountChange(e.target.value)}
              placeholder="Amount"
              className="quick-add-amount"
              step="any"
            />
          )}

          <button
            className="quick-add-button"
            onClick={onQuickAdd}
            disabled={isQuickAddDisabled}
            title={isQuickAddDisabled ? 'Enter valid address to add' : 'Add recipient'}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Parse Warnings */}
      {(parseWarnings.invalid > 0 || parseWarnings.duplicates > 0) && (
        <div className="parse-warnings">
          {parseWarnings.invalid > 0 && (
            <div className="warning-item invalid">
              <svg className="warning-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
              <span>
                {parseWarnings.invalid} invalid {parseWarnings.invalid === 1 ? 'entry' : 'entries'} ignored
              </span>
            </div>
          )}

          {parseWarnings.duplicates > 0 && (
            <div className="warning-item duplicate">
              <svg className="warning-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z" />
              </svg>
              <span>
                {parseWarnings.duplicates} duplicate {parseWarnings.duplicates === 1 ? 'address' : 'addresses'} removed
              </span>
            </div>
          )}
        </div>
      )}

      <style>{`
        .recipient-input-wrapper {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .recipient-textarea-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .recipient-textarea {
          width: 100%;
          padding: var(--space-4);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          color: var(--text-primary);
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 0.875rem;
          line-height: 1.6;
          resize: vertical;
          min-height: 160px;
          transition: all 0.2s ease;
        }

        .recipient-textarea::placeholder {
          color: var(--text-muted);
          opacity: 0.6;
        }

        .recipient-textarea:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 
            0 0 0 3px var(--accent-muted),
            0 0 20px rgba(30, 41, 59, 0.15);
          background: linear-gradient(
            135deg,
            var(--bg-elevated) 0%,
            rgba(30, 41, 59, 0.02) 100%
          );
        }

        .textarea-helper {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: 0.75rem;
          color: var(--text-tertiary);
        }

        .helper-icon {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
        }

        .quick-add-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .quick-add-inputs {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: var(--space-2);
        }

        /* Custom amount mode */
        .quick-add-section :has(.quick-add-amount) .quick-add-inputs {
          grid-template-columns: 1fr auto auto;
        }

        .quick-add-address,
        .quick-add-amount {
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }

        .quick-add-address::placeholder,
        .quick-add-amount::placeholder {
          color: var(--text-muted);
        }

        .quick-add-address:focus,
        .quick-add-amount:focus {
          outline: none;
          border-color: var(--accent);
          background: linear-gradient(
            135deg,
            var(--bg-surface) 0%,
            rgba(30, 41, 59, 0.02) 100%
          );
          box-shadow: 0 0 12px rgba(30, 41, 59, 0.15);
        }

        .quick-add-amount {
          max-width: 120px;
        }

        .quick-add-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          background: var(--accent);
          color: white;
          border: none;
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .quick-add-button:hover:not(:disabled) {
          background: var(--accent-hover);
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(30, 41, 59, 0.2);
        }

        .quick-add-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .quick-add-button svg {
          width: 18px;
          height: 18px;
        }

        .parse-warnings {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .warning-item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          border-left: 3px solid;
          animation: slideIn 0.2s ease-out;
        }

        .warning-item.invalid {
          background: var(--warning-muted);
          color: var(--warning);
          border-left-color: var(--warning);
        }

        .warning-item.duplicate {
          background: var(--error-muted);
          color: var(--error);
          border-left-color: var(--error);
        }

        .warning-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        /* Responsive */
        @media (max-width: 640px) {
          .recipient-textarea {
            min-height: 120px;
            font-size: 0.8125rem;
          }

          .quick-add-inputs {
            grid-template-columns: 1fr auto;
          }

          .quick-add-section :has(.quick-add-amount) .quick-add-inputs {
            grid-template-columns: 1fr;
          }

          .quick-add-amount {
            max-width: none;
            order: 2;
          }

          .quick-add-button {
            grid-column: 1 / -1;
            order: 3;
          }

          .quick-add-button span {
            display: none;
          }

          .quick-add-button svg {
            margin: 0;
          }

          .warning-item {
            padding: var(--space-2) var(--space-3);
            font-size: 0.8125rem;
          }

          .warning-icon {
            width: 14px;
            height: 14px;
          }
        }
      `}</style>
    </div>
  );
}

export default RecipientInput;
