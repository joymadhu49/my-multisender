/**
 * RecipientInput Component
 * Textarea with quick-add functionality, parse warnings, and mode-specific placeholder
 *
 * Props:
 *   - value: string
 *   - onChange: (value: string) => void
 *   - sendMode: 'same' | 'custom'
 *   - parseWarnings: { invalid: number, duplicates: number }
 *   - parseDetails?: Array<{ line: number, raw: string, reason: 'invalid-address'|'invalid-amount'|'missing-amount'|'duplicate'|'duplicate-conflict' }>
 *   - onCleanList?: () => void  // "Remove invalid lines"; button hidden when absent
 *   - quickAddAddress: string
 *   - onQuickAddAddressChange: (value: string) => void
 *   - quickAddAmount?: string
 *   - onQuickAddAmountChange?: (value: string) => void
 *   - onQuickAdd: () => void
 *   - isQuickAddDisabled?: boolean
 */

import { useId } from 'react';

const PARSE_REASON_LABELS = {
  'invalid-address': 'not a valid address',
  'invalid-amount': 'invalid amount',
  'missing-amount': 'amount missing — switch to Custom amounts or remove it',
  'duplicate': 'duplicate address',
  'duplicate-conflict': 'duplicate with a different amount — first occurrence kept',
};

export function RecipientInput({
  value,
  onChange,
  sendMode = 'same',
  parseWarnings = { invalid: 0, duplicates: 0 },
  parseDetails = [],
  onCleanList,
  quickAddAddress,
  onQuickAddAddressChange,
  quickAddAmount,
  onQuickAddAmountChange,
  onQuickAdd,
  isQuickAddDisabled = false,
}) {
  const warningsId = useId();
  const hasWarnings =
    parseWarnings.invalid > 0 ||
    parseWarnings.duplicates > 0 ||
    parseDetails.length > 0;

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
          aria-label="Recipient addresses, one per line"
          aria-describedby={warningsId}
          aria-invalid={hasWarnings}
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
            onKeyDown={(e) => { if (e.key === 'Enter' && !isQuickAddDisabled) onQuickAdd() }}
            placeholder="Quick add address"
            className="quick-add-address"
            spellCheck="false"
            aria-label="Recipient address"
          />

          {sendMode === 'custom' && (
            <input
              type="number"
              value={quickAddAmount || ''}
              onChange={(e) => onQuickAddAmountChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !isQuickAddDisabled) onQuickAdd() }}
              placeholder="Amount"
              className="quick-add-amount"
              step="any"
              aria-label="Amount"
            />
          )}

          <button
            className="quick-add-button"
            onClick={onQuickAdd}
            disabled={isQuickAddDisabled}
            aria-label="Add recipient"
            title={isQuickAddDisabled ? 'Enter valid address to add' : 'Add recipient'}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Parse Warnings — persistently mounted live region so screen readers
          announce warnings as they appear */}
      <div className="ri-warnings" id={warningsId} role="status" aria-live="polite">
        {parseWarnings.invalid > 0 && (
          <div className="ri-warning-item invalid">
            <svg className="ri-warning-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
            <span>
              {parseWarnings.invalid} invalid {parseWarnings.invalid === 1 ? 'entry' : 'entries'} ignored
            </span>
          </div>
        )}

        {parseWarnings.duplicates > 0 && (
          <div className="ri-warning-item duplicate">
            <svg className="ri-warning-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z" />
            </svg>
            <span>
              {parseWarnings.duplicates} duplicate {parseWarnings.duplicates === 1 ? 'address' : 'addresses'} removed
            </span>
          </div>
        )}
      </div>

      {/* Per-line parse details */}
      {parseDetails.length > 0 && (
        <details className="ri-details">
          <summary className="ri-details-summary">
            <svg className="ri-details-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
            <span>
              {parseDetails.length} {parseDetails.length === 1 ? 'row' : 'rows'} will be skipped
            </span>
            <svg className="ri-details-chevron" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z" />
            </svg>
          </summary>

          <ul className="ri-details-list">
            {parseDetails.map((detail, index) => (
              <li key={`${detail.line}-${index}`} className="ri-detail-row">
                <span className="ri-detail-line">Line {detail.line}</span>
                <code className="ri-detail-raw">{detail.raw}</code>
                <span className="ri-detail-reason">
                  {PARSE_REASON_LABELS[detail.reason] || detail.reason}
                </span>
              </li>
            ))}
          </ul>

          {onCleanList && (
            <button type="button" className="ri-clean-button" onClick={onCleanList}>
              Remove invalid lines
            </button>
          )}
        </details>
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
          font-family: 'JetBrains Mono', 'SF Mono', monospace;
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
          box-shadow: 0 0 0 3px var(--accent-muted);
          background: var(--bg-elevated);
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
        .quick-add-inputs:has(.quick-add-amount) {
          grid-template-columns: 1fr auto auto;
        }

        .quick-add-address,
        .quick-add-amount {
          width: 100%;
          min-width: 0;
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
          background: var(--bg-surface);
          box-shadow: 0 0 0 3px var(--accent-muted);
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
          color: var(--text-on-accent, #fff);
          border: none;
          font-weight: 500;
          font-size: 0.875rem;
          cursor: pointer;
          transition: background 0.15s ease;
          white-space: nowrap;
        }

        .quick-add-button:hover:not(:disabled) {
          background: var(--accent-hover);
        }

        .quick-add-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .quick-add-button svg {
          width: 18px;
          height: 18px;
        }

        .ri-warnings {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        /* Keep the empty live region in the accessibility tree without
           leaving a stray flex-gap slot in the layout */
        .ri-warnings:empty {
          margin-top: calc(-1 * var(--space-3));
        }

        .ri-warning-item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          border-left: 3px solid;
          animation: riSlideIn 0.2s ease-out;
        }

        .ri-warning-item.invalid {
          background: var(--warning-muted);
          color: var(--warning);
          border-left-color: var(--warning);
        }

        .ri-warning-item.duplicate {
          background: var(--error-muted);
          color: var(--error);
          border-left-color: var(--error);
        }

        .ri-warning-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .ri-details {
          border-radius: var(--radius-md);
          background: var(--warning-muted);
          border-left: 3px solid var(--warning);
          animation: riSlideIn 0.2s ease-out;
        }

        .ri-details-summary {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--warning);
          cursor: pointer;
          user-select: none;
          list-style: none;
        }

        .ri-details-summary::-webkit-details-marker {
          display: none;
        }

        .ri-details-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .ri-details-chevron {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          margin-left: auto;
          transition: transform 0.2s ease;
        }

        .ri-details[open] .ri-details-chevron {
          transform: rotate(90deg);
        }

        .ri-details-list {
          list-style: none;
          margin: 0;
          padding: 0 var(--space-4) var(--space-2);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .ri-detail-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          column-gap: var(--space-2);
          row-gap: var(--space-1);
          align-items: baseline;
          font-size: 0.8125rem;
        }

        .ri-detail-line {
          grid-column: 1;
          grid-row: 1;
          font-weight: 600;
          color: var(--warning);
          white-space: nowrap;
        }

        .ri-detail-raw {
          grid-column: 2;
          grid-row: 1;
          font-family: 'JetBrains Mono', 'SF Mono', monospace;
          font-size: 0.75rem;
          color: var(--text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ri-detail-reason {
          grid-column: 2;
          grid-row: 2;
          color: var(--warning);
        }

        .ri-clean-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin: 0 var(--space-4) var(--space-3);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-sm);
          background: transparent;
          border: 1px solid var(--warning);
          color: var(--warning);
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .ri-clean-button:hover {
          background: var(--warning-muted);
        }

        @keyframes riSlideIn {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        /* Touch targets */
        @media (pointer: coarse) {
          .quick-add-address,
          .quick-add-amount,
          .quick-add-button {
            min-height: 44px;
          }
        }

        /* Responsive */
        @media (max-width: 640px) {
          .recipient-textarea {
            min-height: 120px;
            font-size: 1rem; /* >=16px prevents iOS Safari auto-zoom on focus */
          }

          .quick-add-address,
          .quick-add-amount {
            font-size: 1rem; /* >=16px prevents iOS Safari auto-zoom on focus */
          }

          .quick-add-inputs {
            grid-template-columns: 1fr auto;
          }

          .quick-add-inputs:has(.quick-add-amount) {
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

          .ri-warning-item {
            padding: var(--space-2) var(--space-3);
            font-size: 0.8125rem;
          }

          .ri-warning-icon {
            width: 14px;
            height: 14px;
          }
        }
      `}</style>
    </div>
  );
}

export default RecipientInput;
