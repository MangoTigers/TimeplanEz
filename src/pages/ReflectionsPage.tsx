import React from 'react'
import { format, parseISO } from 'date-fns'
import { Layout } from '@/components/Layout'
import { useAuthStore, useSettingsStore, useShiftStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { useToast, Modal } from '@/components/common/UI'
import { formatHoursMinutes, formatWeekLabel } from '@/lib/calculations'
import { ShiftStatusBadge } from '@/components/shifts/ShiftStatusBadge'
import {
  createDefaultReflectionValues,
  defaultReflectionFields,
  hasReflectionContent,
  formatReflectionFieldValue,
  parseReflection,
  normalizeReflectionFields,
  serializeReflection,
  type ReflectionData,
} from '@/lib/reflections'
import { useTranslation } from '@/lib/i18n'
import { classifyEdgeFunctionError, getEdgeFunctionTroubleshootingHint } from '@/lib/edgeFunctions'
import { enhanceReflectionWithAi, getEffectiveOpenAiApiKey, parseImportFileWithAi, extractTextFromPdfBase64 } from '@/lib/ai'

interface ShiftWithReflection {
  id: string
  date: string
  hours_worked: number
  paid: boolean | null
  category: string
  reflection: string | null
  enhanced_reflection: string | null
  created_at?: string
}

interface DayReflectionGroup {
  date: string
  shifts: ShiftWithReflection[]
  totalHours: number
  paidHours: number
  unpaidHours: number
  categories: string[]
  reflection: ReflectionData
  enhancedReflection: string | null
  hasReflection: boolean
}

interface ImportedEntryDraft {
  clientId: string
  date: string
  hours_worked: number
  paid: boolean | null
  category: string
  notes: string
  reflection: string
  enhancedPreview?: string | null
  enhancing?: boolean
}

const emptyReflectionData: ReflectionData = {
  values: createDefaultReflectionValues(defaultReflectionFields),
}

export const ReflectionsPage: React.FC = () => {
  const { user } = useAuthStore()
  const { settings } = useSettingsStore()
  const { shifts } = useShiftStore()
  const reflectionFields = React.useMemo(
    () => normalizeReflectionFields(settings?.reflection_fields?.length ? settings.reflection_fields : defaultReflectionFields),
    [settings?.reflection_fields]
  )
  const hasOpenAiKey = Boolean(settings?.openai_api_key?.trim())
  const toast = useToast()
  const { t } = useTranslation()

  const [entries, setEntries] = React.useState<ShiftWithReflection[]>([])
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editingDate, setEditingDate] = React.useState<string | null>(null)
  const [editReflection, setEditReflection] = React.useState<ReflectionData>(emptyReflectionData)
  const [enhancedText, setEnhancedText] = React.useState('')
  const [loadingEnhance, setLoadingEnhance] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [importAiFile, setImportAiFile] = React.useState<File | null>(null)
  const [isImportingAi, setIsImportingAi] = React.useState(false)
  const [reviewEntries, setReviewEntries] = React.useState<ImportedEntryDraft[]>([])
  const [isReviewModalOpen, setIsReviewModalOpen] = React.useState(false)
  const [isApplyingImport, setIsApplyingImport] = React.useState(false)
  type SortMode = 'date_desc' | 'date_asc' | 'created_desc' | 'created_asc' | 'hours_desc' | 'has_reflection_first'
  const [sortMode, setSortMode] = React.useState<SortMode>('date_desc')
  const [selectedYear, setSelectedYear] = React.useState<number>(new Date().getFullYear())

  React.useEffect(() => {
    if (user) {
      loadEntries()
    }
  }, [user, shifts])

  const loadEntries = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (error) throw error
      setEntries(data || [])
    } catch {
      toast.showToast({ type: 'error', message: 'Failed to load reflections' })
    }
  }

  const openEdit = (entry: ShiftWithReflection) => {
    setEditingId(entry.id)
    setEditingDate(entry.date)
    setEditReflection(parseReflection(entry.reflection, reflectionFields))
    setEnhancedText(entry.enhanced_reflection || '')
  }

  const getDayReflection = (shiftsForDay: ShiftWithReflection[]) => {
    const representativeReflection = shiftsForDay.find((shift) => hasReflectionContent(parseReflection(shift.reflection, reflectionFields), reflectionFields))
    const reflection = parseReflection(representativeReflection?.reflection || null, reflectionFields)
    return {
      reflection,
      enhancedReflection: representativeReflection?.enhanced_reflection || null,
      hasReflection: hasReflectionContent(reflection, reflectionFields),
    }
  }

  const dayGroups = React.useMemo(() => {
    const grouped = new Map<string, ShiftWithReflection[]>()

    const filteredByYear = entries.filter((entry) => {
      const d = parseISO(entry.date)
      return d.getFullYear() === selectedYear
    })

    filteredByYear.forEach((entry) => {
      const next = grouped.get(entry.date) || []
      next.push(entry)
      grouped.set(entry.date, next)
    })

    const q = searchTerm.toLowerCase()

    const groups = Array.from(grouped.entries())
      .map(([date, shifts]) => {
        const totalHours = shifts.reduce((sum, shift) => sum + shift.hours_worked, 0)
        const paidHours = shifts.filter((shift) => shift.paid).reduce((sum, shift) => sum + shift.hours_worked, 0)
        const unpaidHours = totalHours - paidHours
        const dayReflection = getDayReflection(shifts)
        const categories = Array.from(new Set(shifts.map((shift) => shift.category || 'General')))
        const createdAt = Math.max(
          ...shifts
            .map((s) => (s.created_at ? new Date(s.created_at).getTime() : 0))
            .filter((n) => Number.isFinite(n) && n > 0)
        )

        return {
          date,
          shifts,
          totalHours,
          paidHours,
          unpaidHours,
          categories,
          reflection: dayReflection.reflection,
          enhancedReflection: dayReflection.enhancedReflection,
          hasReflection: dayReflection.hasReflection,
          createdAt,
        }
      })
      .filter((group) => {
        if (!q) return true

        const categoriesText = group.categories.join(' ').toLowerCase()
        const reflectionText = reflectionFields
          .map((field) => formatReflectionFieldValue(field, group.reflection.values[field.id]))
          .join(' ')
          .toLowerCase()
        return (
          categoriesText.includes(q) ||
          reflectionText.includes(q) ||
          format(parseISO(group.date), 'MMMM dd, yyyy').toLowerCase().includes(q)
        )
      })
    // Apply sorting
    groups.sort((a, b) => {
      switch (sortMode) {
        case 'date_asc':
          return a.date < b.date ? -1 : 1
        case 'created_desc':
          return (b.createdAt || 0) - (a.createdAt || 0)
        case 'created_asc':
          return (a.createdAt || 0) - (b.createdAt || 0)
        case 'hours_desc':
          return b.totalHours - a.totalHours
        case 'has_reflection_first':
          if (a.hasReflection && !b.hasReflection) return -1
          if (!a.hasReflection && b.hasReflection) return 1
          return a.date < b.date ? 1 : -1
        case 'date_desc':
        default:
          return a.date < b.date ? 1 : -1
      }
    })

    return groups
  }, [entries, searchTerm, sortMode, selectedYear])

  const selectedGroup = React.useMemo(() => {
    if (!selectedDate) return null

    const shifts = entries.filter((entry) => entry.date === selectedDate)
    if (!shifts.length) return null

    const totalHours = shifts.reduce((sum, shift) => sum + shift.hours_worked, 0)
    const paidHours = shifts.filter((shift) => shift.paid).reduce((sum, shift) => sum + shift.hours_worked, 0)
    const unpaidHours = totalHours - paidHours
    const dayReflection = getDayReflection(shifts)
    const categories = Array.from(new Set(shifts.map((shift) => shift.category || 'General')))

    return {
      date: selectedDate,
      shifts,
      totalHours,
      paidHours,
      unpaidHours,
      categories,
      reflection: dayReflection.reflection,
      enhancedReflection: dayReflection.enhancedReflection,
      hasReflection: dayReflection.hasReflection,
    } as DayReflectionGroup
  }, [entries, selectedDate])

  const handleSaveReflection = async () => {
    if (!user || !editingId || !editingDate) return

    const reflectionValue = hasReflectionContent(editReflection, reflectionFields)
      ? serializeReflection(editReflection)
      : null

    try {
      const { error } = await supabase
        .from('shifts')
        .update({ reflection: reflectionValue, enhanced_reflection: enhancedText || null })
        .eq('date', editingDate)
        .eq('user_id', user.id)

      if (error) throw error

      setEntries((prev) =>
        prev.map((entry) =>
          entry.date === editingDate
            ? { ...entry, reflection: reflectionValue, enhanced_reflection: enhancedText || null }
            : entry
        )
      )

      setEditingId(null)
      setEditingDate(null)
      toast.showToast({ type: 'success', message: 'Day reflection saved for all shifts on this date.' })
    } catch {
      toast.showToast({ type: 'error', message: 'Failed to save reflection' })
    }
  }

  const handleEnhanceWithAI = async () => {
    const sourceText = reflectionFields
      .map((field) => `${field.label}: ${formatReflectionFieldValue(field, editReflection.values[field.id])}`)
      .filter((line) => !line.endsWith(': '))
      .join('\n')

    if (!sourceText.trim()) {
      toast.showToast({ type: 'warning', message: 'Fill Task Completed or How It Went first' })
      return
    }

    const effectiveApiKey = await getEffectiveOpenAiApiKey(settings?.openai_api_key)
    if (!effectiveApiKey) {
      toast.showToast({
        type: 'warning',
        message: 'Add your OpenAI API key in Settings > AI Settings to use enhancement.',
      })
      return
    }

    setLoadingEnhance(true)

    try {
      const enhancedTextResult = await enhanceReflectionWithAi(sourceText, effectiveApiKey)
      setEnhancedText(enhancedTextResult)
      toast.showToast({ type: 'success', message: 'Reflection enhanced!' })
    } catch (error: any) {
      const code = classifyEdgeFunctionError(error)
      const message =
        code === 'not_deployed'
          ? t('errors.edgeFunctionNotDeployed', { name: 'enhance-reflection' })
          : code === 'network'
            ? `${t('errors.edgeFunctionNetwork')} ${getEdgeFunctionTroubleshootingHint()}`
            : error?.message || t('errors.edgeFunctionUnknown')
      toast.showToast({ type: 'error', message })
    } finally {
      setLoadingEnhance(false)
    }
  }

  const handleExportReflectionsCSV = () => {
    const headers = [
      'Date',
      'Hours',
      'Category',
      'Paid Status',
      ...reflectionFields.map((field) => field.label),
      'Enhanced Reflection',
    ]

    const rows = entries.map((entry) => {
      const reflection = parseReflection(entry.reflection, reflectionFields)
      return [
        format(parseISO(entry.date), 'yyyy-MM-dd'),
        entry.hours_worked,
        entry.category || 'General',
        entry.paid ? 'Paid' : 'Unpaid',
        ...reflectionFields.map((field) => formatReflectionFieldValue(field, reflection.values[field.id])),
        entry.enhanced_reflection || '',
      ]
    })

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `eztimeplan-reflections-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.showToast({ type: 'success', message: t('reflections.exportSuccess') })
  }

  const fileToBase64 = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(arrayBuffer)
    const chunkSize = 0x8000

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode(...chunk)
    }

    return btoa(binary)
  }

  const handleImportAi = async () => {
    if (!user || !importAiFile) {
      toast.showToast({ type: 'warning', message: t('analytics.importPickPdfFirst') })
      return
    }

    const effectiveApiKey = await getEffectiveOpenAiApiKey(settings?.openai_api_key)
    if (!effectiveApiKey) {
      toast.showToast({ type: 'warning', message: t('analytics.importRequiresAiKey') })
      return
    }

    const allowedTypes = ['application/pdf', 'text/plain', 'text/csv']
    if (importAiFile.type && !allowedTypes.includes(importAiFile.type)) {
      toast.showToast({ type: 'warning', message: t('analytics.importOnlyPdf') })
      return
    }

    const maxBytes = 8 * 1024 * 1024
    if (importAiFile.size > maxBytes) {
      toast.showToast({ type: 'warning', message: t('analytics.importPdfTooLarge') })
      return
    }

    setIsImportingAi(true)

    try {
      const fileBase64 = await fileToBase64(importAiFile)

      // If PDF, attempt to extract text client-side to avoid large binary uploads
      let useFileBase64 = fileBase64
      let useFileName = importAiFile.name
      let useFileType = importAiFile.type || null

      const isPdf = (importAiFile.type === 'application/pdf') || importAiFile.name.toLowerCase().endsWith('.pdf')
      if (isPdf) {
        try {
          const extractedText = await extractTextFromPdfBase64(fileBase64)
          if (extractedText && extractedText.trim()) {
            // Convert extracted text to base64 (UTF-8 safe)
            const textBase64 = btoa(unescape(encodeURIComponent(extractedText)))
            useFileBase64 = textBase64
            useFileName = importAiFile.name.replace(/\.pdf$/i, '.txt')
            useFileType = 'text/plain'
          }
        } catch {
          // fallback to original binary if extraction fails
        }
      }

      const previewRows = await parseImportFileWithAi({
        fileName: useFileName,
        fileBase64: useFileBase64,
        fileType: useFileType,
        reflectionFields,
        apiKey: effectiveApiKey,
      })
      if (!previewRows.length) {
        toast.showToast({ type: 'warning', message: t('analytics.importNoRows') })
      } else {
        setReviewEntries(
          previewRows.map((row: any, index: number) => ({
            clientId: `draft-${Date.now()}-${index}`,
            date: String(row.date || ''),
            hours_worked: Number(row.hours_worked || 0),
            paid: typeof row.paid === 'boolean' ? row.paid : null,
            category: String(row.category || 'General'),
            notes: String(row.notes || ''),
            reflection: String(row.reflection || ''),
          }))
        )
        setIsReviewModalOpen(true)
      }
      setImportAiFile(null)
    } catch (error: any) {
      const code = classifyEdgeFunctionError(error)
      const message =
        code === 'not_deployed'
          ? t('errors.edgeFunctionNotDeployed', { name: 'import-pdf-history' })
          : code === 'network'
            ? `${t('errors.edgeFunctionNetwork')} ${getEdgeFunctionTroubleshootingHint()}`
            : `${t('errors.edgeFunctionUnknown')} ${error?.message || ''}`.trim()
      toast.showToast({
        type: 'error',
        message,
      })
    } finally {
      setIsImportingAi(false)
    }
  }

  const addReviewRow = () => {
    setReviewEntries((prev) => [
      ...prev,
      {
        clientId: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: format(new Date(), 'yyyy-MM-dd'),
        hours_worked: 1,
        paid: null,
        category: 'General',
        notes: '',
        reflection: '',
        enhancedPreview: null,
        enhancing: false,
      },
    ])
  }

  const removeReviewRow = (clientId: string) => {
    setReviewEntries((prev) => prev.filter((entry) => entry.clientId !== clientId))
  }

  const updateReviewRow = (clientId: string, updates: Partial<ImportedEntryDraft>) => {
    setReviewEntries((prev) =>
      prev.map((entry) => (entry.clientId === clientId ? { ...entry, ...updates } : entry))
    )
  }

  const handleEnhanceRow = async (clientId: string) => {
    const row = reviewEntries.find((r) => r.clientId === clientId)
    if (!row) return

    const source = (row.reflection || '').trim()
    if (!source) {
      toast.showToast({ type: 'warning', message: t('import.enhanceFillReflection') })
      return
    }

    const effectiveApiKey = await getEffectiveOpenAiApiKey(settings?.openai_api_key)
    if (!effectiveApiKey) {
      toast.showToast({ type: 'warning', message: t('analytics.importRequiresAiKey') })
      return
    }

    updateReviewRow(clientId, { enhancing: true })
    try {
      const enhanced = await enhanceReflectionWithAi(source, effectiveApiKey)
      updateReviewRow(clientId, { enhancedPreview: enhanced })
    } catch (err: any) {
      toast.showToast({ type: 'error', message: err?.message || t('import.enhanceFailed') })
    } finally {
      updateReviewRow(clientId, { enhancing: false })
    }
  }

  const serializeRowKey = (row: {
    date: string
    hours_worked: number
    paid: boolean | null
    category: string
    notes: string
  }) => {
    return [
      row.date,
      Number(row.hours_worked).toFixed(2),
      row.paid === null ? 'null' : String(row.paid),
      row.category.trim().toLowerCase(),
      row.notes.trim().toLowerCase(),
    ].join('|')
  }

  const buildReflectionPayloadFromText = (text: string): string | null => {
    const trimmed = text.trim()
    if (!trimmed) {
      return null
    }

    const firstTextField = reflectionFields.find(
      (field) => field.type === 'text' || field.type === 'textarea'
    )
    if (!firstTextField) {
      return null
    }

    const values = createDefaultReflectionValues(reflectionFields)
    values[firstTextField.id] = trimmed
    return serializeReflection({ values })
  }

  const handleApplyReviewedImport = async () => {
    if (!user) {
      return
    }

    const validRows = reviewEntries.filter((entry) => {
      return /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && Number(entry.hours_worked) > 0
    })

    if (!validRows.length) {
      toast.showToast({ type: 'warning', message: t('analytics.importNoRows') })
      return
    }

    setIsApplyingImport(true)
    try {
      const uniqueRowsMap = new Map<string, ImportedEntryDraft>()
      validRows.forEach((row) => {
        const key = serializeRowKey({
          date: row.date,
          hours_worked: row.hours_worked,
          paid: row.paid,
          category: row.category || 'General',
          notes: row.notes || '',
        })
        if (!uniqueRowsMap.has(key)) {
          uniqueRowsMap.set(key, row)
        }
      })

      const dedupedRows = Array.from(uniqueRowsMap.values())
      const importDates = Array.from(new Set(dedupedRows.map((row) => row.date)))

      const { data: existingRows, error: existingError } = await supabase
        .from('shifts')
        .select('date,hours_worked,paid,category,notes')
        .eq('user_id', user.id)
        .in('date', importDates)

      if (existingError) {
        throw existingError
      }

      const existingKeys = new Set(
        (existingRows || []).map((row) =>
          serializeRowKey({
            date: String(row.date),
            hours_worked: Number(row.hours_worked),
            paid: row.paid === null ? null : Boolean(row.paid),
            category: String(row.category || 'General'),
            notes: String(row.notes || ''),
          })
        )
      )

      const insertRows = dedupedRows
        .filter((row) =>
          !existingKeys.has(
            serializeRowKey({
              date: row.date,
              hours_worked: row.hours_worked,
              paid: row.paid,
              category: row.category || 'General',
              notes: row.notes || '',
            })
          )
        )
        .map((row) => ({
          user_id: user.id,
          date: row.date,
          hours_worked: Number(row.hours_worked),
          paid: row.paid,
          category: row.category || 'General',
          notes: row.notes.trim() || null,
          reflection: buildReflectionPayloadFromText(row.reflection),
          enhanced_reflection: null,
        }))

      if (insertRows.length > 0) {
        const { error: insertError } = await supabase.from('shifts').insert(insertRows)
        if (insertError) {
          throw insertError
        }
      }

      toast.showToast({
        type: 'success',
        message: t('analytics.importSuccess', {
          count: insertRows.length,
          skipped: dedupedRows.length - insertRows.length,
        }),
      })

      setIsReviewModalOpen(false)
      setReviewEntries([])
      await loadEntries()
    } catch (error: any) {
      toast.showToast({
        type: 'error',
        message: error?.message || t('analytics.importFailed'),
      })
    } finally {
      setIsApplyingImport(false)
    }
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('layout.reflections')}</h1>
          <div className="flex gap-2">
            <button onClick={handleExportReflectionsCSV} className="btn-secondary">
              {t('reflections.exportCsv')}
            </button>
          </div>
        </div>

        <div className="card space-y-3">
          <input
            type="text"
            placeholder={t('reflections.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-base w-full"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700 dark:text-gray-300">{t('common.year')}</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="input-base"
              >
                {Array.from({ length: 9 }, (_, i) => new Date().getFullYear() - 4 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700 dark:text-gray-300">{t('common.sortBy')}</label>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as any)}
                className="input-base"
              >
                <option value="date_desc">{t('entries.sortNewestDate')}</option>
                <option value="date_asc">{t('reflections.sortOldestDate')}</option>
                <option value="created_desc">{t('entries.sortRecentlyAdded')}</option>
                <option value="created_asc">{t('reflections.sortOldestAdded')}</option>
                <option value="hours_desc">{t('reflections.sortMostHours')}</option>
                <option value="has_reflection_first">{t('reflections.sortHasReflectionFirst')}</option>
              </select>
            </div>
          </div>
        </div>

        {dayGroups.length > 0 ? (
          <div className="space-y-4">
            {dayGroups.map((group) => {
              const displayDate = format(parseISO(group.date), 'MMMM dd, yyyy')
              const categoryLabel = group.categories.slice(0, 2).join(' • ')
              const extraCategories = group.categories.length > 2 ? ` +${group.categories.length - 2}` : ''
              const previewFields = reflectionFields
                .filter((field) => {
                  const value = group.reflection.values[field.id]
                  return field.type === 'checkbox' ? Boolean(value) : Boolean(String(value ?? '').trim())
                })
                .slice(0, 2)

              return (
                <div
                  key={group.date}
                  className="card cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedDate(group.date)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium">{displayDate}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {formatHoursMinutes(group.totalHours)} worked • {formatHoursMinutes(group.paidHours)} paid • {formatHoursMinutes(group.unpaidHours)} unpaid
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {group.shifts.length} log{group.shifts.length === 1 ? '' : 's'} • {formatWeekLabel(group.date)} • {categoryLabel || 'General'}{extraCategories}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        {group.paidHours > 0 && <ShiftStatusBadge paid={true} />}
                        {group.unpaidHours > 0 && <ShiftStatusBadge paid={false} />}
                      </div>
                    </div>
                  </div>

                  {group.hasReflection ? (
                    <div className="space-y-2">
                      {previewFields.map((field) => (
                        <div key={field.id}>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{field.label}</p>
                          <p className="text-gray-700 dark:text-gray-300 line-clamp-2">
                            {formatReflectionFieldValue(field, group.reflection.values[field.id]) || 'No response yet'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400">No reflection yet. Click to add one.</p>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="card text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">No shifts found yet.</p>
          </div>
        )}
      </div>

      <Modal
        isOpen={Boolean(selectedGroup) || Boolean(editingId)}
        onClose={() => {
          setSelectedDate(null)
          setEditingId(null)
          setEditingDate(null)
        }}
        title={editingId ? t('reflections.editTitle') : t('reflections.viewTitle')}
        maxWidthClass="max-w-3xl"
        footer={
          editingId ? (
            <div className="flex gap-2">
              <button onClick={handleSaveReflection} className="btn-primary flex-1">
                {t('common.save')}
              </button>
              <button
                onClick={() => {
                  setEditingId(null)
                  setEditingDate(null)
                  setEnhancedText('')
                }}
                className="btn-secondary flex-1"
              >
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => selectedGroup && openEdit(selectedGroup.shifts[0])}
                className="btn-primary flex-1"
              >
                {t('common.edit')}
              </button>
              <button onClick={() => setSelectedDate(null)} className="btn-secondary flex-1">
                {t('common.close')}
              </button>
            </div>
          )
        }
      >
        {editingId ? (
          <div className="space-y-4">
            {reflectionFields.map((field) => {
              const value = editReflection.values[field.id]

              return (
                <div key={field.id}>
                  <label className="block text-sm font-medium mb-2">
                    {field.label}
                    {field.required ? ' *' : ''}
                  </label>

                  {field.type === 'textarea' && (
                    <textarea
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) =>
                        setEditReflection({
                          values: { ...editReflection.values, [field.id]: e.target.value },
                        })
                      }
                      className="input-base w-full h-24 resize-none"
                      placeholder={field.placeholder || ''}
                    />
                  )}

                  {field.type === 'text' && (
                    <input
                      type="text"
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) =>
                        setEditReflection({
                          values: { ...editReflection.values, [field.id]: e.target.value },
                        })
                      }
                      className="input-base w-full"
                      placeholder={field.placeholder || ''}
                    />
                  )}

                  {field.type === 'number' && (
                    <input
                      type="number"
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) =>
                        setEditReflection({
                          values: { ...editReflection.values, [field.id]: e.target.value },
                        })
                      }
                      className="input-base w-full"
                      placeholder={field.placeholder || ''}
                    />
                  )}

                  {field.type === 'checkbox' && (
                    <label className="flex items-center gap-2 text-sm p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) =>
                          setEditReflection({
                            values: { ...editReflection.values, [field.id]: e.target.checked },
                          })
                        }
                      />
                      {field.helpText || field.placeholder || field.label}
                    </label>
                  )}

                  {field.type === 'select' && (
                    <select
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) =>
                        setEditReflection({
                          values: { ...editReflection.values, [field.id]: e.target.value },
                        })
                      }
                      className="input-base w-full"
                    >
                      <option value="">Select an option</option>
                      {(field.options || []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.helpText && field.type !== 'checkbox' && (
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{field.helpText}</p>
                  )}
                </div>
              )
            })}

            <button
              onClick={handleEnhanceWithAI}
              disabled={loadingEnhance}
              className="w-full btn-secondary"
              title="Enhance reflection with AI"
            >
              {loadingEnhance ? 'Enhancing...' : 'Enhance with AI'}
            </button>

            {!hasOpenAiKey && (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Add your OpenAI API key in Settings to enable AI enhancement.
              </p>
            )}

            {enhancedText && (
              <div>
                <label className="block text-sm font-medium mb-2">AI Enhanced Version</label>
                <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                  <p className="text-sm text-primary-900 dark:text-primary-200 whitespace-pre-wrap">{enhancedText}</p>
                </div>
              </div>
            )}
          </div>
        ) : selectedGroup ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Date</p>
              <p className="font-medium">{format(parseISO(selectedGroup.date), 'MMMM dd, yyyy')}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Hours</p>
              <p className="font-medium">
                {formatHoursMinutes(selectedGroup.totalHours)} worked • {formatHoursMinutes(selectedGroup.paidHours)} paid • {formatHoursMinutes(selectedGroup.unpaidHours)} unpaid
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Logs</p>
              <p className="font-medium">
                {selectedGroup.shifts.length} log{selectedGroup.shifts.length === 1 ? '' : 's'} • {selectedGroup.categories.join(' • ')}
              </p>
            </div>

            <div className="space-y-3">
              {reflectionFields.map((field) => (
                <div key={field.id}>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{field.label}</p>
                  <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                    {formatReflectionFieldValue(field, selectedGroup.reflection.values[field.id]) || 'Not added yet'}
                  </p>
                </div>
              ))}
            </div>

            {selectedGroup.enhancedReflection && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">AI Enhanced Version</p>
                <p className="text-gray-900 dark:text-gray-100 bg-primary-50 dark:bg-primary-900/20 p-3 rounded-lg whitespace-pre-wrap">
                  {selectedGroup.enhancedReflection}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title={t('import.reviewTitle')}
        maxWidthClass="max-w-5xl"
        footer={
          <div className="flex gap-2">
            <button
              onClick={handleApplyReviewedImport}
              className="btn-primary flex-1"
              disabled={isApplyingImport}
            >
              {isApplyingImport ? t('common.saving') : t('import.confirmImport')}
            </button>
            <button onClick={() => setIsReviewModalOpen(false)} className="btn-secondary flex-1">
              {t('common.cancel')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('import.reviewHelp')}</p>

          <div className="flex justify-end">
            <button type="button" className="btn-secondary" onClick={addReviewRow}>
              + {t('import.addRow')}
            </button>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {reviewEntries.map((entry) => (
              <div key={entry.clientId} className="rounded-xl border border-gray-200 dark:border-slate-700 p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">{t('common.date')}</label>
                    <input
                      type="date"
                      value={entry.date}
                      onChange={(e) => updateReviewRow(entry.clientId, { date: e.target.value })}
                      className="input-base w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">{t('common.duration')}</label>
                    <input
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={entry.hours_worked}
                      onChange={(e) => updateReviewRow(entry.clientId, { hours_worked: Number(e.target.value) })}
                      className="input-base w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">{t('common.paid')}</label>
                    <select
                      value={entry.paid === null ? 'auto' : entry.paid ? 'paid' : 'unpaid'}
                      onChange={(e) =>
                        updateReviewRow(entry.clientId, {
                          paid: e.target.value === 'auto' ? null : e.target.value === 'paid',
                        })
                      }
                      className="input-base w-full"
                    >
                      <option value="auto">{t('logHours.autoCalculate')}</option>
                      <option value="paid">{t('common.paid')}</option>
                      <option value="unpaid">{t('common.unpaid')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">{t('common.category')}</label>
                    <input
                      type="text"
                      value={entry.category}
                      onChange={(e) => updateReviewRow(entry.clientId, { category: e.target.value })}
                      className="input-base w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">{t('common.notes')}</label>
                    <textarea
                      value={entry.notes}
                      onChange={(e) => updateReviewRow(entry.clientId, { notes: e.target.value })}
                      className="input-base w-full h-20 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">{t('logHours.reflectionOptional')}</label>
                    <textarea
                      value={entry.reflection}
                      onChange={(e) => updateReviewRow(entry.clientId, { reflection: e.target.value })}
                      className="input-base w-full h-20 resize-none"
                    />

                    <div className="mt-2 flex gap-2 items-start">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleEnhanceRow(entry.clientId)}
                        disabled={entry.enhancing}
                      >
                        {entry.enhancing ? t('import.enhancing') : t('import.enhance')}
                      </button>

                      {entry.enhancedPreview && (
                        <div className="flex-1">
                          <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded">
                            <p className="text-sm whitespace-pre-wrap">{entry.enhancedPreview}</p>
                          </div>
                          <div className="flex justify-end mt-2">
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => updateReviewRow(entry.clientId, { reflection: entry.enhancedPreview || '' , enhancedPreview: null })}
                            >
                              {t('import.useEnhanced')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="button" className="btn-danger" onClick={() => removeReviewRow(entry.clientId)}>
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))}

            {!reviewEntries.length && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('import.noRows')}</p>
            )}
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
