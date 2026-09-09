import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Home, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, showDetails: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Quantix Retail OS - Uncaught React error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center p-6 text-on-surface">
          <div className="max-w-md w-full bg-surface-container-low rounded-3xl p-8 border border-error/30 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-error-container text-on-error-container flex items-center justify-center shadow-inner">
              <AlertOctagon className="w-8 h-8 text-error" />
            </div>

            <div className="space-y-2">
              <h1 className="font-headline-md text-title-lg font-bold text-on-surface">
                Ocurrió un error en la vista
              </h1>
              <p className="font-body-md text-body-sm text-on-surface-variant leading-relaxed">
                El sistema detectó una excepción en la interfaz. Tus datos persistidos y ventas en la base de datos están seguros.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-5 py-2.5 bg-primary text-on-primary hover:opacity-90 font-title-md text-body-sm font-bold rounded-full shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Recargar Módulo</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-5 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface font-title-md text-body-sm font-semibold rounded-full border border-surface-container-high transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Ir al Inicio</span>
              </button>
            </div>

            {this.state.error && (
              <div className="pt-2 text-left border-t border-surface-container-high/60">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="text-xs font-semibold text-on-surface-variant hover:text-on-surface flex items-center gap-1 mx-auto cursor-pointer"
                >
                  <span>{this.state.showDetails ? 'Ocultar' : 'Ver'} detalles técnicos</span>
                  {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {this.state.showDetails && (
                  <div className="mt-3 p-3 bg-surface-container-lowest rounded-xl border border-surface-container-high font-mono text-[11px] text-error overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                    <p className="font-bold">{this.state.error.toString()}</p>
                    {this.state.errorInfo?.componentStack && (
                      <p className="mt-2 text-on-surface-variant text-[10px] leading-tight">
                        {this.state.errorInfo.componentStack}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
