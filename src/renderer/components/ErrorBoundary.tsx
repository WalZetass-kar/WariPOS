import type { ErrorInfo, ReactNode } from 'react';
import React, { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { api } from '../utils/api'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
    
    // Log to backend
    api('errorLog:log', 'REACT_ERROR', error.message, error.stack, undefined, JSON.stringify(errorInfo))
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.hash = '#/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 text-center border border-slate-200 dark:border-slate-700">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Oops! Terjadi Kesalahan</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Aplikasi mengalami error. Jangan khawatir, data Anda aman.
            </p>

            {this.state.error && (
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 mb-6 text-left border border-slate-200 dark:border-slate-600">
                <p className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-400 text-white rounded-xl hover:from-primary-600 hover:to-primary-500 transition-all shadow-lg shadow-primary-500/25"
            >
              <RefreshCw className="w-5 h-5" />
              Muat Ulang Aplikasi
            </button>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
              Error telah dilaporkan ke sistem
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
