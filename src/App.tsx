import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from '@/components/common/UI'
import { useAuthStore } from '@/store'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

// Pages
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { ReflectionsPage } from '@/pages/ReflectionsPage'

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuthStore()
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setLoading(false)
      } else {
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  const rawBase = import.meta.env.BASE_URL || '/'
  const routerBase = rawBase === '/' ? '/' : rawBase.replace(/\/$/, '')

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-950 p-6">
        <div className="max-w-2xl w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Supabase Setup Required</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Create a <strong>.env.local</strong> file in the project root and add:
          </p>
          <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-sm overflow-x-auto">
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
          </pre>
          <p className="text-gray-700 dark:text-gray-300 mt-4">
            After saving the file, restart the dev server.
          </p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter basename={routerBase}>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/log-hours"
            element={
              <ProtectedRoute>
                <Navigate to="/dashboard?log=true" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reflections"
            element={
              <ProtectedRoute>
                <ReflectionsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
