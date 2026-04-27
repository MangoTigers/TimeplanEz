import React from 'react'
import { useAuthStore, useSettingsStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { LogHoursForm } from '@/components/shifts/LogHoursForm'
import { Modal, useToast } from '@/components/common/UI'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n'

interface LayoutProps {
  children: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore()
  const { settings, updateSettings } = useSettingsStore()
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const selectedTheme = settings?.theme || 'light'
  const isLogModalOpen = new URLSearchParams(location.search).get('log') === 'true'
  const { t } = useTranslation()

  const openLogModal = () => {
    const params = new URLSearchParams(location.search)
    params.set('log', 'true')
    navigate(`${location.pathname}?${params.toString()}`)
    setSidebarOpen(false)
  }

  const closeLogModal = () => {
    const params = new URLSearchParams(location.search)
    params.delete('log')
    const nextSearch = params.toString()
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`, { replace: true })
  }

  React.useEffect(() => {
    const isDark = selectedTheme === 'dark'
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.setAttribute('data-theme', selectedTheme)
  }, [selectedTheme])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      logout()
      navigate('/login')
      toast.showToast({ type: 'success', message: t('layout.logoutSuccess') })
    } catch (error) {
      toast.showToast({ type: 'error', message: t('layout.logoutError') })
    }
  }

  const menuItems = [
    { label: t('layout.dashboard'), href: '/dashboard', icon: '📊' },
    { label: t('layout.entries'), href: '/entries', icon: '🗂️' },
    { label: t('layout.analytics'), href: '/analytics', icon: '📈' },
    { label: t('layout.reflections'), href: '/reflections', icon: '📝' },
    { label: t('layout.settings'), href: '/settings', icon: '⚙️' },
  ]

  return (
    <div className={selectedTheme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
              >
                ☰
              </button>
              <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">EzTimeplan</h1>
            </div>

            <div className="flex items-center gap-4">
              <label className="hidden md:block text-sm text-gray-600 dark:text-slate-300">{t('layout.theme')}</label>
              <select
                value={selectedTheme}
                onChange={(e) => updateSettings({ theme: e.target.value })}
                className="input-base py-1 px-2 text-sm"
                title={t('layout.toggleTheme')}
              >
                <option value="light">{t('theme.light')}</option>
                <option value="dark">{t('theme.dark')}</option>
                <option value="girlie-pop">{t('theme.girliePop')}</option>
              </select>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-slate-300">{user?.email}</span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1 text-sm bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {t('layout.logout')}
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar */}
          <aside
            className={`fixed md:relative w-64 h-[calc(100vh-64px)] bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 transform transition-transform md:translate-x-0 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <nav className="p-4 space-y-2">
              <button
                type="button"
                onClick={openLogModal}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-700 dark:text-slate-200"
              >
                <span className="text-xl">➕</span>
                <span className="font-medium">{t('layout.logHours')}</span>
              </button>
              {menuItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-700 dark:text-slate-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </div>

      <Modal isOpen={isLogModalOpen} onClose={closeLogModal} title={t('layout.logHours')} maxWidthClass="max-w-3xl">
        <LogHoursForm onSaved={closeLogModal} submitLabel={t('layout.saveHours')} />
      </Modal>
    </div>
  )
}
