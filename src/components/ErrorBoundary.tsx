import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, ChevronDown, ChevronUp, Terminal } from 'lucide-react';

/**
 * Interface for ErrorBoundary component props.
 */
export interface ErrorBoundaryProps {
  /** Child component tree to be monitored for render-time errors */
  children: ReactNode;
  /** Optional custom fallback UI element or render function */
  fallbackUI?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Optional callback triggered when the user initiates a reset/recovery action */
  onReset?: () => void;
  /** Optional logging callback triggered when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * Interface for ErrorBoundary component state.
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

/**
 * ModelWatch React Error Boundary Component
 * 
 * @description
 * Catches unexpected JavaScript runtime errors anywhere in its child component tree,
 * logs those errors, and renders a fallback UI instead of crashing the entire React SPA.
 * 
 * @mounting
 * Wrapped at the top-level application root (`main.tsx`) and key component section boundaries (`App.tsx`).
 * 
 * @caught_failures
 * Catches errors during rendering, in lifecycle methods, and in constructors of the component tree below them.
 * 
 * @limitations
 * Client-side React Error Boundaries do NOT catch:
 * 1. Asynchronous event handler errors (use try/catch inside handlers).
 * 2. Asynchronous code (e.g. `setTimeout`, `fetch`, or unhandled Promise rejections).
 * 3. Server-side rendering (SSR) errors.
 * 4. Errors thrown in the ErrorBoundary component itself (rather than its children).
 * 
 * @recovery
 * Provides a deterministic `handleReset()` mechanism that resets error state and re-attempts
 * to render the child component tree, as well as a full app reload option.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false
  };

  /**
   * Updates state so the next render will show the fallback UI.
   */
  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  /**
   * Logs error details and invokes optional `onError` prop.
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Log to dev console for local debugging
    console.error('[ModelWatch ErrorBoundary] Caught component render error:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * Resets the error boundary state to allow re-rendering children.
   */
  public handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  /**
   * Toggles visibility of technical stack trace details.
   */
  public toggleDetails = (): void => {
    this.setState(prevState => ({ showDetails: !prevState.showDetails }));
  };

  public render(): ReactNode {
    const { hasError, error, errorInfo, showDetails } = this.state;
    const { children, fallbackUI } = this.props;

    if (!hasError) {
      return children;
    }

    // Support custom fallback UI prop if provided
    if (fallbackUI) {
      if (typeof fallbackUI === 'function') {
        return fallbackUI(error || new Error('Unknown component error'), this.handleReset);
      }
      return fallbackUI;
    }

    // Default ModelWatch styled fallback UI
    return (
      <div 
        className="card"
        style={{
          margin: '2rem auto',
          maxWidth: '800px',
          background: '#0F172A',
          border: '1px solid #EF4444',
          borderRadius: '0.75rem',
          padding: '2rem',
          boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.25)',
          color: '#F8FAFC',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.5rem',
            padding: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldAlert size={32} color="#EF4444" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF' }}>
              ModelWatch Component Shield Triggered
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#94A3B8' }}>
              An unexpected render exception was safely trapped by the client-side Error Boundary.
            </p>
          </div>
        </div>

        <div style={{
          background: '#1E293B',
          borderLeft: '4px solid #EF4444',
          borderRadius: '0.375rem',
          padding: '1rem',
          marginBottom: '1.5rem',
          fontSize: '0.875rem'
        }}>
          <strong style={{ color: '#FCA5A5', display: 'block', marginBottom: '0.35rem' }}>
            Captured Error: {error?.name || 'Error'}
          </strong>
          <span style={{ color: '#E2E8F0', wordBreak: 'break-word' }}>
            {error?.message || 'An unknown render error occurred in a child React component.'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <button
            onClick={this.handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.6rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}
          >
            <RefreshCw size={16} /> Reset & Try Again
          </button>

          <button
            onClick={() => window.location.reload()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#334155',
              color: '#F8FAFC',
              border: '1px solid #475569',
              borderRadius: '0.375rem',
              padding: '0.6rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Reload Application
          </button>

          <button
            onClick={this.toggleDetails}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'transparent',
              color: '#94A3B8',
              border: 'none',
              padding: '0.6rem 0.5rem',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              marginLeft: 'auto'
            }}
          >
            <Terminal size={14} />
            {showDetails ? 'Hide Diagnostics' : 'Show Diagnostics'}
            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {showDetails && (
          <div style={{
            background: '#020617',
            border: '1px solid #334155',
            borderRadius: '0.375rem',
            padding: '1rem',
            fontSize: '0.78rem',
            fontFamily: 'monospace',
            color: '#CBD5E1',
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            <div style={{ color: '#F87171', fontWeight: 600, marginBottom: '0.5rem' }}>
              Stack Trace & Component Stack:
            </div>
            <div>{error?.stack || 'No JavaScript stack trace available.'}</div>
            {errorInfo?.componentStack && (
              <div style={{ marginTop: '0.75rem', color: '#94A3B8' }}>
                <strong>React Component Tree Stack:</strong>
                <pre style={{ margin: '0.25rem 0 0 0', whiteSpace: 'pre-wrap' }}>
                  {errorInfo.componentStack}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}
