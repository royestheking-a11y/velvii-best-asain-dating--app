import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';

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

    private handleReset = () => {
        // Hard reset: Clear all local storage and reload
        // This is often the fix for mobile PWA caching issues
        if (confirm("This will clear your local data (caches, login) and reload. Continue?")) {
            localStorage.clear();
            sessionStorage.clear();
            // Unregister service workers
            navigator.serviceWorker.getRegistrations().then(function (registrations) {
                for (let registration of registrations) {
                    registration.unregister();
                }
            });
            window.location.reload();
        }
    };

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6 text-center animate-in fade-in zoom-in duration-300">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                        <span className="text-4xl">⚠️</span>
                    </div>
                    <h1 className="text-3xl font-bold mb-2">Something went wrong</h1>
                    <p className="text-slate-400 max-w-sm mb-6 text-sm">
                        We encountered an unexpected error. This usually happens due to a network glitch or outdated cache on mobile.
                    </p>

                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg text-left w-full max-w-sm mb-8 overflow-x-auto">
                        <code className="text-xs text-red-400 font-mono whitespace-pre-wrap">
                            {this.state.error?.message || 'Unknown Error'}
                        </code>
                    </div>

                    <div className="flex flex-col gap-3 w-full max-w-xs">
                        <button
                            onClick={this.handleReload}
                            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl font-medium transition-all"
                        >
                            <RefreshCw size={18} />
                            Try Reloading
                        </button>
                        <button
                            onClick={this.handleReset}
                            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 px-6 rounded-xl font-medium transition-all"
                        >
                            <Trash2 size={18} />
                            Clear Cache & Reset
                        </button>
                    </div>

                    <p className="mt-8 text-xs text-slate-600">
                        Velvii v8.0 • Error Recovery System
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}
