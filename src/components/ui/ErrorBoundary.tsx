import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-danger-bg rounded-full flex items-center justify-center mb-4">
            <AlertTriangle size={32} className="text-danger" />
          </div>
          <h2 className="text-xl font-bold text-content-primary mb-2">Something went wrong</h2>
          <p className="text-sm text-content-secondary max-w-md mb-6">
            An unexpected error occurred in this component. Our team has been notified.
          </p>
          <div className="bg-surface border border-border p-4 rounded-lg text-left w-full max-w-2xl overflow-auto mb-6">
            <code className="text-xs text-danger-fg font-mono whitespace-pre-wrap">
              {this.state.error?.toString()}
            </code>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-fg rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm"
          >
            <RefreshCw size={16} /> Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
