import React from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from '@/components/common/UI'
import { useAuthStore, useSettingsStore } from '@/store'
import { getUserProfile, supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useTranslation } from '@/lib/i18n'

// Pages
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { ReflectionsPage } from '@/pages/ReflectionsPage'

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, setUser, setSession } = useAuthStore()
  const { setSettings } = useSettingsStore()
  const [loading, setLoading] = React.useState(true)
  const { t } = useTranslation()

  React.useEffect(() => {
    let isMounted = true

    const syncUserProfile = async (userId: string) => {
      const profile = await getUserProfile(userId)
      if (!isMounted) {
        return
      }

      setSettings(profile)
    }

    const initializeAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        await syncUserProfile(session.user.id)
      }

      setLoading(false)
    }

    initializeAuth().catch(() => {
      if (isMounted) {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        syncUserProfile(session.user.id).catch(() => {
          // Keep the app usable with local defaults if the profile fetch fails.
        })
      }

      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [setSession, setSettings, setUser])

  if (loading) {
    return <div>{t('app.loading')}</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  const { t } = useTranslation()

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-950 p-6">
        <div className="max-w-2xl w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{t('app.supabaseRequired')}</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {t('app.supabaseCreateEnv')}
          </p>
          <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-sm overflow-x-auto">
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
          </pre>
          <p className="text-gray-700 dark:text-gray-300 mt-4">
            {t('app.supabaseRestart')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <HashRouter>
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
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </ToastProvider>
    </HashRouter>
  )
}
