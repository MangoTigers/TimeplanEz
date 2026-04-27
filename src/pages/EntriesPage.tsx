import React from 'react'
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns'
import { Layout } from '@/components/Layout'
import { ExpandableCard } from '@/components/common/ExpandableCard'
import { ShiftListItem } from '@/components/shifts/ShiftListItem'
import { StatCard } from '@/components/common/StatCard'
import { useAuthStore, useShiftStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/common/UI'
import { formatHoursMinutes } from '@/lib/calculations'
import { useTranslation } from '@/lib/i18n'

type EntryFilter = 'day' | 'week' | 'month'

export const EntriesPage: React.FC = () => {
  const { user } = useAuthStore()
  const { shifts, setShifts } = useShiftStore()
  const toast = useToast()
  const { t } = useTranslation()
  const [filterMode, setFilterMode] = React.useState<EntryFilter>('week')
  const [anchorDate, setAnchorDate] = React.useState(format(new Date(), 'yyyy-MM-dd'))

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
    } catch {
      toast.showToast({ type: 'error', message: t('dashboard.loadFailed') })
    }
  }

  const filteredShifts = React.useMemo(() => {
    const selectedDate = parseISO(anchorDate)
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })

    return shifts
      .filter((shift) => {
        const shiftDate = parseISO(shift.date)

        if (filterMode === 'day') {
          return shift.date === anchorDate
        }

        if (filterMode === 'week') {
          return shiftDate >= weekStart && shiftDate <= weekEnd
        }

        return (
          shiftDate.getFullYear() === selectedDate.getFullYear() &&
          shiftDate.getMonth() === selectedDate.getMonth()
        )
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [anchorDate, filterMode, shifts])

  const totalHours = filteredShifts.reduce((sum, shift) => sum + shift.hours_worked, 0)
  const paidHours = filteredShifts.filter((shift) => shift.paid).reduce((sum, shift) => sum + shift.hours_worked, 0)
  const unpaidHours = Math.max(0, totalHours - paidHours)

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('entries.pageTitle')}</h1>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as EntryFilter)}
              className="input-base"
            >
              <option value="day">{t('entries.filterDay')}</option>
              <option value="week">{t('entries.filterWeek')}</option>
              <option value="month">{t('entries.filterMonth')}</option>
            </select>

            <input
              type="date"
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
              className="input-base"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard label={t('dashboard.totalHours')} value={formatHoursMinutes(totalHours)} />
          <StatCard label={t('dashboard.paidHours')} value={formatHoursMinutes(paidHours)} valueClassName="text-success-600 dark:text-success-400" />
          <StatCard label={t('dashboard.unpaidHours')} value={formatHoursMinutes(unpaidHours)} valueClassName="text-warning-600 dark:text-warning-400" />
        </div>

        <ExpandableCard title={t('entries.allEntries')} collapsedMaxHeight={420}>
          {filteredShifts.length ? (
            <div className="space-y-2">
              {filteredShifts.map((shift) => (
                <ShiftListItem key={shift.id} shift={shift} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('entries.noEntries')}</p>
          )}
        </ExpandableCard>
      </div>
    </Layout>
  )
}
