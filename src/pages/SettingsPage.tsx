import React from 'react'
import { Layout } from '@/components/Layout'
import { useSettingsStore, useAuthStore, useShiftStore, QuickTemplate } from '@/store'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/common/UI'
import { partsToHours, hoursToParts, formatHoursMinutes } from '@/lib/calculations'
import { DurationInput } from '@/components/shifts/DurationInput'
import { defaultCategories } from '@/lib/reflections'

interface SettingsFormData {
  school_hours_per_week: number
  use_school_hours_mode: boolean
  hourly_rate: number
  currency: string
  openai_api_key: string
  notifications_enabled: boolean
  email_digest_enabled: boolean
  custom_categories: string[]
}

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore()
  const { shifts, setShifts } = useShiftStore()
  const { settings, updateSettings, setQuickTemplates } = useSettingsStore()
  const toast = useToast()
  const [loading, setLoading] = React.useState(false)
  const [deleteBeforeDate, setDeleteBeforeDate] = React.useState('')
  const [deletingLogs, setDeletingLogs] = React.useState(false)
  const [templateLabel, setTemplateLabel] = React.useState('')
  const [templateHours, setTemplateHours] = React.useState(0)
  const [templateMinutes, setTemplateMinutes] = React.useState(0)
  const [newCategory, setNewCategory] = React.useState('')
  const [formData, setFormData] = React.useState<SettingsFormData>({
    school_hours_per_week: settings?.school_hours_per_week || 20,
    use_school_hours_mode: settings?.use_school_hours_mode ?? true,
    hourly_rate: settings?.hourly_rate || 120,
    currency: settings?.currency || 'NOK',
    openai_api_key: settings?.openai_api_key || '',
    notifications_enabled: settings?.notifications_enabled || true,
    email_digest_enabled: settings?.email_digest_enabled || true,
    custom_categories: settings?.custom_categories?.length ? settings.custom_categories : defaultCategories,
  })

  React.useEffect(() => {
    if (!settings) {
      return
    }

    setFormData({
      school_hours_per_week: settings.school_hours_per_week,
      use_school_hours_mode: settings.use_school_hours_mode ?? true,
      hourly_rate: settings.hourly_rate,
      currency: settings.currency,
      openai_api_key: settings.openai_api_key ?? '',
      notifications_enabled: settings.notifications_enabled,
      email_digest_enabled: settings.email_digest_enabled,
      custom_categories: settings.custom_categories?.length ? settings.custom_categories : defaultCategories,
    })
  }, [settings])

  const schoolHoursParts = hoursToParts(formData.school_hours_per_week)
  const settingsFormId = 'settings-main-form'

  const settingsSections = [
    { id: 'work-hours', label: 'Work Hours' },
    { id: 'custom-categories', label: 'Categories' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'ai-settings', label: 'AI Settings' },
    { id: 'quick-templates', label: 'Quick Templates' },
    { id: 'account', label: 'Account' },
    { id: 'log-cleanup', label: 'Log Cleanup' },
    { id: 'info', label: 'Info' },
  ]
  const [mobileSectionId, setMobileSectionId] = React.useState(settingsSections[0].id)

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

  const persistSettings = async () => {
    if (!user) return

    setLoading(true)

    try {
      const coreSettingsPayload = {
        school_hours_per_week: formData.school_hours_per_week,
        hourly_rate: formData.hourly_rate,
        currency: formData.currency,
        notifications_enabled: formData.notifications_enabled,
        email_digest_enabled: formData.email_digest_enabled,
      }

      const { error: coreError } = await supabase
        .from('users')
        .update(coreSettingsPayload)
        .eq('id', user.id)

      if (coreError) throw coreError

      // Optional columns may not exist in older databases.
      const optionalPayload = {
        use_school_hours_mode: formData.use_school_hours_mode,
        openai_api_key: formData.openai_api_key || null,
        custom_categories: formData.custom_categories,
      }

      const { error: optionalError } = await supabase
        .from('users')
        .update(optionalPayload)
        .eq('id', user.id)

      if (optionalError) {
        toast.showToast({
          type: 'warning',
          message: 'Core settings saved. Run latest DB migration to enable AI key and school-hours mode toggle.',
        })
      }

      updateSettings(formData)
      toast.showToast({ type: 'success', message: 'Settings saved successfully!' })
    } catch (error: any) {
      toast.showToast({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    await persistSettings()
  }

  const handleAddCategory = () => {
    const value = newCategory.trim()
    if (!value) return

    const exists = formData.custom_categories.some((category) => category.toLowerCase() === value.toLowerCase())
    if (exists) {
      toast.showToast({ type: 'warning', message: 'Category already exists.' })
      return
    }

    setFormData({ ...formData, custom_categories: [...formData.custom_categories, value] })
    setNewCategory('')
  }

  const handleRemoveCategory = (categoryToRemove: string) => {
    const next = formData.custom_categories.filter((category) => category !== categoryToRemove)
    if (!next.length) {
      toast.showToast({ type: 'warning', message: 'At least one category is required.' })
      return
    }
    setFormData({ ...formData, custom_categories: next })
  }

  const handleDeleteOldLogs = async () => {
    if (!user || !deleteBeforeDate) {
      toast.showToast({ type: 'warning', message: 'Pick a cutoff date first.' })
      return
    }

    setDeletingLogs(true)

    try {
      const { data, error } = await supabase
        .from('shifts')
        .delete()
        .eq('user_id', user.id)
        .lt('date', deleteBeforeDate)
        .select('id')

      if (error) throw error

      const deletedIds = new Set((data || []).map((shift) => shift.id))
      setShifts(shifts.filter((shift) => !deletedIds.has(shift.id)))

      toast.showToast({
        type: 'success',
        message: `Deleted ${deletedIds.size} old log${deletedIds.size === 1 ? '' : 's'}.`,
      })
      setDeleteBeforeDate('')
    } catch (error: any) {
      toast.showToast({ type: 'error', message: error.message || 'Failed to delete old logs.' })
    } finally {
      setDeletingLogs(false)
    }
  }

  const jumpToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId)
    if (!section) {
      return
    }

    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.history.replaceState(null, '', `#${sectionId}`)
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto pb-32 xl:pb-0">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_18rem] gap-8 items-start">
          <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>

            <form id={settingsFormId} onSubmit={handleSave} className="space-y-8">
              {/* Work Hours Settings */}
              <div id="work-hours" className="card scroll-mt-24">
                <h2 className="text-xl font-bold mb-6">Work Hours Configuration</h2>
                <div className="space-y-6">
                  <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.use_school_hours_mode}
                      onChange={(e) =>
                        setFormData({ ...formData, use_school_hours_mode: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="font-medium">Enable School Hours Mode</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        When enabled, auto mode can split shifts into unpaid school hours and paid hours.
                      </p>
                    </div>
                  </label>

                  {formData.use_school_hours_mode && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        School Hours Per Week
                      </label>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
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
                  )}

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
                </div>
              </div>

              {/* Categories */}
              <div id="custom-categories" className="card scroll-mt-24">
                <h2 className="text-xl font-bold mb-6">Custom Categories</h2>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="input-base flex-1"
                    placeholder="Add category name"
                  />
                  <button type="button" onClick={handleAddCategory} className="btn-secondary">
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.custom_categories.map((category) => (
                    <span key={category} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-sm">
                      {category}
                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(category)}
                        className="text-danger-600 dark:text-danger-400"
                        title={`Remove ${category}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Notification Settings */}
              <div id="notifications" className="card scroll-mt-24">
                <h2 className="text-xl font-bold mb-6">Notifications</h2>
                <div className="space-y-4">
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
                </div>
              </div>

              {/* AI Settings */}
              <div id="ai-settings" className="card scroll-mt-24">
                <h2 className="text-xl font-bold mb-6">AI Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      OpenAI API Key
                    </label>
                    <input
                      type="password"
                      value={formData.openai_api_key}
                      onChange={(e) => setFormData({ ...formData, openai_api_key: e.target.value.trim() })}
                      className="input-base w-full"
                      placeholder="sk-..."
                      autoComplete="off"
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                      Used only for your AI reflection enhancement requests.
                    </p>
                  </div>
                </div>
              </div>
            </form>

            {/* Quick Templates */}
            <div id="quick-templates" className="card scroll-mt-24">
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

              <button type="button" onClick={handleAddTemplate} className="btn-secondary w-full sm:w-auto">
            + Add Template
          </button>

          <div className="mt-4 space-y-2">
            {quickTemplates.map((template) => (
              <div key={template.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{template.label}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{formatHoursMinutes(template.minutes / 60)}</p>
                </div>
                <button
                  type="button"
                  className="btn-danger w-full sm:w-auto"
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

            {/* Account Settings */}
            <div id="account" className="card scroll-mt-24">
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

            {/* Log Cleanup */}
            <div id="log-cleanup" className="card border border-danger-200 dark:border-danger-900/40 bg-danger-50/60 dark:bg-danger-900/10 scroll-mt-24">
          <h2 className="text-xl font-bold mb-3 text-danger-700 dark:text-danger-300">Delete Old Logs</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            Remove all shifts logged before a selected date. This only affects your own logs.
          </p>
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Delete logs before
              </label>
              <input
                type="date"
                value={deleteBeforeDate}
                onChange={(e) => setDeleteBeforeDate(e.target.value)}
                className="input-base w-full md:w-56"
              />
            </div>
            <button
              type="button"
              onClick={handleDeleteOldLogs}
              disabled={deletingLogs || !deleteBeforeDate}
              className="btn-danger w-full md:w-auto"
            >
              {deletingLogs ? 'Deleting...' : 'Delete Old Logs'}
            </button>
          </div>
        </div>

            {/* Info Box */}
            <div id="info" className="card border-2 border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 scroll-mt-24">
          <p className="text-sm text-primary-900 dark:text-primary-200">
            💡 <strong>How it works:</strong> Hours are automatically marked as paid or unpaid based on your school hours setting.
            Any hours beyond your weekly school hours quota are marked as paid and contribute to your earnings. You can manually
            override individual shifts if needed.
          </p>
        </div>

          </div>

          <aside className="hidden xl:block xl:sticky xl:top-24 self-start">
            <div className="card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-3">
                Quick Jump
              </h2>
              <nav className="space-y-1">
                {settingsSections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => jumpToSection(section.id)}
                    className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {section.label}
                  </button>
                ))}
              </nav>

              <button
                type="submit"
                form={settingsFormId}
                disabled={loading}
                className="btn-primary w-full mt-4"
              >
                {loading ? 'Saving...' : 'Save All Settings'}
              </button>
            </div>
          </aside>

          <div className="xl:hidden fixed inset-x-0 bottom-0 z-20">
            <div className="card rounded-none border-x-0 border-b-0 p-3 shadow-lg">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={mobileSectionId}
                  onChange={(e) => setMobileSectionId(e.target.value)}
                  className="input-base w-full"
                >
                  {settingsSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => jumpToSection(mobileSectionId)}
                  className="btn-secondary whitespace-nowrap"
                >
                  Jump
                </button>
              </div>
              <button
                type="submit"
                form={settingsFormId}
                disabled={loading}
                className="btn-primary w-full mt-3"
              >
                {loading ? 'Saving...' : 'Save All Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
