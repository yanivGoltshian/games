import { Component, type ErrorInfo, type ReactNode } from 'react';
import { PuppyMascotArt } from '../art/mascot';

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * When this value changes the boundary clears a caught error and re-renders
   * its children. App passes the current route key so navigating away (or
   * pressing the friendly "back home" button) recovers automatically.
   */
  resetKey?: string | number;
  /** Invoked when the child presses the friendly recovery button. */
  onReset?: () => void;
  /** Optional hook so tests/caregivers can observe crashes. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render/runtime crashes anywhere in the routed content so Sean never
 * faces a blank white screen. The fallback is calm, wordless-friendly, and
 * offers a single big button back to the home portals.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log for the developer/caregiver console; never surface raw errors to the child.
    console.error('A screen crashed and was recovered by ErrorBoundary', error, info);
    this.props.onError?.(error, info);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="page error-page" aria-label="משהו קטן נתקע">
          <section className="lock-card error-card" role="alert">
            <PuppyMascotArt className="error-card__mascot" label="הכלב שלנו מחכה לך" mood="happy" />
            <h1>אופס! משהו קטן נתקע</h1>
            <p>לא נורא, זה קורה. בואו נחזור לדף הבית וננסה שוב.</p>
            <button className="primary-button" onClick={this.handleReset} type="button">
              חזרה לדף הבית
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
