import React from 'react'
import { Layout } from '@/components/Layout'
import { useSettingsStore, useAuthStore, useShiftStore, QuickTemplate } from '@/store'
import { supabase, getUserProfile } from '@/lib/supabase'
import { useToast } from '@/components/common/UI'
import { partsToHours, hoursToParts, formatHoursMinutes } from '@/lib/calculations'
import { DurationInput } from '@/components/shifts/DurationInput'
import {
  createReflectionFieldId,
  defaultCategories,
  defaultReflectionFields,
  normalizeReflectionFields,
  type ReflectionFieldConfig,
  type ReflectionFieldType,
} from '@/lib/reflections'
import { appLanguageOptions, useTranslation } from '@/lib/i18n'

interface SettingsFormData {
  school_hours_per_week: number
  use_school_hours_mode: boolean
  hourly_rate: number
  currency: string
  language: 'no' | 'en' | 'sv'
  theme: 'light' | 'dark' | 'girlie-pop'
  openai_api_key: string
  notifications_enabled: boolean
  email_digest_enabled: boolean
  custom_categories: string[]
  reflection_fields: ReflectionFieldConfig[]
}

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore()
  const { shifts, setShifts } = useShiftStore()
  const { settings, updateSettings, setQuickTemplates } = useSettingsStore()
  const { t } = useTranslation()
  const toast = useToast()
  const [loading, setLoading] = React.useState(false)
  const [deleteBeforeDate, setDeleteBeforeDate] = React.useState('')
  const [deletingLogs, setDeletingLogs] = React.useState(false)
  const [templateLabel, setTemplateLabel] = React.useState('')
  const [templateHours, setTemplateHours] = React.useState(0)
  const [templateMinutes, setTemplateMinutes] = React.useState(0)
  const [newCategory, setNewCategory] = React.useState('')
  const [newReflectionFieldLabel, setNewReflectionFieldLabel] = React.useState('')
  const [newReflectionFieldType, setNewReflectionFieldType] = React.useState<ReflectionFieldType>('textarea')
  const [formData, setFormData] = React.useState<SettingsFormData>({
    school_hours_per_week: settings?.school_hours_per_week || 20,
    use_school_hours_mode: settings?.use_school_hours_mode ?? true,
    hourly_rate: settings?.hourly_rate || 120,
    currency: settings?.currency || 'NOK',
    language: settings?.language || 'no',
    theme: settings?.theme || 'light',
    openai_api_key: settings?.openai_api_key || '',
    notifications_enabled: settings?.notifications_enabled || true,
    email_digest_enabled: settings?.email_digest_enabled || true,
    custom_categories: settings?.custom_categories?.length ? settings.custom_categories : defaultCategories,
    reflection_fields: settings?.reflection_fields?.length
      ? normalizeReflectionFields(settings.reflection_fields)
      : defaultReflectionFields,
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
      language: settings.language || 'no',
      theme: settings.theme || 'light',
      openai_api_key: settings.openai_api_key ?? '',
      notifications_enabled: settings.notifications_enabled,
      email_digest_enabled: settings.email_digest_enabled,
      custom_categories: settings.custom_categories?.length ? settings.custom_categories : defaultCategories,
      reflection_fields: settings.reflection_fields?.length
        ? normalizeReflectionFields(settings.reflection_fields)
        : defaultReflectionFields,
    })
  }, [settings])

  const schoolHoursParts = hoursToParts(formData.school_hours_per_week)
  const settingsFormId = 'settings-main-form'
  const reflectionFields = React.useMemo(() => normalizeReflectionFields(formData.reflection_fields), [formData.reflection_fields])

  const settingsSections = [
    { id: 'language', label: t('settings.language') },
    { id: 'appearance', label: t('settings.appearance') },
    { id: 'work-hours', label: t('settings.workHoursConfiguration') },
    { id: 'custom-categories', label: t('settings.customCategories') },
    { id: 'notifications', label: t('settings.notifications') },
    { id: 'ai-settings', label: t('settings.aiSettings') },
    { id: 'reflection-fields', label: t('settings.reflectionBuilder') },
    { id: 'quick-templates', label: t('settings.quickDurationTemplates') },
    { id: 'account', label: t('settings.accountInformation') },
    { id: 'log-cleanup', label: t('settings.deleteOldLogs') },
  ]
  const [activeSectionId, setActiveSectionId] = React.useState(settingsSections[0].id)

  React.useEffect(() => {
    let animationFrameId = 0

    const updateActiveSection = () => {
      const viewportTopOffset = 140
      const sectionTopCandidates = settingsSections
        .map((section) => {
          const element = document.getElementById(section.id)
          if (!element) {
            return null
          }

          const rect = element.getBoundingClientRect()
          return {
            id: section.id,
            label: section.label,
            top: rect.top,
            bottom: rect.bottom,
            distance: Math.abs(rect.top - viewportTopOffset),
            containsTop: rect.top <= viewportTopOffset && rect.bottom >= viewportTopOffset,
          }
        })
        .filter(Boolean) as Array<{
        id: string
        label: string
        top: number
        bottom: number
        distance: number
        containsTop: boolean
      }>

      if (!sectionTopCandidates.length) {
        return
      }

      const containingSection = sectionTopCandidates.find((section) => section.containsTop)
      if (containingSection) {
        setActiveSectionId(containingSection.id)
        return
      }

      const nextSection = sectionTopCandidates
        .filter((section) => section.top > viewportTopOffset)
        .sort((left, right) => left.distance - right.distance)[0]

      if (nextSection) {
        setActiveSectionId(nextSection.id)
        return
      }

      const lastSection = sectionTopCandidates[sectionTopCandidates.length - 1]
      if (lastSection) {
        setActiveSectionId(lastSection.id)
      }
    }

    const scheduleUpdate = () => {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = window.requestAnimationFrame(updateActiveSection)
    }

    scheduleUpdate()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [settingsSections])

  const quickTemplates = settings?.quick_templates || []

  const handleAddTemplate = () => {
    const totalMinutes = Math.max(0, templateHours * 60 + templateMinutes)
    if (totalMinutes <= 0) {
      toast.showToast({ type: 'warning', message: t('settings.quickDurationTemplatesHelp') })
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
    toast.showToast({ type: 'success', message: t('settings.addTemplate') })
    setTemplateLabel('')
    setTemplateHours(0)
    setTemplateMinutes(0)
  }

  const handleDeleteTemplate = (templateId: string) => {
    const updated = quickTemplates.filter((template) => template.id !== templateId)
    setQuickTemplates(updated)
    toast.showToast({ type: 'success', message: t('settings.remove') })
  }

  const persistSettings = async () => {
    if (!user) return

    setLoading(true)

    try {
      const coreSettingsPayload = {
        school_hours_per_week: formData.school_hours_per_week,
        hourly_rate: formData.hourly_rate,
        currency: formData.currency,
        theme: formData.theme,
        notifications_enabled: formData.notifications_enabled,
        email_digest_enabled: formData.email_digest_enabled,
      }

      const { error: coreError } = await supabase
        .from('users')
        .update(coreSettingsPayload)
        .eq('id', user.id)

      if (coreError) throw coreError

      // Optional columns may not exist in older databases; update each field separately
      // so a missing column does not block unrelated settings (like the API key).
      const optionalUpdates: Array<{ key: string; value: unknown }> = [
        { key: 'use_school_hours_mode', value: formData.use_school_hours_mode },
        { key: 'openai_api_key', value: formData.openai_api_key.trim() || null },
        { key: 'custom_categories', value: formData.custom_categories },
        { key: 'reflection_fields', value: reflectionFields },
      ]

      for (const update of optionalUpdates) {
        const { error } = await supabase
          .from('users')
          .update({ [update.key]: update.value })
          .eq('id', user.id)

        if (error) {
          const msg = error.message || ''
          const missingColumn = /column\s+\"?.+\"?\s+does not exist/i.test(msg)
          toast.showToast({
            type: missingColumn ? 'warning' : 'error',
            message: missingColumn ? t('settings.partialSaveWarning') : msg,
          })
        }
      }

      // Re-fetch the canonical profile from DB to reflect what actually persisted
      try {
        const fresh = await getUserProfile(user.id)
        const dbHasKey = Boolean((fresh?.openai_api_key || '').trim())
        const enteredKey = (formData.openai_api_key?.trim() || '')

        // If DB lacks key but user entered one, keep it client-side so features still work
        const effectiveKey = dbHasKey ? fresh.openai_api_key : enteredKey

        updateSettings({
          ...fresh,
          theme: fresh?.theme || formData.theme,
          openai_api_key: effectiveKey,
          reflection_fields: normalizeReflectionFields(fresh?.reflection_fields || reflectionFields),
        })

        if (enteredKey && !dbHasKey) {
          toast.showToast({
            type: 'warning',
            message: t('settings.openAiKeyStoredLocallyWarning'),
          })
        }
      } catch {
        // If fetch fails, still reflect local state so UI remains usable
        updateSettings({ ...formData, reflection_fields: reflectionFields })
      }

      toast.showToast({ type: 'success', message: t('settings.saveAll') })
    } catch (error: any) {
      toast.showToast({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.school_hours_per_week < 0 || !Number.isFinite(formData.school_hours_per_week)) {
      toast.showToast({ type: 'warning', message: t('settings.invalidSchoolHours') })
      return
    }

    if (formData.hourly_rate < 0 || !Number.isFinite(formData.hourly_rate)) {
      toast.showToast({ type: 'warning', message: t('settings.invalidHourlyRate') })
      return
    }

    await persistSettings()
  }

  const handleAddCategory = () => {
    const value = newCategory.trim()
    if (!value) return

    const exists = formData.custom_categories.some((category) => category.toLowerCase() === value.toLowerCase())
    if (exists) {
      toast.showToast({ type: 'warning', message: t('settings.customCategories') })
      return
    }

    setFormData({ ...formData, custom_categories: [...formData.custom_categories, value] })
    setNewCategory('')
  }

  const handleRemoveCategory = (categoryToRemove: string) => {
    const next = formData.custom_categories.filter((category) => category !== categoryToRemove)
    if (!next.length) {
      toast.showToast({ type: 'warning', message: t('settings.customCategories') })
      return
    }
    setFormData({ ...formData, custom_categories: next })
  }

  const handleAddReflectionField = () => {
    const label = newReflectionFieldLabel.trim()
    if (!label) {
      toast.showToast({ type: 'warning', message: t('settings.newFieldTitle') })
      return
    }

    const id = createReflectionFieldId(label, reflectionFields.map((field) => field.id))
    const nextField: ReflectionFieldConfig = {
      id,
      label,
      type: newReflectionFieldType,
      placeholder: newReflectionFieldType === 'checkbox' ? '' : '',
      helpText: '',
      required: false,
      options: newReflectionFieldType === 'select' ? ['Option 1', 'Option 2'] : undefined,
    }

    setFormData((prev) => ({
      ...prev,
      reflection_fields: [...reflectionFields, nextField],
    }))
    setNewReflectionFieldLabel('')
    setNewReflectionFieldType('textarea')
  }

  const handleUpdateReflectionField = (fieldId: string, updates: Partial<ReflectionFieldConfig>) => {
    setFormData((prev) => ({
      ...prev,
      reflection_fields: prev.reflection_fields.map((field) =>
        field.id === fieldId
          ? (() => {
              const nextType = updates.type ?? field.type

              return {
                ...field,
                ...updates,
                type: nextType,
                options: nextType === 'select' ? updates.options ?? field.options ?? ['Option 1'] : undefined,
              }
            })()
          : field
      ),
    }))
  }

  const handleMoveReflectionField = (fieldId: string, direction: -1 | 1) => {
    setFormData((prev) => {
      const index = prev.reflection_fields.findIndex((field) => field.id === fieldId)
      if (index < 0) return prev

      const target = index + direction
      if (target < 0 || target >= prev.reflection_fields.length) {
        return prev
      }

      const next = [...prev.reflection_fields]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)

      return { ...prev, reflection_fields: next }
    })
  }

  const handleRemoveReflectionField = (fieldId: string) => {
    if (reflectionFields.length <= 1) {
      toast.showToast({ type: 'warning', message: t('settings.reflectionBuilder') })
      return
    }

    setFormData((prev) => ({
      ...prev,
      reflection_fields: prev.reflection_fields.filter((field) => field.id !== fieldId),
    }))
  }

  const handleResetReflectionFields = () => {
    setFormData((prev) => ({
      ...prev,
      reflection_fields: defaultReflectionFields,
    }))
  }

  const handleDeleteOldLogs = async () => {
    if (!user || !deleteBeforeDate) {
      toast.showToast({ type: 'warning', message: t('settings.deleteBefore') })
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
        message: `${deletedIds.size} ${t('settings.deleteOldLogsButton')}`,
      })
      setDeleteBeforeDate('')
    } catch (error: any) {
      toast.showToast({ type: 'error', message: error.message || t('settings.deleteOldLogsButton') })
    } finally {
      setDeletingLogs(false)
    }
  }

  const jumpToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId)
    if (!section) {
      return
    }

    setActiveSectionId(sectionId)
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.history.replaceState(null, '', `#${sectionId}`)
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto pb-32 xl:pb-0">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_18rem] gap-8 items-start">
          <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('settings.pageTitle')}</h1>

            <form id={settingsFormId} onSubmit={handleSave} className="space-y-8">
              {/* Language */}
              <div id="language" className="card scroll-mt-24">
                <h2 className="text-xl font-bold mb-6">{t('settings.language')}</h2>
                <div className="space-y-3 max-w-xl">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('settings.language')}
                  </label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value as 'no' | 'en' | 'sv' })}
                    className="input-base w-full max-w-xs"
                  >
                    {appLanguageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{t('settings.languageHelp')}</p>
                </div>
              </div>

              {/* Appearance */}
              <div id="appearance" className="card scroll-mt-24">
                <h2 className="text-xl font-bold mb-6">{t('settings.appearance')}</h2>
                <div className="space-y-3 max-w-xl">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('settings.theme')}
                  </label>
                  <select
                    value={formData.theme}
                    onChange={(e) => setFormData({ ...formData, theme: e.target.value as 'light' | 'dark' | 'girlie-pop' })}
                    className="input-base w-full max-w-xs"
                  >
                    <option value="light">{t('theme.light')}</option>
                    <option value="dark">{t('theme.dark')}</option>
                    <option value="girlie-pop">{t('theme.girliePop')}</option>
                  </select>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{t('settings.themeHelp')}</p>
                </div>
              </div>

              {/* Work Hours Settings */}
              <div id="work-hours" className="card scroll-mt-24">
                <h2 className="text-xl font-bold mb-6">{t('settings.workHoursConfiguration')}</h2>
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
                      <p className="font-medium">{t('settings.enableSchoolHoursMode')}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('settings.enableSchoolHoursModeHelp')}
                      </p>
                    </div>
                  </label>

                  {formData.use_school_hours_mode && (
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        <span>{t('settings.schoolHoursPerWeek')}</span>
                        <span className="relative inline-flex group">
                          <button
                            type="button"
                            aria-label={t('settings.infoTitle')}
                            aria-describedby="school-hours-tooltip"
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-[11px] font-semibold text-gray-500 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500/60 dark:border-gray-600 dark:bg-slate-900 dark:text-gray-400 dark:hover:border-primary-500 dark:hover:bg-primary-900/30 dark:hover:text-primary-200"
                          >
                            ?
                          </button>
                          <span
                            id="school-hours-tooltip"
                            role="tooltip"
                            className="pointer-events-none absolute left-1/2 top-full z-20 mt-3 w-80 -translate-x-1/2 translate-y-1 rounded-2xl border border-white/15 bg-slate-950/95 px-4 py-3 text-left text-xs leading-5 text-slate-100 opacity-0 shadow-2xl backdrop-blur-md transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 dark:border-slate-700/70"
                          >
                            <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-white/15 bg-slate-950/95 dark:border-slate-700/70" />
                            {t('settings.infoBody')}
                          </span>
                        </span>
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
                          {t('settings.schoolHoursQuota', { hours: formatHoursMinutes(formData.school_hours_per_week) })}
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('settings.hourlyRate')}
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
                      {t('settings.currency')}
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="input-base w-full max-w-xs"
                    >
                      <option value="NOK">{t('settings.currencyNok')}</option>
                      <option value="EUR">{t('settings.currencyEur')}</option>
                      <option value="USD">{t('settings.currencyUsd')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Categories */}
              <div id="custom-categories" className="card scroll-mt-24">
                <h2 className="text-xl font-bold mb-6">{t('settings.customCategories')}</h2>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="input-base flex-1"
                    placeholder={t('settings.addCategoryPlaceholder')}
                  />
                  <button type="button" onClick={handleAddCategory} className="btn-secondary">
                    {t('settings.add')}
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
                        title={t('settings.removeCategory', { category })}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Notification Settings */}
              <div id="notifications" className="card scroll-mt-24">
                <h2 className="text-xl font-bold mb-6">{t('settings.notifications')}</h2>
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
                      <p className="font-medium">{t('settings.browserNotifications')}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('settings.browserNotificationsHelp')}
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
                      <p className="font-medium">{t('settings.weeklyEmailDigest')}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('settings.weeklyEmailDigestHelp')}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* AI Settings */}
              <div id="ai-settings" className="card scroll-mt-24">
                <h2 className="text-xl font-bold mb-6">{t('settings.aiSettings')}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('settings.openAiApiKey')}
                    </label>
                    <input
                      type="password"
                      value={formData.openai_api_key}
                      onChange={(e) => setFormData({ ...formData, openai_api_key: e.target.value })}
                      className="input-base w-full"
                      placeholder="sk-..."
                      autoComplete="off"
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                      {t('settings.openAiApiKeyHelp')}
                    </p>
                  </div>
                </div>
              </div>
            </form>

            <div id="reflection-fields" className="card scroll-mt-24">
              <h2 className="text-xl font-bold mb-3">{t('settings.reflectionBuilder')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
                {t('settings.reflectionBuilderHelp')}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_12rem_auto] gap-3 mb-4">
                <input
                  type="text"
                  value={newReflectionFieldLabel}
                  onChange={(e) => setNewReflectionFieldLabel(e.target.value)}
                  className="input-base w-full"
                  placeholder={t('settings.newFieldTitle')}
                />
                <select
                  value={newReflectionFieldType}
                  onChange={(e) => setNewReflectionFieldType(e.target.value as ReflectionFieldType)}
                  className="input-base w-full"
                >
                  <option value="textarea">{t('settings.longText')}</option>
                  <option value="text">{t('settings.shortText')}</option>
                  <option value="checkbox">{t('settings.checkbox')}</option>
                  <option value="number">{t('settings.number')}</option>
                  <option value="select">{t('settings.dropdown')}</option>
                </select>
                <button type="button" onClick={handleAddReflectionField} className="btn-secondary whitespace-nowrap">
                  {t('settings.addField')}
                </button>
              </div>

              <div className="space-y-4">
                {reflectionFields.map((field, index) => {
                  const optionsText = field.options?.join('\n') || ''

                  return (
                    <div key={field.id} className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 p-4">
                      <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                                {t('settings.title')}
                              </label>
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => handleUpdateReflectionField(field.id, { label: e.target.value })}
                                className="input-base w-full"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                                {t('settings.fieldType')}
                              </label>
                              <select
                                value={field.type}
                                onChange={(e) =>
                                  handleUpdateReflectionField(field.id, {
                                    type: e.target.value as ReflectionFieldType,
                                    options:
                                      e.target.value === 'select'
                                        ? field.options?.length
                                          ? field.options
                                          : ['Option 1']
                                        : undefined,
                                  })
                                }
                                className="input-base w-full"
                              >
                                <option value="textarea">{t('settings.longText')}</option>
                                <option value="text">{t('settings.shortText')}</option>
                                <option value="checkbox">{t('settings.checkbox')}</option>
                                <option value="number">{t('settings.number')}</option>
                                <option value="select">{t('settings.dropdown')}</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                                {t('settings.placeholder')}
                              </label>
                              <input
                                type="text"
                                value={field.placeholder || ''}
                                onChange={(e) => handleUpdateReflectionField(field.id, { placeholder: e.target.value })}
                                className="input-base w-full"
                                placeholder={t('settings.placeholderHint')}
                                disabled={field.type === 'checkbox'}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                                {t('settings.helperText')}
                              </label>
                              <input
                                type="text"
                                value={field.helpText || ''}
                                onChange={(e) => handleUpdateReflectionField(field.id, { helpText: e.target.value })}
                                className="input-base w-full"
                                placeholder={t('settings.helperTextHint')}
                              />
                            </div>
                          </div>

                          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                            <input
                              type="checkbox"
                              checked={Boolean(field.required)}
                              onChange={(e) => handleUpdateReflectionField(field.id, { required: e.target.checked })}
                            />
                            {t('settings.required')}
                          </label>

                          {field.type === 'select' && (
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                                {t('settings.dropdownOptions')}
                              </label>
                              <textarea
                                value={optionsText}
                                onChange={(e) =>
                                  handleUpdateReflectionField(field.id, {
                                    options: e.target.value
                                      .split('\n')
                                      .map((option) => option.trim())
                                      .filter(Boolean),
                                  })
                                }
                                className="input-base w-full h-28 resize-none"
                                placeholder={t('settings.oneOptionPerLine')}
                              />
                            </div>
                          )}

                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('settings.fieldId')}: <span className="font-mono">{field.id}</span>
                          </p>
                        </div>

                        <div className="flex flex-row lg:flex-col gap-2 lg:w-36">
                          <button
                            type="button"
                            onClick={() => handleMoveReflectionField(field.id, -1)}
                            disabled={index === 0}
                            className="btn-secondary flex-1 lg:flex-none"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveReflectionField(field.id, 1)}
                            disabled={index === reflectionFields.length - 1}
                            className="btn-secondary flex-1 lg:flex-none"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveReflectionField(field.id)}
                            className="btn-danger flex-1 lg:flex-none"
                          >
                            {t('settings.remove')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <button type="button" onClick={handleResetReflectionFields} className="btn-secondary">
                  {t('settings.resetReflectionFields')}
                </button>
              </div>
            </div>

            {/* Quick Templates */}
            <div id="quick-templates" className="card scroll-mt-24">
          <h2 className="text-xl font-bold mb-6">{t('settings.quickDurationTemplates')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {t('settings.quickDurationTemplatesHelp')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <input
              type="text"
              value={templateLabel}
              onChange={(e) => setTemplateLabel(e.target.value)}
              className="input-base md:col-span-2"
              placeholder={t('settings.templateLabelPlaceholder')}
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
            {t('settings.addTemplate')}
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
                  {t('settings.remove')}
                </button>
              </div>
            ))}
            {!quickTemplates.length && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('settings.noTemplatesYet')}</p>
            )}
          </div>
        </div>

            {/* Account Settings */}
            <div id="account" className="card scroll-mt-24">
          <h2 className="text-xl font-bold mb-6">{t('settings.accountInformation')}</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('settings.email')}</p>
              <p className="font-medium text-gray-900 dark:text-white">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('settings.accountCreated')}</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('nb-NO') : t('common.notAvailable')}
              </p>
            </div>
          </div>
        </div>

            {/* Log Cleanup */}
            <div id="log-cleanup" className="card border border-danger-200 dark:border-danger-900/40 bg-danger-50/60 dark:bg-danger-900/10 scroll-mt-24">
            <h2 className="text-xl font-bold mb-3 text-danger-700 dark:text-danger-300">{t('settings.deleteOldLogs')}</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              {t('settings.deleteOldLogsHelp')}
          </p>
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.deleteBefore')}
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
              {deletingLogs ? t('settings.deleteing') : t('settings.deleteOldLogsButton')}
            </button>
          </div>
        </div>

          </div>

          <aside className="hidden xl:block xl:sticky xl:top-24 self-start">
            <div className="card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-3">
                {t('settings.quickJump')}
              </h2>
              <nav className="space-y-1">
                {settingsSections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => jumpToSection(section.id)}
                    aria-current={section.id === activeSectionId ? 'true' : undefined}
                    className={`block w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors ${
                      section.id === activeSectionId
                        ? 'bg-primary-100 text-primary-900 dark:bg-primary-900/30 dark:text-primary-100'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
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
                {loading ? t('common.saving') : t('settings.saveAll')}
              </button>
            </div>
          </aside>

          <div className="xl:hidden fixed inset-x-0 bottom-0 z-20">
            <div className="card rounded-none border-x-0 border-b-0 p-3 shadow-lg">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={activeSectionId}
                  onChange={(e) => jumpToSection(e.target.value)}
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
                  onClick={() => jumpToSection(activeSectionId)}
                  className="btn-secondary whitespace-nowrap"
                >
                  {t('settings.jump')}
                </button>
              </div>
              <button
                type="submit"
                form={settingsFormId}
                disabled={loading}
                className="btn-primary w-full mt-3"
              >
                {loading ? t('common.saving') : t('settings.saveAll')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
