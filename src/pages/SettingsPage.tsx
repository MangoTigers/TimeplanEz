import React from 'react'
import { Layout } from '@/components/Layout'
import { useSettingsStore, useAuthStore, QuickTemplate } from '@/store'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/common/UI'
import { partsToHours, hoursToParts, formatHoursMinutes } from '@/lib/calculations'
import { DurationInput } from '@/components/shifts/DurationInput'

interface SettingsFormData {
  school_hours_per_week: number
  hourly_rate: number
  currency: string
  notifications_enabled: boolean
  email_digest_enabled: boolean
}

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore()
  const { settings, updateSettings, setQuickTemplates } = useSettingsStore()
  const toast = useToast()
  const [loading, setLoading] = React.useState(false)
  const [templateLabel, setTemplateLabel] = React.useState('')
  const [templateHours, setTemplateHours] = React.useState(0)
  const [templateMinutes, setTemplateMinutes] = React.useState(0)
  const [formData, setFormData] = React.useState<SettingsFormData>({
    school_hours_per_week: settings?.school_hours_per_week || 20,
    hourly_rate: settings?.hourly_rate || 120,
    currency: settings?.currency || 'NOK',
    notifications_enabled: settings?.notifications_enabled || true,
    email_digest_enabled: settings?.email_digest_enabled || true,
  })

  const schoolHoursParts = hoursToParts(formData.school_hours_per_week)

  const quickTemplates = settings?.quick_templates || []

  const handleAddTemplate = () => {
    const totalMinutes = Math.max(0, templateHours * 60 + templateMinutes)
    if (totalMinutes <= 0) {
      toast.showToast({ type: 'warning', message: 'Template duration must be at least 1 minute.' })
      return
    }

    const autoLabel = formatHoursMinutes(partsToHours(templateHours, templateMinutes))
    const template: QuickTemplate = {
      id: `tpl-${Date.now()}`,
      label: templateLabel.trim() || autoLabel,
      minutes: totalMinutes,
    }

    const updated = [...quickTemplates, template]
    setQuickTemplates(updated)
    toast.showToast({ type: 'success', message: 'Template added.' })
    setTemplateLabel('')
    setTemplateHours(0)
    setTemplateMinutes(0)
  }

  const handleDeleteTemplate = (templateId: string) => {
    const updated = quickTemplates.filter((template) => template.id !== templateId)
    setQuickTemplates(updated)
    toast.showToast({ type: 'success', message: 'Template removed.' })
  }

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
                <DurationInput
                  hours={schoolHoursParts.hours}
                  minutes={schoolHoursParts.minutes}
                  maxHours={168}
                  onHoursChange={(hours) =>
                    setFormData({
                      ...formData,
                      school_hours_per_week: partsToHours(hours, schoolHoursParts.minutes),
                    })
                  }
                  onMinutesChange={(minutes) =>
                    setFormData({
                      ...formData,
                      school_hours_per_week: partsToHours(schoolHoursParts.hours, minutes),
                    })
                  }
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Unpaid school-time quota per week ({formatHoursMinutes(formData.school_hours_per_week)})
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Hourly Rate for Paid Work
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xl">{formData.currency}</span>
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

        {/* Quick Templates */}
        <div className="card">
          <h2 className="text-xl font-bold mb-6">Quick Duration Templates</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            These templates appear on the Log Hours page for one-click duration selection.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <input
              type="text"
              value={templateLabel}
              onChange={(e) => setTemplateLabel(e.target.value)}
              className="input-base md:col-span-2"
              placeholder="Template label (optional, e.g. Quick Shift)"
            />
            <div className="md:col-span-2">
              <DurationInput
                hours={templateHours}
                minutes={templateMinutes}
                onHoursChange={setTemplateHours}
                onMinutesChange={setTemplateMinutes}
              />
            </div>
          </div>

          <button type="button" onClick={handleAddTemplate} className="btn-secondary">
            + Add Template
          </button>

          <div className="mt-4 space-y-2">
            {quickTemplates.map((template) => (
              <div key={template.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{template.label}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{formatHoursMinutes(template.minutes / 60)}</p>
                </div>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => handleDeleteTemplate(template.id)}
                >
                  Remove
                </button>
              </div>
            ))}
            {!quickTemplates.length && (
              <p className="text-sm text-gray-600 dark:text-gray-400">No templates yet.</p>
            )}
          </div>
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
