import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = { failed: false };

  public static getDerivedStateFromError(): State {
    return { failed: true };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application render failure', error, info.componentStack);
  }

  public override render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="centered-state" role="alert">
          <section className="auth-card">
            <p className="eyebrow">Application error</p>
            <h1>Something went wrong.</h1>
            <p>Reload the page. Your server-side session remains protected.</p>
            <button type="button" onClick={() => window.location.reload()}>
              Reload application
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
