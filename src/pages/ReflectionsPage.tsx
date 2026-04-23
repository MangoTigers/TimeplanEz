import React from 'react'
import { format, parseISO } from 'date-fns'
import { Layout } from '@/components/Layout'
import { useAuthStore, useSettingsStore, useShiftStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { useToast, Modal } from '@/components/common/UI'
import { formatHoursMinutes } from '@/lib/calculations'
import { ShiftStatusBadge } from '@/components/shifts/ShiftStatusBadge'
import {
  defaultReflectionChecklist,
  hasReflectionContent,
  parseReflection,
  serializeReflection,
  type ReflectionData,
} from '@/lib/reflections'

interface ShiftWithReflection {
  id: string
  date: string
  hours_worked: number
  paid: boolean | null
  category: string
  reflection: string | null
  enhanced_reflection: string | null
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

const emptyReflectionData: ReflectionData = {
  taskCompleted: '',
  howItWent: '',
  checklist: { ...defaultReflectionChecklist },
}

export const ReflectionsPage: React.FC = () => {
  const { user } = useAuthStore()
  const { settings } = useSettingsStore()
  const { shifts } = useShiftStore()
  const hasOpenAiKey = Boolean(settings?.openai_api_key?.trim())
  const toast = useToast()

  const [entries, setEntries] = React.useState<ShiftWithReflection[]>([])
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editingDate, setEditingDate] = React.useState<string | null>(null)
  const [editReflection, setEditReflection] = React.useState<ReflectionData>(emptyReflectionData)
  const [enhancedText, setEnhancedText] = React.useState('')
  const [loadingEnhance, setLoadingEnhance] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState('')

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
    setEditReflection(parseReflection(entry.reflection))
    setEnhancedText(entry.enhanced_reflection || '')
  }

  const dayGroups = React.useMemo(() => {
    const grouped = new Map<string, ShiftWithReflection[]>()

    entries.forEach((entry) => {
      const next = grouped.get(entry.date) || []
      next.push(entry)
      grouped.set(entry.date, next)
    })

    const q = searchTerm.toLowerCase()

    return Array.from(grouped.entries())
      .map(([date, shifts]) => {
        const totalHours = shifts.reduce((sum, shift) => sum + shift.hours_worked, 0)
        const paidHours = shifts.filter((shift) => shift.paid).reduce((sum, shift) => sum + shift.hours_worked, 0)
        const unpaidHours = totalHours - paidHours
        const representativeReflection = shifts.find((shift) => hasReflectionContent(parseReflection(shift.reflection)))
        const reflection = parseReflection(representativeReflection?.reflection || null)
        const enhancedReflection = representativeReflection?.enhanced_reflection || null
        const categories = Array.from(new Set(shifts.map((shift) => shift.category || 'General')))

        return {
          date,
          shifts,
          totalHours,
          paidHours,
          unpaidHours,
          categories,
          reflection,
          enhancedReflection,
          hasReflection: hasReflectionContent(reflection),
        }
      })
      .filter((group) => {
        if (!q) return true

        const categoriesText = group.categories.join(' ').toLowerCase()
        return (
          categoriesText.includes(q) ||
          group.reflection.taskCompleted.toLowerCase().includes(q) ||
          group.reflection.howItWent.toLowerCase().includes(q) ||
          format(parseISO(group.date), 'MMMM dd, yyyy').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [entries, searchTerm])

  const selectedGroup = React.useMemo(() => {
    if (!selectedDate) return null

    const shifts = entries.filter((entry) => entry.date === selectedDate)
    if (!shifts.length) return null

    const totalHours = shifts.reduce((sum, shift) => sum + shift.hours_worked, 0)
    const paidHours = shifts.filter((shift) => shift.paid).reduce((sum, shift) => sum + shift.hours_worked, 0)
    const unpaidHours = totalHours - paidHours
    const representativeReflection = shifts.find((shift) => hasReflectionContent(parseReflection(shift.reflection)))
    const reflection = parseReflection(representativeReflection?.reflection || null)
    const enhancedReflection = representativeReflection?.enhanced_reflection || null
    const categories = Array.from(new Set(shifts.map((shift) => shift.category || 'General')))

    return {
      date: selectedDate,
      shifts,
      totalHours,
      paidHours,
      unpaidHours,
      categories,
      reflection,
      enhancedReflection,
      hasReflection: hasReflectionContent(reflection),
    } as DayReflectionGroup
  }, [entries, selectedDate])

  const handleSaveReflection = async () => {
    if (!user || !editingId || !editingDate) return

    const reflectionValue = hasReflectionContent(editReflection)
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
    const sourceText = [
      `Task completed: ${editReflection.taskCompleted}`,
      `How it went: ${editReflection.howItWent}`,
    ]
      .filter((line) => !line.endsWith(': '))
      .join('\n')

    if (!sourceText.trim()) {
      toast.showToast({ type: 'warning', message: 'Fill Task Completed or How It Went first' })
      return
    }

    if (!hasOpenAiKey) {
      toast.showToast({
        type: 'warning',
        message: 'Add your OpenAI API key in Settings > AI Settings to use enhancement.',
      })
      return
    }

    setLoadingEnhance(true)

    try {
      const { data, error } = await supabase.functions.invoke('enhance-reflection', {
        body: {
          reflection: sourceText,
          openaiApiKey: settings?.openai_api_key || null,
        },
      })

      if (error) throw error
      if (!data?.enhanced_text) throw new Error('No enhancement received')

      setEnhancedText(data.enhanced_text)
      toast.showToast({ type: 'success', message: 'Reflection enhanced!' })
    } catch {
      toast.showToast({ type: 'error', message: 'Failed to enhance reflection' })
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
      'Task Completed',
      'How It Went',
      'Completed Planned Work',
      'Needed Help',
      'Learned Something',
      'Enhanced Reflection',
    ]

    const rows = entries.map((entry) => {
      const reflection = parseReflection(entry.reflection)
      return [
        format(parseISO(entry.date), 'yyyy-MM-dd'),
        entry.hours_worked,
        entry.category || 'General',
        entry.paid ? 'Paid' : 'Unpaid',
        reflection.taskCompleted,
        reflection.howItWent,
        reflection.checklist.completedPlannedWork ? 'Yes' : 'No',
        reflection.checklist.neededHelp ? 'Yes' : 'No',
        reflection.checklist.learnedSomething ? 'Yes' : 'No',
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

    toast.showToast({ type: 'success', message: 'Reflections exported.' })
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reflections</h1>
          <button onClick={handleExportReflectionsCSV} className="btn-secondary">
            Export Reflections CSV
          </button>
        </div>

        <div className="card">
          <input
            type="text"
            placeholder="Search reflections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-base w-full"
          />
        </div>

        {dayGroups.length > 0 ? (
          <div className="space-y-4">
            {dayGroups.map((group) => {
              const displayDate = format(parseISO(group.date), 'MMMM dd, yyyy')
              const categoryLabel = group.categories.slice(0, 2).join(' • ')
              const extraCategories = group.categories.length > 2 ? ` +${group.categories.length - 2}` : ''

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
                        {group.shifts.length} log{group.shifts.length === 1 ? '' : 's'} • {categoryLabel || 'General'}{extraCategories}
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
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Task Completed</p>
                      <p className="text-gray-700 dark:text-gray-300 line-clamp-2">{group.reflection.taskCompleted || 'No task details'}</p>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mt-2">How It Went</p>
                      <p className="text-gray-700 dark:text-gray-300 line-clamp-2">{group.reflection.howItWent || 'No summary yet'}</p>
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
        title={editingId ? 'Edit Reflection' : 'View Reflection'}
        maxWidthClass="max-w-3xl"
        footer={
          editingId ? (
            <div className="flex gap-2">
              <button onClick={handleSaveReflection} className="btn-primary flex-1">
                Save
              </button>
              <button
                onClick={() => {
                  setEditingId(null)
                  setEditingDate(null)
                  setEnhancedText('')
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => selectedGroup && openEdit(selectedGroup.shifts[0])}
                className="btn-primary flex-1"
              >
                Add/Edit Reflection
              </button>
              <button onClick={() => setSelectedDate(null)} className="btn-secondary flex-1">
                Close
              </button>
            </div>
          )
        }
      >
        {editingId ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Task Completed</label>
              <textarea
                value={editReflection.taskCompleted}
                onChange={(e) => setEditReflection({ ...editReflection, taskCompleted: e.target.value })}
                className="input-base w-full h-24 resize-none"
                placeholder="What tasks did you complete?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">How It Went</label>
              <textarea
                value={editReflection.howItWent}
                onChange={(e) => setEditReflection({ ...editReflection, howItWent: e.target.value })}
                className="input-base w-full h-24 resize-none"
                placeholder="How did the shift go?"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editReflection.checklist.completedPlannedWork}
                  onChange={(e) =>
                    setEditReflection({
                      ...editReflection,
                      checklist: { ...editReflection.checklist, completedPlannedWork: e.target.checked },
                    })
                  }
                />
                Completed planned work
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editReflection.checklist.neededHelp}
                  onChange={(e) =>
                    setEditReflection({
                      ...editReflection,
                      checklist: { ...editReflection.checklist, neededHelp: e.target.checked },
                    })
                  }
                />
                Needed help
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editReflection.checklist.learnedSomething}
                  onChange={(e) =>
                    setEditReflection({
                      ...editReflection,
                      checklist: { ...editReflection.checklist, learnedSomething: e.target.checked },
                    })
                  }
                />
                Learned something new
              </label>
            </div>

            <button
              onClick={handleEnhanceWithAI}
              disabled={loadingEnhance || !hasOpenAiKey}
              className={`w-full ${hasOpenAiKey ? 'btn-secondary' : 'btn-secondary opacity-50 cursor-not-allowed'}`}
              title={hasOpenAiKey ? 'Enhance reflection with AI' : 'Add your OpenAI API key in Settings > AI Settings to enable this feature'}
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

            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Task Completed</p>
              <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{selectedGroup.hasReflection ? selectedGroup.reflection.taskCompleted || 'Not added yet' : 'Not added yet'}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">How It Went</p>
              <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{selectedGroup.hasReflection ? selectedGroup.reflection.howItWent || 'Not added yet' : 'Not added yet'}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Checklist</p>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className={`badge ${selectedGroup.reflection.checklist.completedPlannedWork ? 'badge-success' : 'badge-warning'}`}>
                  Completed planned work: {selectedGroup.reflection.checklist.completedPlannedWork ? 'Yes' : 'No'}
                </span>
                <span className={`badge ${selectedGroup.reflection.checklist.neededHelp ? 'badge-warning' : 'badge-success'}`}>
                  Needed help: {selectedGroup.reflection.checklist.neededHelp ? 'Yes' : 'No'}
                </span>
                <span className={`badge ${selectedGroup.reflection.checklist.learnedSomething ? 'badge-success' : 'badge-warning'}`}>
                  Learned something new: {selectedGroup.reflection.checklist.learnedSomething ? 'Yes' : 'No'}
                </span>
              </div>
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
    </Layout>
  )
}
