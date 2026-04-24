import React from 'react'
import { supabase, ensureUserProfile } from '@/lib/supabase'
import { useAuthStore } from '@/store'
import { useToast } from '@/components/common/UI'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n'

export const LoginPage: React.FC = () => {
  const toast = useToast()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [loading, setLoading] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [isSignUp, setIsSignUp] = React.useState(false)
  const { setUser, setSession } = useAuthStore()

  React.useEffect(() => {
    // Check if already logged in
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        setSession(session)
        navigate('/dashboard')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: email.split('@')[0],
            },
          },
        })

        if (error) throw error

        if (data.user && data.session) {
          // When email confirmation is disabled, signup can return an active session immediately.
          await ensureUserProfile(data.user)
          setUser(data.user)
          setSession(data.session)
          toast.showToast({ type: 'success', message: t('login.createdAndLoggedIn') })
          navigate('/dashboard')
        } else {
          // With email confirmation enabled, the profile row is created by DB trigger after auth user creation.
          toast.showToast({
            type: 'success',
            message: t('login.createdConfirmEmail'),
          })
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        if (data.user && data.session) {
          await ensureUserProfile(data.user)
          setUser(data.user)
          setSession(data.session)
          toast.showToast({ type: 'success', message: t('login.loggedIn') })
          navigate('/dashboard')
        }
      }
    } catch (error: any) {
      toast.showToast({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2">
            EzTimeplan
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('login.tagline')}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('login.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base w-full"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('login.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base w-full"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? t('common.loading') : isSignUp ? t('login.signUp') : t('login.logIn')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-primary-600 dark:text-primary-400 hover:underline text-sm"
          >
            {isSignUp ? t('login.haveAccount') : t('login.noAccount')}
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
          <p className="text-center">{t('login.demoTitle')}</p>
          <p className="text-center mt-1">Email: demo@example.com</p>
          <p className="text-center">Password: demo123456</p>
        </div>
      </div>
    </div>
  )
}
