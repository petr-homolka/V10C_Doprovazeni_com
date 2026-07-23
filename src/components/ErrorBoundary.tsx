import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Bezpečnostní síť (2026-07-22) — bez tohohle jakákoli neodchycená chyba
 * KDEKOLI ve stromu shodí CELOU appku na prázdnou bílou obrazovku (React
 * default chování bez error boundary), beze stopy proč. Obalil se celý
 * `App.tsx` — jedna hranice stačí (appka je malá, žádné desítky nezávislých
 * "widgetů", kde by mělo smysl izolovat pád jen jedné části stránky).
 *
 * `error.message` se ukazuje NAMÍSTO abstraktní hlášky — appka je zatím
 * v aktivním vývoji s malým interním týmem, konkrétní chyba pomůže
 * nahlásit problém rychleji, než "něco se pokazilo" bez detailu.
 */
interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary zachytil chybu:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-app px-6 text-center">
          <p className="text-lg font-normal text-text-primary">Něco se pokazilo.</p>
          <p className="max-w-[420px] text-sm text-text-secondary">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Načíst znovu
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
