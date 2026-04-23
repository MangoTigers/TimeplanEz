import React from 'react'
import { Layout } from '@/components/Layout'
import { useShiftStore, useSettingsStore, useAuthStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/common/UI'
import { Modal } from '@/components/common/UI'
import { getShiftsForWeek, calculateWeeklyStats, formatCurrency } from '@/lib/calculations'
import { startOfWeek, format, addDays, isSameDay, parseISO } from 'date-fns'

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore()
  const { shifts, setShifts, setLoading } = useShiftStore()
  const { settings } = useSettingsStore()
  const toast = useToast()
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
  const [selectedDate] = React.useState<Date>(new Date())

  React.useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    if (!user) return
    setLoading(true)

    try {
      // Load shifts
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (shiftsError) throw shiftsError
      setShifts(shiftsData || [])

    } catch (error: any) {
      toast.showToast({ type: 'error', message: 'Failed to load data' })
    } finally {
      setLoading(false)
    }
  }

  const thisWeekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekShifts = getShiftsForWeek(shifts, selectedDate)
  const schoolHours = settings?.school_hours_per_week || 20
  const stats = calculateWeeklyStats(weekShifts, schoolHours)

  const todayShifts = shifts.filter((s) =>
    isSameDay(parseISO(s.date), new Date())
  )

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(thisWeekStart, i))

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary"
          >
            ➕ Log Hours
          </button>
        </div>

        {/* This Week Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Hours</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.totalHours.toFixed(1)}h
            </p>
          </div>

          <div className="card">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Paid Hours</p>
            <p className="text-3xl font-bold text-success-600 dark:text-success-400">
              {stats.paidHours.toFixed(1)}h
            </p>
          </div>

          <div className="card">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Unpaid Hours</p>
            <p className="text-3xl font-bold text-warning-600 dark:text-warning-400">
              {stats.unpaidHours.toFixed(1)}h
            </p>
          </div>

          <div className="card">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Earnings
            </p>
            <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {formatCurrency(
                stats.paidHours * (settings?.hourly_rate || 120),
                settings?.currency || 'NOK'
              )}
            </p>
          </div>
        </div>

        {/* School Hours Tracker */}
        <div className="card">
          <h2 className="text-lg font-bold mb-4">School Hours This Week</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">{stats.unpaidHours.toFixed(1)} / {schoolHours} hours used</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {stats.schoolHoursRemaining.toFixed(1)} remaining
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-primary-500 to-primary-600 h-full transition-all duration-300"
                  style={{
                    width: `${Math.min((stats.unpaidHours / schoolHours) * 100, 100)}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Summary */}
        {todayShifts.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">Today's Shifts</h2>
            <div className="space-y-2">
              {todayShifts.map((shift) => (
                <div key={shift.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="font-medium">{shift.hours_worked} hours</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{shift.category || 'General'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${shift.paid ? 'badge-success' : 'badge-warning'}`}>
                      {shift.paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Week Overview Calendar */}
        <div className="card">
          <h2 className="text-lg font-bold mb-4">Week Overview</h2>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((date) => {
              const dayShifts = shifts.filter((s) => isSameDay(parseISO(s.date), date))
              const dayTotal = dayShifts.reduce((sum, s) => sum + s.hours_worked, 0)

              return (
                <div
                  key={date.toString()}
                  className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {format(date, 'EEE')}
                  </p>
                  <p className="text-sm font-bold mt-1">{dayTotal.toFixed(1)}h</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {format(date, 'dd')}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Shifts */}
        <div className="card">
          <h2 className="text-lg font-bold mb-4">Recent Shifts</h2>
          <div className="space-y-2">
            {shifts.slice(0, 5).map((shift) => (
              <div key={shift.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium">{format(parseISO(shift.date), 'MMM dd, yyyy')}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {shift.hours_worked} hours • {shift.category || 'General'}
                  </p>
                </div>
                <span className={`badge ${shift.paid === null ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' : shift.paid ? 'badge-success' : 'badge-warning'}`}>
                  {shift.paid === null ? 'Auto' : shift.paid ? 'Paid' : 'Unpaid'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Shift Modal - placeholder for now */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Log Hours">
        <p className="text-gray-600 dark:text-gray-400">Quick add feature - navigate to Log Hours page for full form</p>
        <div className="mt-4 flex gap-2">
          <a href="/log-hours" className="btn-primary flex-1 text-center">
            Go to Log Hours
          </a>
          <button onClick={() => setIsAddModalOpen(false)} className="btn-secondary flex-1">
            Cancel
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
