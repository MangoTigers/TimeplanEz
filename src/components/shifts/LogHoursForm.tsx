import React from 'react'
import { useShiftStore, useSettingsStore, useAuthStore } from '@/store'
import { supabase, ensureUserProfile, getUserProfile } from '@/lib/supabase'
import { useToast } from '@/components/common/UI'
import { v4 as uuidv4 } from 'uuid'
import { format, startOfWeek, parseISO } from 'date-fns'
import { partsToHours, hoursToParts, formatHoursMinutes } from '@/lib/calculations'
import { DurationInput } from './DurationInput'

interface LogHoursFormProps {
  onSaved?: () => void
  submitLabel?: string
}

export const LogHoursForm: React.FC<LogHoursFormProps> = ({
  onSaved,
  submitLabel = '✓ Log Hours',
}) => {
  const { user } = useAuthStore()
  const { addShift, shifts } = useShiftStore()
  const { settings } = useSettingsStore()
  const toast = useToast()
  const [loading, setLoading] = React.useState(false)
  const [formData, setFormData] = React.useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    fromTime: '',
    toTime: '',
    hours: 0,
    minutes: 0,
    category: 'General',
    notes: '',
    paidStatus: 'auto', // 'auto', 'paid', 'unpaid'
  })

  const parseTimeToMinutes = (time: string): number | null => {
    if (!time || !time.includes(':')) return null
    const [h, m] = time.split(':').map((v) => parseInt(v, 10))
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    if (h < 0 || h > 23 || m < 0 || m > 59) return null
    return h * 60 + m
  }

  React.useEffect(() => {
    const fromMinutes = parseTimeToMinutes(formData.fromTime)
    const toMinutes = parseTimeToMinutes(formData.toTime)

    if (fromMinutes === null || toMinutes === null) {
      return
    }

    let diff = toMinutes - fromMinutes
    if (diff <= 0) {
      diff += 24 * 60
    }

    const calculatedHours = Math.floor(diff / 60)
    const calculatedMinutes = diff % 60

    if (calculatedHours === formData.hours && calculatedMinutes === formData.minutes) {
      return
    }

    setFormData((prev) => ({
      ...prev,
      hours: calculatedHours,
      minutes: calculatedMinutes,
    }))
  }, [formData.fromTime, formData.toTime])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const workedHours = partsToHours(formData.hours, formData.minutes)
    if (workedHours <= 0) {
      toast.showToast({ type: 'warning', message: 'Please enter a duration greater than 0 minutes.' })
      return
    }

    setLoading(true)

    try {
      await ensureUserProfile(user)

      const profile = await getUserProfile(user.id)
      const effectiveSchoolHours = Number(profile?.school_hours_per_week ?? settings?.school_hours_per_week ?? 20)

      const weekStart = startOfWeek(new Date(formData.date), { weekStartsOn: 1 })
      const weekShifts = shifts.filter((s) => {
        const shiftDate = parseISO(s.date)
        return shiftDate >= weekStart && shiftDate < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
      })

      const shiftsToInsert: Array<{
        id: string
        user_id: string
        date: string
        hours_worked: number
        paid: boolean
        category: string
        notes: string | null
        reflection: null
        created_at: string
        updated_at: string
      }> = []

      if (formData.paidStatus === 'paid' || formData.paidStatus === 'unpaid') {
        shiftsToInsert.push({
          id: uuidv4(),
          user_id: user.id,
          date: formData.date,
          hours_worked: workedHours,
          paid: formData.paidStatus === 'paid',
          category: formData.category,
          notes: formData.notes || null,
          reflection: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      } else {
        const unpaidHoursUsed = weekShifts
          .filter((s) => s.paid === false)
          .reduce((sum, s) => sum + s.hours_worked, 0)

        const remainingSchoolHours = Math.max(0, effectiveSchoolHours - unpaidHoursUsed)
        const unpaidPart = Math.min(workedHours, remainingSchoolHours)
        const paidPart = Math.max(0, workedHours - unpaidPart)

        if (unpaidPart > 0) {
          shiftsToInsert.push({
            id: uuidv4(),
            user_id: user.id,
            date: formData.date,
            hours_worked: unpaidPart,
            paid: false,
            category: formData.category,
            notes: formData.notes || null,
            reflection: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }

        if (paidPart > 0) {
          shiftsToInsert.push({
            id: uuidv4(),
            user_id: user.id,
            date: formData.date,
            hours_worked: paidPart,
            paid: true,
            category: formData.category,
            notes: formData.notes || null,
            reflection: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }
      }

      const { error } = await supabase.from('shifts').insert(shiftsToInsert)
      if (error) throw error

      shiftsToInsert.forEach((shift) => addShift(shift))

      if (formData.paidStatus === 'auto' && shiftsToInsert.length === 2) {
        toast.showToast({
          type: 'success',
          message: `Shift logged and split: ${formatHoursMinutes(shiftsToInsert[0].hours_worked)} unpaid, ${formatHoursMinutes(shiftsToInsert[1].hours_worked)} paid.`,
        })
      } else {
        toast.showToast({ type: 'success', message: 'Shift logged successfully!' })
      }

      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        fromTime: '',
        toTime: '',
        hours: 0,
        minutes: 0,
        category: 'General',
        notes: '',
        paidStatus: 'auto',
      })

      onSaved?.()
    } catch (error: any) {
      toast.showToast({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Date</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="input-base w-full"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Duration</label>
          <DurationInput
            hours={formData.hours}
            minutes={formData.minutes}
            onHoursChange={(hours) => setFormData({ ...formData, hours })}
            onMinutesChange={(minutes) => setFormData({ ...formData, minutes })}
          />
          <p className="text-xs text-gray-500 dark:text-gray-300 mt-2">
            You can type duration manually, or use From/To below for auto-calculation.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">From Time</label>
          <input
            type="time"
            value={formData.fromTime}
            onChange={(e) => setFormData({ ...formData, fromTime: e.target.value })}
            className="input-base w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">To Time</label>
          <input
            type="time"
            value={formData.toTime}
            onChange={(e) => setFormData({ ...formData, toTime: e.target.value })}
            className="input-base w-full"
          />
        </div>
      </div>

      {formData.fromTime && formData.toTime && (
        <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-lg border border-primary-200 dark:border-primary-700">
          <p className="text-sm text-primary-900 dark:text-primary-200">
            Auto-calculated duration: <strong>{formatHoursMinutes(partsToHours(formData.hours, formData.minutes))}</strong>
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Category</label>
        <select
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          className="input-base w-full"
        >
          <option>General</option>
          <option>Tutoring</option>
          <option>Event</option>
          <option>Administration</option>
          <option>Other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Paid Status</label>
        <div className="space-y-3">
          {(['auto', 'paid', 'unpaid'] as const).map((status) => {
            const label = status === 'auto' ? 'Auto-Calculate' : status === 'paid' ? 'Mark as Paid' : 'Mark as Unpaid'
            const description =
              status === 'auto'
                ? `Based on school hours per week (${formatHoursMinutes(settings?.school_hours_per_week || 20)})`
                : status === 'paid'
                  ? 'Override - count towards earnings'
                  : 'Override - counts towards school hours'
            const borderColor =
              formData.paidStatus === status
                ? status === 'auto'
                  ? '#0ea5e9'
                  : status === 'paid'
                    ? '#22c55e'
                    : '#f59e0b'
                : 'transparent'

            return (
              <label
                key={status}
                className="flex items-center gap-3 p-3 border-2 border-transparent rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                style={{ borderColor }}
              >
                <input
                  type="radio"
                  name="paidStatus"
                  value={status}
                  checked={formData.paidStatus === status}
                  onChange={(e) => setFormData({ ...formData, paidStatus: e.target.value })}
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Notes (Optional)</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="input-base w-full h-24 resize-none"
          placeholder="Add any notes about this shift..."
        ></textarea>
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Saving...' : submitLabel}
      </button>

      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">Quick Templates</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(settings?.quick_templates || []).map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                const templateParts = hoursToParts(template.minutes / 60)
                setFormData({
                  ...formData,
                  fromTime: '',
                  toTime: '',
                  hours: templateParts.hours,
                  minutes: templateParts.minutes,
                })
              }}
              className="p-3 bg-gray-100 dark:bg-gray-800 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg font-medium transition-colors text-gray-900 dark:text-gray-100"
            >
              {template.label}
            </button>
          ))}
        </div>
        {!settings?.quick_templates?.length && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
            No templates configured yet. Add templates in Settings.
          </p>
        )}
      </div>
    </form>
  )
}
