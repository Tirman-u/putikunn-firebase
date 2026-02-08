import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surface errors in console for debugging.
    // eslint-disable-next-line no-console
    console.error("App error:", error, info);
    this.setState({ errorInfo: info });
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleRetry = () => {
    this.setState({ error: null, errorInfo: null });
  };

  render() {
    const { error, errorInfo } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-white text-slate-800 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-2">Midagi läks valesti</h2>
          <p className="text-sm text-slate-600 mb-4">
            Näeme nüüd täpsemat veateadet. Palun tee sellest screenshot ja saada mulle.
          </p>
          <div className="rounded bg-slate-50 p-3 text-xs text-slate-700 break-words">
            {String(error)}
          </div>
          {(error?.stack || errorInfo?.componentStack) && (
            <pre className="mt-3 max-h-60 overflow-auto rounded bg-slate-50 p-3 text-[11px] text-slate-600 whitespace-pre-wrap">
              {error?.stack ? `${error.stack}\n` : ""}
              {errorInfo?.componentStack ? `\n${errorInfo.componentStack}` : ""}
            </pre>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={this.handleRetry}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Proovi uuesti
            </button>
            <button
              onClick={this.handleReload}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm"
            >
              Lae leht uuesti
            </button>
          </div>
        </div>
      </div>
    );
  }
}
