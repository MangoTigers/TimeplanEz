import React from 'react'
import { Layout } from '@/components/Layout'
import { useSettingsStore, useAuthStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/common/UI'

interface SettingsFormData {
  school_hours_per_week: number
  hourly_rate: number
  currency: string
  notifications_enabled: boolean
  email_digest_enabled: boolean
}

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore()
  const { settings, updateSettings } = useSettingsStore()
  const toast = useToast()
  const [loading, setLoading] = React.useState(false)
  const [formData, setFormData] = React.useState<SettingsFormData>({
    school_hours_per_week: settings?.school_hours_per_week || 20,
    hourly_rate: settings?.hourly_rate || 120,
    currency: settings?.currency || 'NOK',
    notifications_enabled: settings?.notifications_enabled || true,
    email_digest_enabled: settings?.email_digest_enabled || true,
  })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)

    try {
      const { error } = await supabase
        .from('users')
        .update(formData)
        .eq('id', user.id)

      if (error) throw error

      updateSettings(formData)
      toast.showToast({ type: 'success', message: 'Settings saved successfully!' })
    } catch (error: any) {
      toast.showToast({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>

        {/* Work Hours Settings */}
        <div className="card">
          <h2 className="text-xl font-bold mb-6">Work Hours Configuration</h2>
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                School Hours Per Week
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min="0"
                  max="168"
                  step="1"
                  value={formData.school_hours_per_week}
                  onChange={(e) =>
                    setFormData({ ...formData, school_hours_per_week: parseInt(e.target.value) })
                  }
                  className="input-base w-32"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Hours per week that are unpaid (school hours)
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Hourly Rate for Paid Work
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xl">{settings?.currency || 'NOK'}</span>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })}
                  className="input-base flex-1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="input-base w-full max-w-xs"
              >
                <option value="NOK">Norwegian Krone (kr)</option>
                <option value="EUR">Euro (€)</option>
                <option value="USD">US Dollar ($)</option>
              </select>
            </div>

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Saving...' : '💾 Save Settings'}
            </button>
          </form>
        </div>

        {/* Notification Settings */}
        <div className="card">
          <h2 className="text-xl font-bold mb-6">Notifications</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <input
                type="checkbox"
                checked={formData.notifications_enabled}
                onChange={(e) =>
                  setFormData({ ...formData, notifications_enabled: e.target.checked })
                }
                className="w-4 h-4"
              />
              <div>
                <p className="font-medium">Browser Notifications</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get notifications when it's time to log hours
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <input
                type="checkbox"
                checked={formData.email_digest_enabled}
                onChange={(e) =>
                  setFormData({ ...formData, email_digest_enabled: e.target.checked })
                }
                className="w-4 h-4"
              />
              <div>
                <p className="font-medium">Weekly Email Digest</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Receive weekly summary of your hours and earnings every Sunday
                </p>
              </div>
            </label>

            <button type="submit" disabled={loading} className="btn-primary mt-6">
              {loading ? 'Saving...' : '💾 Save Settings'}
            </button>
          </form>
        </div>

        {/* Account Settings */}
        <div className="card">
          <h2 className="text-xl font-bold mb-6">Account Information</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
              <p className="font-medium text-gray-900 dark:text-white">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Account Created</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('nb-NO') : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="card border-2 border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20">
          <p className="text-sm text-primary-900 dark:text-primary-200">
            💡 <strong>How it works:</strong> Hours are automatically marked as paid or unpaid based on your school hours setting.
            Any hours beyond your weekly school hours quota are marked as paid and contribute to your earnings. You can manually
            override individual shifts if needed.
          </p>
        </div>
      </div>
    </Layout>
  )
}
