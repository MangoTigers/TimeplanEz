import React from 'react'
import { Layout } from '@/components/Layout'
import { useShiftStore, useSettingsStore, useAuthStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/common/UI'
import { v4 as uuidv4 } from 'uuid'
import { format, startOfWeek, parseISO } from 'date-fns'

export const LogHoursPage: React.FC = () => {
  const { user } = useAuthStore()
  const { addShift, shifts } = useShiftStore()
  const { settings } = useSettingsStore()
  const toast = useToast()
  const [loading, setLoading] = React.useState(false)
  const [formData, setFormData] = React.useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    hours: '',
    category: 'General',
    notes: '',
    paidStatus: 'auto', // 'auto', 'paid', 'unpaid'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !formData.hours) return

    setLoading(true)

    try {
      const weekStart = startOfWeek(new Date(formData.date), { weekStartsOn: 1 })
      const weekShifts = shifts.filter((s) => {
        const shiftDate = parseISO(s.date)
        return shiftDate >= weekStart && shiftDate < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
      })

      let isPaid: boolean | null = null
      if (formData.paidStatus === 'paid') {
        isPaid = true
      } else if (formData.paidStatus === 'unpaid') {
        isPaid = false
      } else {
        // Auto-calculate based on school hours
        const schoolHours = settings?.school_hours_per_week || 20
        const unpaidHours = weekShifts
          .filter((s) => s.paid === false)
          .reduce((sum, s) => sum + s.hours_worked, 0)

        isPaid = unpaidHours + parseFloat(formData.hours) > schoolHours ? true : false
      }

      const newShift = {
        id: uuidv4(),
        user_id: user.id,
        date: formData.date,
        hours_worked: parseFloat(formData.hours),
        paid: isPaid,
        category: formData.category,
        notes: formData.notes || null,
        reflection: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('shifts').insert([newShift])

      if (error) throw error

      addShift(newShift)
      toast.showToast({ type: 'success', message: 'Shift logged successfully!' })

      // Reset form
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        hours: '',
        category: 'General',
        notes: '',
        paidStatus: 'auto',
      })
    } catch (error: any) {
      toast.showToast({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Log Hours</h1>

        <div className="card space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="input-base w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hours Worked
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  className="input-base w-full"
                  placeholder="e.g., 8"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Paid Status
              </label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 border-2 border-transparent rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  style={{
                    borderColor: formData.paidStatus === 'auto' ? '#0ea5e9' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="paidStatus"
                    value="auto"
                    checked={formData.paidStatus === 'auto'}
                    onChange={(e) => setFormData({ ...formData, paidStatus: e.target.value })}
                  />
                  <div>
                    <p className="font-medium">Auto-Calculate</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Based on school hours per week ({settings?.school_hours_per_week || 20}h)
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border-2 border-transparent rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  style={{
                    borderColor: formData.paidStatus === 'paid' ? '#22c55e' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="paidStatus"
                    value="paid"
                    checked={formData.paidStatus === 'paid'}
                    onChange={(e) => setFormData({ ...formData, paidStatus: e.target.value })}
                  />
                  <div>
                    <p className="font-medium">Mark as Paid</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Override - count towards earnings
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border-2 border-transparent rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  style={{
                    borderColor: formData.paidStatus === 'unpaid' ? '#f59e0b' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="paidStatus"
                    value="unpaid"
                    checked={formData.paidStatus === 'unpaid'}
                    onChange={(e) => setFormData({ ...formData, paidStatus: e.target.value })}
                  />
                  <div>
                    <p className="font-medium">Mark as Unpaid</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Override - counts towards school hours
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input-base w-full h-24 resize-none"
                placeholder="Add any notes about this shift..."
              ></textarea>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Saving...' : '✓ Log Hours'}
            </button>
          </form>
        </div>

        {/* Quick Templates */}
        <div className="card">
          <h2 className="text-lg font-bold mb-4">Quick Templates</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[2, 4, 6, 8].map((hours) => (
              <button
                key={hours}
                onClick={() => setFormData({ ...formData, hours: hours.toString() })}
                className="p-3 bg-gray-100 dark:bg-gray-800 hover:bg-primary-100 dark:hover:bg-primary-900/20 rounded-lg font-medium transition-colors"
              >
                {hours}h
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
