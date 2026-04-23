import React from 'react'
import { Layout } from '@/components/Layout'
import { useShiftStore, useSettingsStore, useAuthStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/common/UI'
import { Modal } from '@/components/common/UI'
import { formatHoursMinutes } from '@/lib/calculations'
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

export const AnalyticsPage: React.FC = () => {
  const { user } = useAuthStore()
  const { shifts, setShifts } = useShiftStore()
  const { settings } = useSettingsStore()
  const toast = useToast()
  const [selectedMonth, setSelectedMonth] = React.useState(new Date())
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false)

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
      toast.showToast({ type: 'error', message: 'Failed to load shifts' })
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
        const category = shift.category || 'General'
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

  const handleExportCSV = () => {
    const headers = ['Date', 'Hours', 'Status', 'Category', 'Notes']
    const rows = monthShifts.map((shift) => [
      format(parseISO(shift.date), 'yyyy-MM-dd'),
      shift.hours_worked,
      shift.paid ? 'Paid' : 'Unpaid',
      shift.category || '-',
      shift.notes || '',
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) => (typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell))
          .join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `timeplanez-${format(selectedMonth, 'yyyy-MM')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.showToast({ type: 'success', message: 'Export successful!' })
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <button onClick={() => setIsExportModalOpen(true)} className="btn-secondary">
            📥 Export Data
          </button>
        </div>

        {/* Month Selector */}
        <div className="card">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
              className="btn-secondary"
            >
              ← Previous
            </button>
            <h2 className="text-xl font-bold">{format(selectedMonth, 'MMMM yyyy')}</h2>
            <button
              onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
              className="btn-secondary"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Total Hours" value={formatHoursMinutes(totalHours)} />
          <StatCard label="Paid Hours" value={formatHoursMinutes(totalPaidHours)} valueClassName="text-success-600 dark:text-success-400" />
          <StatCard label="Unpaid Hours" value={formatHoursMinutes(totalUnpaidHours)} valueClassName="text-warning-600 dark:text-warning-400" />
          <StatCard label="Total Earnings" value={`${settings?.currency} ${totalEarnings.toFixed(0)}`} valueClassName="text-primary-600 dark:text-primary-400" />
        </div>

        {/* Daily Hours Chart */}
        {dailyData.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">Daily Hours Overview</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="paid" fill="#22c55e" name="Paid" />
                <Bar dataKey="unpaid" fill="#eab308" name="Unpaid" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Hourly Trend Chart */}
        {dailyData.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">Hours Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="hours" stroke="#0ea5e9" name="Total Hours" />
                <Line type="monotone" dataKey="paid" stroke="#22c55e" name="Paid Hours" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category Breakdown */}
        {categoryData.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">Hours by Category</h2>
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
          </div>
        )}

        {/* Weekly Summary Table */}
        {monthShifts.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">Shifts This Month</h2>
            <ShiftTable
              shifts={monthShifts}
              currency={settings?.currency || 'NOK'}
              hourlyRate={settings?.hourly_rate || 120}
            />
          </div>
        )}
      </div>

      {/* Export Modal */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export Data"
        footer={
          <div className="flex gap-2">
            <button onClick={handleExportCSV} className="btn-primary flex-1">
              📥 Download CSV
            </button>
            <button onClick={() => setIsExportModalOpen(false)} className="btn-secondary flex-1">
              Cancel
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p>Export your data for {format(selectedMonth, 'MMMM yyyy')}</p>
          <div className="bg-primary-50 dark:bg-primary-900/20 p-3 rounded-lg text-sm text-primary-900 dark:text-primary-200">
            The CSV file will include all shifts, hours, paid/unpaid status, and categories for easy analysis.
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
