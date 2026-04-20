import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  contextLabel: string;
}

interface State {
  error: Error | null;
}

export class ItemizationErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Itemization error boundary [${this.props.contextLabel}]`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="editor-section">
          <h3 className="section-title">Itemization Editor Error</h3>
          <p className="section-desc">
            Rendering failed in {this.props.contextLabel}. The error is shown below so it can be fixed directly.
          </p>
          <pre className="json-preview" style={{ whiteSpace: "pre-wrap" }}>
            {this.state.error.message}
          </pre>
        </section>
      );
    }

    return this.props.children;
  }
}
