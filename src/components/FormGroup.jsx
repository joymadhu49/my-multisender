/**
 * FormGroup Component
 * Provides consistent structure for form sections with label, help text, and warning states
 * 
 * Props:
 *   - label: string - Field label
 *   - help?: string - Helper text (secondary)
 *   - warning?: string - Warning message (red)
 *   - error?: string - Error message (red)
 *   - children: ReactNode - Form input(s)
 *   - disabled?: boolean - Disabled state
 *   - className?: string - Additional classes
 */

export function FormGroup({
  label,
  help,
  warning,
  error,
  children,
  disabled = false,
  className = ''
}) {
  const hasError = !!error || !!warning;

  return (
    <div className={`form-group ${className}`}>
      {/* Label with help text */}
      <div className="form-group-header">
        <label className="form-label">
          {label}
        </label>
        {help && !hasError && (
          <span className="form-help">{help}</span>
        )}
      </div>

      {/* Content wrapper with optional visual indicator */}
      <div className={`form-content ${hasError ? 'has-error' : ''} ${disabled ? 'disabled' : ''}`}>
        {children}
      </div>

      {/* Error/Warning message */}
      {hasError && (
        <div className="form-message error">
          <svg className="form-message-icon" viewBox="0 0 24 24" fill="currentColor">
            {error ? (
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            ) : (
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            )}
          </svg>
          <span>{error || warning}</span>
        </div>
      )}

      <style>{`
        .form-group {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          margin-bottom: var(--space-6);
        }

        .form-group-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: var(--space-4);
        }

        .form-label {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .form-help {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          font-weight: 400;
          text-transform: none;
          letter-spacing: 0;
        }

        .form-content {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          padding: var(--space-3);
          border-left: 3px solid transparent;
          border-radius: var(--radius-sm);
          transition: all 0.2s ease;
        }

        .form-content.has-error {
          border-left-color: var(--error);
          background-color: var(--error-muted);
        }

        .form-content.disabled {
          opacity: 0.5;
          pointer-events: none;
        }

        .form-message {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: 0.75rem;
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-sm);
        }

        .form-message.error {
          color: var(--error);
          background-color: var(--error-muted);
        }

        .form-message-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        /* Responsive */
        @media (max-width: 640px) {
          .form-group {
            margin-bottom: var(--space-5);
          }

          .form-group-header {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--space-1);
          }
        }
      `}</style>
    </div>
  );
}

export default FormGroup;
