/**
 * ModeSelector Component
 * Toggle between "Same Amount" and "Custom Amounts" distribution modes
 * 
 * Props:
 *   - activeMode: 'same' | 'custom'
 *   - onChange: (mode: 'same' | 'custom') => void
 */

export function ModeSelector({ activeMode = 'same', onChange }) {
  return (
    <div className="mode-selector">
      <div className="mode-header">
        <h3 className="mode-title">Distribution Mode</h3>
        <p className="mode-subtitle">Choose how to distribute tokens</p>
      </div>

      <div className="mode-options">
        {/* Same Amount Option */}
        <button
          className={`mode-option ${activeMode === 'same' ? 'active' : ''}`}
          onClick={() => onChange('same')}
          role="radio"
          aria-checked={activeMode === 'same'}
        >
          <div className="mode-option-header">
            <div className="mode-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11z" />
              </svg>
            </div>
            <div className="mode-label">
              <span className="mode-name">Same Amount</span>
              <span className="mode-desc">Send equal amounts to all addresses</span>
            </div>
          </div>
          {activeMode === 'same' && (
            <div className="mode-check">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            </div>
          )}
        </button>

        {/* Custom Amounts Option */}
        <button
          className={`mode-option ${activeMode === 'custom' ? 'active' : ''}`}
          onClick={() => onChange('custom')}
          role="radio"
          aria-checked={activeMode === 'custom'}
        >
          <div className="mode-option-header">
            <div className="mode-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </div>
            <div className="mode-label">
              <span className="mode-name">Custom Amounts</span>
              <span className="mode-desc">Different amount for each address</span>
            </div>
          </div>
          {activeMode === 'custom' && (
            <div className="mode-check">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            </div>
          )}
        </button>
      </div>

      <style>{`
        .mode-selector {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }

        .mode-header {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .mode-title {
          font-size: 0.875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-primary);
          margin: 0;
        }

        .mode-subtitle {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          margin: 0;
          font-weight: 400;
        }

        .mode-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-3);
        }

        .mode-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4);
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          border: 2px solid var(--border-subtle);
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          color: inherit;
          font-family: inherit;
          font-size: inherit;
        }

        .mode-option:hover {
          border-color: var(--accent);
          background: linear-gradient(
            135deg,
            var(--bg-surface) 0%,
            var(--accent-muted) 100%
          );
        }

        .mode-option.active {
          border-color: var(--accent);
          background: linear-gradient(
            135deg,
            var(--accent-muted) 0%,
            rgba(124, 58, 237, 0.08) 100%
          );
          box-shadow: 0 0 20px rgba(124, 58, 237, 0.15);
        }

        .mode-option-header {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          flex: 1;
        }

        .mode-icon {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-muted);
          color: var(--accent);
        }

        .mode-icon svg {
          width: 18px;
          height: 18px;
        }

        .mode-label {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .mode-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .mode-desc {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          line-height: 1.4;
        }

        .mode-check {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent);
          color: white;
        }

        .mode-check svg {
          width: 14px;
          height: 14px;
        }

        /* Responsive */
        @media (max-width: 640px) {
          .mode-selector {
            margin-bottom: var(--space-5);
          }

          .mode-options {
            grid-template-columns: 1fr;
            gap: var(--space-2);
          }

          .mode-option {
            padding: var(--space-3);
            flex-direction: column;
            align-items: flex-start;
            gap: var(--space-2);
          }

          .mode-option-header {
            width: 100%;
          }

          .mode-check {
            align-self: flex-end;
            margin-top: var(--space-1);
          }
        }
      `}</style>
    </div>
  );
}

export default ModeSelector;
