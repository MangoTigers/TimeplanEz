import React from 'react'
import { Layout } from '@/components/Layout'
import { useShiftStore, useSettingsStore, useAuthStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/common/UI'
import { Modal } from '@/components/common/UI'
import { formatHoursMinutes } from '@/lib/calculations'
import {
  defaultReflectionFields,
  formatReflectionFieldValue,
  normalizeReflectionFields,
  parseReflection,
  type ReflectionData,
  type ReflectionFieldConfig,
} from '@/lib/reflections'
import { StatCard } from '@/components/common/StatCard'
import { ShiftTable } from '@/components/shifts/ShiftTable'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns'
import { useTranslation } from '@/lib/i18n'
import { ExpandableCard } from '@/components/common/ExpandableCard'
import { classifyEdgeFunctionError, getEdgeFunctionTroubleshootingHint } from '@/lib/edgeFunctions'

interface DayExportRow {
  date: string
  totalHours: number
  paidHours: number
  unpaidHours: number
  status: string
  categories: string[]
  notes: string
  reflection: ReflectionData
  enhancedReflection: string
}

export const AnalyticsPage: React.FC = () => {
  const { user } = useAuthStore()
  const { shifts, setShifts, deleteShift } = useShiftStore()
  const { settings } = useSettingsStore()
  const toast = useToast()
  const { t } = useTranslation()
  const reflectionFields = React.useMemo<ReflectionFieldConfig[]>(
    () => normalizeReflectionFields(settings?.reflection_fields?.length ? settings.reflection_fields : defaultReflectionFields),
    [settings?.reflection_fields]
  )
  const [selectedMonth, setSelectedMonth] = React.useState(new Date())
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false)
  const [importAiFile, setImportAiFile] = React.useState<File | null>(null)
  const [isImportingAi, setIsImportingAi] = React.useState(false)
  const hasOpenAiKey = Boolean(settings?.openai_api_key?.trim())

  React.useEffect(() => {
    if (user) {
      loadShifts()
    }
  }, [user])

  const loadShifts = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (error) throw error
      setShifts(data || [])
    } catch (error: any) {
      toast.showToast({ type: 'error', message: t('analytics.failedToLoadShifts') })
    }
  }

  const handleDeleteShift = async (shiftId: string) => {
    if (!user) return

    const confirmed = window.confirm(t('dashboard.deleteConfirm'))
    if (!confirmed) {
      return
    }

    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', shiftId)
        .eq('user_id', user.id)

      if (error) throw error

      deleteShift(shiftId)
      toast.showToast({ type: 'success', message: t('dashboard.deleteSuccess') })
    } catch (error: any) {
      toast.showToast({ type: 'error', message: error.message || t('dashboard.deleteFailed') })
    }
  }

  // Calculate monthly data
  const monthStart = startOfMonth(selectedMonth)
  const monthEnd = endOfMonth(selectedMonth)
  const monthShifts = shifts.filter((s) => {
    const date = parseISO(s.date)
    return date >= monthStart && date <= monthEnd
  })

  const dailyData = eachDayOfInterval({ start: monthStart, end: monthEnd }).map((date) => {
    const dayShifts = shifts.filter((s) => {
      const shiftDate = parseISO(s.date)
      return shiftDate.toDateString() === date.toDateString()
    })

    const totalHours = dayShifts.reduce((sum, s) => sum + s.hours_worked, 0)
    const paidHours = dayShifts.filter((s) => s.paid).reduce((sum, s) => sum + s.hours_worked, 0)
    const unpaidHours = totalHours - paidHours

    return {
      date: format(date, 'dd/MM'),
      hours: totalHours,
      paid: paidHours,
      unpaid: unpaidHours,
    }
  })

  const categoryData = Object.entries(
    monthShifts.reduce(
      (acc, shift) => {
        const category = shift.category || t('common.general')
        acc[category] = (acc[category] || 0) + shift.hours_worked
        return acc
      },
      {} as Record<string, number>
    )
  ).map(([name, value]) => ({ name, value }))

  const totalHours = monthShifts.reduce((sum, s) => sum + s.hours_worked, 0)
  const totalPaidHours = monthShifts.filter((s) => s.paid).reduce((sum, s) => sum + s.hours_worked, 0)
  const totalUnpaidHours = totalHours - totalPaidHours
  const totalEarnings = totalPaidHours * (settings?.hourly_rate || 120)

  const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f59e0b', '#ef4444', '#8b5cf6']

  const dayExportRows = React.useMemo<DayExportRow[]>(() => {
    const grouped = new Map<string, typeof monthShifts>()

    monthShifts.forEach((shift) => {
      const next = grouped.get(shift.date) || []
      next.push(shift)
      grouped.set(shift.date, next)
    })

    return Array.from(grouped.entries())
      .map(([date, dayShifts]) => {
        const totalHours = dayShifts.reduce((sum, shift) => sum + shift.hours_worked, 0)
        const paidHours = dayShifts.filter((shift) => shift.paid).reduce((sum, shift) => sum + shift.hours_worked, 0)
        const unpaidHours = totalHours - paidHours
        const reflectionSource = dayShifts.find((shift) => Boolean(shift.reflection))
        const reflection = parseReflection(reflectionSource?.reflection || null, reflectionFields)

        return {
          date,
          totalHours,
          paidHours,
          unpaidHours,
          status: paidHours > 0 && unpaidHours > 0 ? t('analytics.mixed') : paidHours > 0 ? t('common.paid') : t('common.unpaid'),
          categories: Array.from(new Set(dayShifts.map((shift) => shift.category || t('common.general')))),
          notes: Array.from(
            new Set(dayShifts.map((shift) => shift.notes?.trim()).filter(Boolean) as string[])
          ).join(' | '),
          reflection,
          enhancedReflection: reflectionSource?.enhanced_reflection || '',
        }
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [monthShifts, reflectionFields])

  const handleExportCSV = () => {
    const headers = [
      t('analytics.headersDate'),
      t('analytics.headersTotalHours'),
      t('dashboard.paidHours'),
      t('dashboard.unpaidHours'),
      t('analytics.headersStatus'),
      t('analytics.headersCategories'),
      t('analytics.headersNotes'),
      ...reflectionFields.map((field) => field.label),
      t('analytics.headersEnhancedReflection'),
    ]

    const rows = dayExportRows.map((day) => [
      format(parseISO(day.date), 'yyyy-MM-dd'),
      day.totalHours,
      day.paidHours,
      day.unpaidHours,
      day.status,
      day.categories.join(' • '),
      day.notes,
      ...reflectionFields.map((field) => formatReflectionFieldValue(field, day.reflection.values[field.id])),
      day.enhancedReflection,
    ])

    const toCsvCell = (value: string | number | boolean | null | undefined) => {
      const text = String(value ?? '')
      return `"${text.replace(/"/g, '""')}"`
    }

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => toCsvCell(cell)).join(',')),
    ].join('\n')

    // Prepend UTF-8 BOM for better Excel compatibility (handles Norwegian letters correctly)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `eztimeplan-${format(selectedMonth, 'yyyy-MM')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.showToast({ type: 'success', message: t('analytics.exportSuccess') })
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

    if (!hasOpenAiKey) {
      toast.showToast({ type: 'warning', message: t('analytics.importRequiresAiKey') })
      return
    }

    const allowedTypes = ['application/pdf', 'text/plain', 'text/csv']
    if (importAiFile.type && !allowedTypes.includes(importAiFile.type)) {
      toast.showToast({ type: 'warning', message: t('analytics.importOnlyPdf') })
      // Reuse existing translation key; UI copy still says PDF, but parser supports CSV/TXT too.
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

      const { data, error } = await supabase.functions.invoke('import-pdf-history', {
        body: {
          fileName: importAiFile.name,
          fileBase64,
          fileType: importAiFile.type || null,
          reflectionFields,
          openaiApiKey: settings?.openai_api_key || null,
        },
      })

      if (error) throw error

      const importedCount = Number(data?.importedCount || 0)
      const skippedCount = Number(data?.skippedDuplicates || 0)

      if (importedCount <= 0) {
        toast.showToast({ type: 'warning', message: t('analytics.importNoRows') })
      } else {
        toast.showToast({
          type: 'success',
          message: t('analytics.importSuccess', {
            count: importedCount,
            skipped: skippedCount,
          }),
        })
      }

      await loadShifts()
      setImportAiFile(null)
    } catch (error: any) {
      const code = classifyEdgeFunctionError(error)
      const message =
        code === 'not_deployed'
          ? t('errors.edgeFunctionNotDeployed', { name: 'import-pdf-history' })
          : code === 'network'
            ? `${t('errors.edgeFunctionNetwork')} ${getEdgeFunctionTroubleshootingHint()}`
            : error?.message || t('errors.edgeFunctionUnknown')
      toast.showToast({
        type: 'error',
        message,
      })
    } finally {
      setIsImportingAi(false)
    }
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('layout.analytics')}</h1>
          <button onClick={() => setIsExportModalOpen(true)} className="btn-secondary">
            📥 {t('analytics.exportData')}
          </button>
        </div>

        {/* Month Selector */}
        <div className="card">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
              className="btn-secondary"
            >
              ← {t('analytics.previous')}
            </button>
            <h2 className="text-xl font-bold">{format(selectedMonth, 'MMMM yyyy')}</h2>
            <button
              onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
              className="btn-secondary"
            >
              {t('analytics.next')} →
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label={t('dashboard.totalHours')} value={formatHoursMinutes(totalHours)} />
          <StatCard label={t('dashboard.paidHours')} value={formatHoursMinutes(totalPaidHours)} valueClassName="text-success-600 dark:text-success-400" />
          <StatCard label={t('dashboard.unpaidHours')} value={formatHoursMinutes(totalUnpaidHours)} valueClassName="text-warning-600 dark:text-warning-400" />
          <StatCard label={t('analytics.totalEarnings')} value={`${settings?.currency} ${totalEarnings.toFixed(0)}`} valueClassName="text-primary-600 dark:text-primary-400" />
        </div>

        {/* Daily Hours Chart */}
        {dailyData.length > 0 && (
          <ExpandableCard title={t('analytics.dailyOverview')} collapsedMaxHeight={360}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                  <Bar dataKey="paid" fill="#22c55e" name={t('analytics.paid')} />
                  <Bar dataKey="unpaid" fill="#eab308" name={t('analytics.unpaid')} />
              </BarChart>
            </ResponsiveContainer>
          </ExpandableCard>
        )}

        {/* Hourly Trend Chart */}
        {dailyData.length > 0 && (
          <ExpandableCard title={t('analytics.hoursTrend')} collapsedMaxHeight={360}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="hours" stroke="#0ea5e9" name={t('analytics.totalHoursSeries')} />
                <Line type="monotone" dataKey="paid" stroke="#22c55e" name={t('analytics.paidHoursSeries')} />
              </LineChart>
            </ResponsiveContainer>
          </ExpandableCard>
        )}

        {/* Category Breakdown */}
        {categoryData.length > 0 && (
          <ExpandableCard title={t('analytics.hoursByCategory')} collapsedMaxHeight={360}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value.toFixed(1)}h`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ExpandableCard>
        )}

        {/* Weekly Summary Table */}
        {monthShifts.length > 0 && (
          <ExpandableCard title={t('analytics.shiftsThisMonth')} collapsedMaxHeight={420}>
            <ShiftTable
              shifts={monthShifts}
              currency={settings?.currency || 'NOK'}
              hourlyRate={settings?.hourly_rate || 120}
              onDeleteShift={handleDeleteShift}
            />
          </ExpandableCard>
        )}
      </div>

      {/* Export Modal */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title={t('analytics.exportData')}
        footer={
          <div className="flex gap-2">
            <button onClick={handleExportCSV} className="btn-primary flex-1">
              📥 {t('analytics.downloadCsv')}
            </button>
            <button onClick={() => setIsExportModalOpen(false)} className="btn-secondary flex-1">
              {t('common.cancel')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p>{t('analytics.exportMonth', { month: format(selectedMonth, 'MMMM yyyy') })}</p>
          <div className="bg-primary-50 dark:bg-primary-900/20 p-3 rounded-lg text-sm text-primary-900 dark:text-primary-200">
            {t('analytics.exportDescription')}
          </div>

          <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('analytics.importPdfTitle')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('analytics.importPdfHelp')}</p>

            <input
              type="file"
              accept="application/pdf,text/plain,text/csv,.pdf,.txt,.csv"
              onChange={(e) => setImportAiFile(e.target.files?.[0] || null)}
              className="input-base w-full"
            />

            {!hasOpenAiKey && (
              <p className="text-xs text-warning-700 dark:text-warning-300">{t('analytics.importRequiresAiKey')}</p>
            )}

            <button
              type="button"
              onClick={handleImportAi}
              disabled={isImportingAi || !importAiFile || !hasOpenAiKey}
              className="btn-secondary w-full"
            >
              {isImportingAi ? t('analytics.importingPdf') : t('analytics.importPdfAction')}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
