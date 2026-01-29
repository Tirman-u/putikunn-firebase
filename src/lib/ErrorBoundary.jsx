import React from "react";
import { base44 } from "@/api/base44Client";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
    this.lastErrorSignature = null;
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surface errors in console for debugging in base44 preview.
    // eslint-disable-next-line no-console
    console.error("App error:", error, info);
    this.setState({ errorInfo: info });
    this.logError(error, info);
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleRetry = () => {
    this.setState({ error: null, errorInfo: null });
  };

  logError = async (error, info) => {
    const message = typeof error === "string" ? error : error?.message || "Unknown error";
    const stack = error?.stack ? String(error.stack) : "";
    const componentStack = info?.componentStack ? String(info.componentStack) : "";
    const signature = `${message}\n${stack}\n${componentStack}`;
    if (this.lastErrorSignature === signature) return;
    this.lastErrorSignature = signature;

    const logger = base44?.entities?.ErrorLog?.create;
    if (!logger) return;

    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }

    const payload = {
      message,
      stack,
      component_stack: componentStack,
      url: typeof window !== "undefined" ? window.location.href : null,
      user_email: user?.email || null,
      user_id: user?.id || null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      occurred_at: new Date().toISOString()
    };

    try {
      await logger(payload);
    } catch (logError) {
      // eslint-disable-next-line no-console
      console.error("Failed to log error:", logError);
    }
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
