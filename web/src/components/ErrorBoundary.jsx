import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
          <div className="max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
            <div className="mb-4 text-4xl">{'!!'}</div>
            <h2 className="mb-2 text-lg font-semibold text-gray-800">
              页面出错了
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-gray-500">
              发生了意外错误。刷新页面通常能解决。
            </p>
            <pre className="mb-4 max-h-32 overflow-auto rounded bg-gray-50 p-3 text-left text-xs text-gray-400">
              {this.state.error?.message ?? '未知错误'}
            </pre>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
