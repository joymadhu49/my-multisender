/**
 * ModeSelector — compact segmented control
 * Props: activeMode: 'same' | 'custom', onChange
 */
export function ModeSelector({ activeMode = 'same', onChange }) {
  return (
    <div className="mode-selector">
      <div className="mode-header">
        <span className="mode-title">Distribution Mode</span>
        <span className="mode-subtitle">
          {activeMode === 'same'
            ? 'Same amount to all recipients'
            : 'Different amount per recipient'}
        </span>
      </div>

      <div className="mode-segmented" role="radiogroup" aria-label="Distribution mode">
        <button
          type="button"
          className={`mode-seg-btn ${activeMode === 'same' ? 'active' : ''}`}
          onClick={() => onChange('same')}
          role="radio"
          aria-checked={activeMode === 'same'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="12" x2="21" y2="12"/>
          </svg>
          <span>Same</span>
        </button>
        <button
          type="button"
          className={`mode-seg-btn ${activeMode === 'custom' ? 'active' : ''}`}
          onClick={() => onChange('custom')}
          role="radio"
          aria-checked={activeMode === 'custom'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M6 12h12M9 18h6"/>
          </svg>
          <span>Custom</span>
        </button>
      </div>

      <style>{`
        .mode-selector {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
          margin-bottom: var(--space-4);
          flex-wrap: wrap;
        }
        .mode-header {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .mode-title {
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .mode-subtitle {
          font-size: 0.8125rem;
          color: var(--text-tertiary);
        }
        .mode-segmented {
          display: inline-flex;
          padding: 3px;
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
        }
        .mode-seg-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 32px;
          padding: 0 12px;
          border-radius: 7px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-tertiary);
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease;
          font-family: inherit;
        }
        .mode-seg-btn:hover { color: var(--text-secondary); }
        .mode-seg-btn.active {
          background: var(--bg-raised);
          color: var(--text-primary);
          box-shadow: var(--shadow-sm);
        }
        .mode-seg-btn svg { width: 14px; height: 14px; }
        @media (max-width: 640px) {
          .mode-selector { flex-direction: column; align-items: stretch; }
          .mode-segmented { width: 100%; }
          .mode-seg-btn { flex: 1; justify-content: center; }
        }
      `}</style>
    </div>
  );
}

export default ModeSelector;
