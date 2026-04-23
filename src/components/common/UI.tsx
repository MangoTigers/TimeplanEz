import React from 'react'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  fullScreen?: boolean
}

export const Loading: React.FC<LoadingProps> = ({ size = 'md', fullScreen = false }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }

  const spinner = (
    <div className={`${sizeClasses[size]} animate-spin`}>
      <div className="h-full w-full border-4 border-gray-200 border-t-primary-500 rounded-full dark:border-gray-700"></div>
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-950/85">
        {spinner}
      </div>
    )
  }

  return <div className="flex items-center justify-center">{spinner}</div>
}

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}

interface ToastContextType {
  showToast: (props: ToastProps) => void
}

export const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export const useToast = () => {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<(ToastProps & { id: string })[]>([])

  const showToast = (props: ToastProps) => {
    const id = Date.now().toString()
    const duration = props.duration || 3000

    setToasts((prev) => [...prev, { ...props, id }])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }

  const getBackgroundColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-success-50 dark:bg-success-900/30 border-success-200 dark:border-success-700'
      case 'error':
        return 'bg-danger-50 dark:bg-danger-900/30 border-danger-200 dark:border-danger-700'
      case 'warning':
        return 'bg-warning-50 dark:bg-warning-900/30 border-warning-200 dark:border-warning-700'
      default:
        return 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
    }
  }

  const getTextColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-success-600 dark:text-success-300'
      case 'error':
        return 'text-danger-600 dark:text-danger-300'
      case 'warning':
        return 'text-warning-600 dark:text-warning-300'
      default:
        return 'text-blue-600 dark:text-blue-300'
    }
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${getBackgroundColor(toast.type || 'info')} ${getTextColor(toast.type || 'info')} border rounded-lg px-4 py-3 shadow-lg animate-slide-in pointer-events-auto`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/55 dark:bg-black/80"
        onClick={onClose}
      ></div>
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-slate-700">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 dark:border-slate-700 p-6 bg-white dark:bg-slate-900">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-slate-300 dark:hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && <div className="border-t border-gray-200 dark:border-slate-700 p-6">{footer}</div>}
      </div>
    </div>
  )
}
