import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import i18n from "../i18n";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Keeps a crash in one page from taking down the whole window. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[MacSweep] UI error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty-state error-boundary">
        <AlertTriangle size={48} />
        <h3>{i18n.t("errors.pageCrashed")}</h3>
        <p className="error-boundary-detail">{this.state.error.message}</p>
        <button
          className="btn btn-secondary"
          style={{ marginTop: 16 }}
          onClick={() => this.setState({ error: null })}
        >
          <RotateCcw size={14} />
          {i18n.t("common.tryAgain")}
        </button>
      </div>
    );
  }
}
