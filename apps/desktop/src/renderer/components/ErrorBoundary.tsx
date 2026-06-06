import React from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-3 p-8 text-center">
          <h1 className="text-lg font-semibold text-red-600">界面加载失败</h1>
          <p className="max-w-lg text-sm text-gray-600">{this.state.error.message}</p>
          <button
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
            onClick={() => window.location.reload()}
          >
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
