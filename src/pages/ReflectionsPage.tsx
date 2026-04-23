import React from 'react'
import { Layout } from '@/components/Layout'
import { useShiftStore, useAuthStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { useToast, Modal } from '@/components/common/UI'
import { format, parseISO } from 'date-fns'
import { formatHoursMinutes } from '@/lib/calculations'
import { ShiftStatusBadge } from '@/components/shifts/ShiftStatusBadge'

interface ShiftWithReflection {
  id: string
  date: string
  hours_worked: number
  paid: boolean
  category: string
  reflection: string | null
  enhanced_reflection: string | null
}

export const ReflectionsPage: React.FC = () => {
  const { user } = useAuthStore()
  const { shifts } = useShiftStore()
  const toast = useToast()
  const [reflections, setReflections] = React.useState<ShiftWithReflection[]>([])
  const [selectedReflection, setSelectedReflection] = React.useState<ShiftWithReflection | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editText, setEditText] = React.useState('')
  const [enhancedText, setEnhancedText] = React.useState('')
  const [loadingEnhance, setLoadingEnhance] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState('')

  React.useEffect(() => {
    if (user) {
      loadReflections()
    }
  }, [user, shifts])

  const loadReflections = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id)
        .not('reflection', 'is', null)
        .order('date', { ascending: false })

      if (error) throw error

      setReflections(data || [])
    } catch (error: any) {
      toast.showToast({ type: 'error', message: 'Failed to load reflections' })
    }
  }

  const handleEditReflection = (reflection: ShiftWithReflection) => {
    setEditingId(reflection.id)
    setEditText(reflection.reflection || '')
    setEnhancedText(reflection.enhanced_reflection || '')
  }

  const handleSaveReflection = async () => {
    if (!user || !editingId) return

    try {
      const { error } = await supabase
        .from('shifts')
        .update({ reflection: editText, enhanced_reflection: enhancedText })
        .eq('id', editingId)
        .eq('user_id', user.id)

      if (error) throw error

      // Update local state
      setReflections((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? { ...r, reflection: editText, enhanced_reflection: enhancedText }
            : r
        )
      )

      setEditingId(null)
      toast.showToast({ type: 'success', message: 'Reflection saved!' })
    } catch (error: any) {
      toast.showToast({ type: 'error', message: 'Failed to save reflection' })
    }
  }

  const handleEnhanceWithAI = async () => {
    if (!editText.trim()) {
      toast.showToast({ type: 'warning', message: 'Please write a reflection first' })
      return
    }

    setLoadingEnhance(true)

    try {
      // Call OpenAI API via Supabase Edge Function
      const response = await fetch(
        `${"https://hequhhjhvwbmbkwyjzhj.supabase.co"}/functions/v1/enhance-reflection`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${"eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlcXVoaGpodndibWJrd3lqemhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MzUwMzMsImV4cCI6MjA5MjUxMTAzM30"}`,
          },
          body: JSON.stringify({
            reflection: editText,
          }),
        }
      )

      if (!response.ok) {
        // For demo, generate a simple enhanced version
        const enhanced =
          editText.charAt(0).toUpperCase() +
          editText.slice(1) +
          '\n\n[Note: AI enhancement would be available with OpenAI API configuration]'
        setEnhancedText(enhanced)
        toast.showToast({
          type: 'info',
          message: 'Demo enhancement. Connect OpenAI API for full features.',
        })
        return
      }

      const data = await response.json()
      setEnhancedText(data.enhanced_text)
      toast.showToast({ type: 'success', message: 'Reflection enhanced!' })
    } catch (error) {
      toast.showToast({ type: 'error', message: 'Failed to enhance reflection' })
    } finally {
      setLoadingEnhance(false)
    }
  }

  const filteredReflections = reflections.filter(
    (r) =>
      r.reflection?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reflections</h1>
        </div>

        {/* Search */}
        <div className="card">
          <input
            type="text"
            placeholder="Search reflections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-base w-full"
          />
        </div>

        {/* Reflections List */}
        {filteredReflections.length > 0 ? (
          <div className="space-y-4">
            {filteredReflections.map((reflection) => (
              <div key={reflection.id} className="card cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedReflection(reflection)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium">{format(parseISO(reflection.date), 'MMMM dd, yyyy')}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatHoursMinutes(reflection.hours_worked)} • {reflection.category}
                    </p>
                  </div>
                  <ShiftStatusBadge paid={reflection.paid} />
                </div>
                <p className="text-gray-700 dark:text-gray-300 line-clamp-2">
                  {reflection.reflection}
                </p>
                {reflection.enhanced_reflection && (
                  <p className="mt-2 text-sm text-primary-600 dark:text-primary-400">
                    ✨ Enhanced version available
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 mb-4">No reflections yet</p>
            <a href="/log-hours" className="btn-primary">
              Add your first reflection
            </a>
          </div>
        )}
      </div>

      {/* Reflection Detail Modal */}
      <Modal
        isOpen={Boolean(selectedReflection) || Boolean(editingId)}
        onClose={() => {
          setSelectedReflection(null)
          setEditingId(null)
        }}
        title={
          editingId ? '✏️ Edit Reflection' : 'View Reflection'
        }
    footer={
          editingId ? (
            <div className="flex gap-2">
              <button onClick={handleSaveReflection} className="btn-primary flex-1">
                ✓ Save
              </button>
              <button
                onClick={() => {
                  setEditingId(null)
                  setEditText('')
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
                onClick={() => selectedReflection && handleEditReflection(selectedReflection)}
                className="btn-primary flex-1"
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => setSelectedReflection(null)}
                className="btn-secondary flex-1"
              >
                Close
              </button>
            </div>
          )
        }
      >
        {editingId ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Your Reflection</label>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="input-base w-full h-32 resize-none"
                placeholder="Write your reflection..."
              />
            </div>

            <button
              onClick={handleEnhanceWithAI}
              disabled={loadingEnhance}
              className="btn-secondary w-full"
            >
              {loadingEnhance ? '✨ Enhancing...' : '✨ Enhance with AI'}
            </button>

            {enhancedText && (
              <div>
                <label className="block text-sm font-medium mb-2">✨ AI Enhanced Version</label>
                <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                  <p className="text-sm text-primary-900 dark:text-primary-200 whitespace-pre-wrap">
                    {enhancedText}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : selectedReflection ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Date & Category</p>
              <p className="font-medium">
                {format(parseISO(selectedReflection.date), 'MMMM dd, yyyy')} •{' '}
                {selectedReflection.category}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Hours & Status</p>
              <p className="font-medium">
                {formatHoursMinutes(selectedReflection.hours_worked)} •{' '}
                <span className={selectedReflection.paid ? 'text-success-600' : 'text-warning-600'}>
                  {selectedReflection.paid ? 'Paid' : 'Unpaid'}
                </span>
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Reflection</p>
              <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                {selectedReflection.reflection}
              </p>
            </div>

            {selectedReflection.enhanced_reflection && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">✨ Enhanced Version</p>
                <p className="text-gray-900 dark:text-gray-100 bg-primary-50 dark:bg-primary-900/20 p-3 rounded-lg whitespace-pre-wrap">
                  {selectedReflection.enhanced_reflection}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </Layout>
  )
}
