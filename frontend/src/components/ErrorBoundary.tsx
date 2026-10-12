import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from './states'

interface Props {
  children: ReactNode
  /** When this value changes, a caught error is cleared (e.g. pass location.pathname). */
  resetKey?: unknown
  onError?: (error: unknown, info: ErrorInfo) => void
}

interface State {
  error: unknown
  hasError: boolean
  resetKey: unknown
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, hasError: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error, hasError: true }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) {
      return { resetKey: props.resetKey, error: null, hasError: false }
    }
    return null
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  reset = (): void => {
    this.setState({ error: null, hasError: false })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorState error={this.state.error} onRetry={this.reset} headingLevel="h1" />
    }
    return this.props.children
  }
}
