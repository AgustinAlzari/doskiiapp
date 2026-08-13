import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, color: 'var(--color-text-2)', fontFamily: 'monospace', fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Error:</div>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: '#999', marginTop: 8 }}>{this.state.error?.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}
