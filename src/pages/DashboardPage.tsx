import React from 'react'
import { Layout } from '@/components/Layout'
import { useShiftStore, useSettingsStore, useAuthStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/common/UI'
import { Modal } from '@/components/common/UI'
import { getShiftsForWeek, calculateWeeklyStats, formatCurrency, formatHoursMinutes, hoursToParts, partsToHours } from '@/lib/calculations'
import { startOfWeek, format, addDays, isSameDay, parseISO } from 'date-fns'
import { StatCard } from '@/components/common/StatCard'
import { ShiftListItem } from '@/components/shifts/ShiftListItem'
import { DurationInput } from '@/components/shifts/DurationInput'
import { useLocation, useNavigate } from 'react-router-dom'
import { defaultCategories } from '@/lib/reflections'
import { useTranslation } from '@/lib/i18n'

export const DashboardPage: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { shifts, setShifts, setLoading, updateShift, deleteShift } = useShiftStore()
  const { settings } = useSettingsStore()
  const toast = useToast()
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false)
  const [editingShift, setEditingShift] = React.useState<any | null>(null)
  const [editSaving, setEditSaving] = React.useState(false)
  const [editForm, setEditForm] = React.useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    hours: 0,
    minutes: 0,
    category: 'General',
    paidStatus: 'unpaid' as 'paid' | 'unpaid',
    notes: '',
  })
  const [selectedDate] = React.useState<Date>(new Date())
  const { t } = useTranslation()

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
      toast.showToast({ type: 'error', message: t('dashboard.loadFailed') })
    } finally {
      setLoading(false)
    }
  }

  const thisWeekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekShifts = getShiftsForWeek(shifts, selectedDate)
  const schoolHours = settings?.school_hours_per_week || 20
  const useSchoolHoursMode = settings?.use_school_hours_mode ?? true
  const categories = settings?.custom_categories?.length ? settings.custom_categories : defaultCategories
  const stats = calculateWeeklyStats(weekShifts, schoolHours)

  const todayShifts = shifts.filter((s) =>
    isSameDay(parseISO(s.date), new Date())
  )

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(thisWeekStart, i))

  const openEditModal = (shift: any) => {
    const parts = hoursToParts(shift.hours_worked)
    setEditingShift(shift)
    setEditForm({
      date: shift.date,
      hours: parts.hours,
      minutes: parts.minutes,
      category: shift.category || 'General',
      paidStatus: shift.paid ? 'paid' : 'unpaid',
      notes: shift.notes || '',
    })
    setIsEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingShift || !user) return

    const workedHours = partsToHours(editForm.hours, editForm.minutes)
    if (workedHours <= 0) {
      toast.showToast({ type: 'warning', message: t('dashboard.durationTooShort') })
      return
    }

    setEditSaving(true)
    try {
      const paidValue = editForm.paidStatus === 'paid'

      const payload = {
        date: editForm.date,
        hours_worked: workedHours,
        category: editForm.category,
        paid: paidValue,
        notes: editForm.notes || null,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('shifts')
        .update(payload)
        .eq('id', editingShift.id)
        .eq('user_id', user.id)
        .select('*')
        .single()

      if (error) throw error

      updateShift(editingShift.id, data)
      toast.showToast({ type: 'success', message: t('dashboard.updateSuccess') })
      setIsEditModalOpen(false)
      setEditingShift(null)
    } catch (error: any) {
      toast.showToast({ type: 'error', message: error.message || t('dashboard.updateFailed') })
    } finally {
      setEditSaving(false)
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

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('layout.dashboard')}</h1>
          <button
            onClick={() => {
              const params = new URLSearchParams(location.search)
              params.set('log', 'true')
              navigate(`${location.pathname}?${params.toString()}`)
            }}
            className="btn-primary"
          >
            ➕ {t('dashboard.logHours')}
          </button>
        </div>

        {/* This Week Summary */}
        <div className={`grid grid-cols-1 ${useSchoolHoursMode ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
          <StatCard label={t('dashboard.totalHours')} value={formatHoursMinutes(stats.totalHours)} valueClassName="text-gray-900 dark:text-white" />
          <StatCard label={t('dashboard.paidHours')} value={formatHoursMinutes(stats.paidHours)} valueClassName="text-success-600 dark:text-success-400" />
          {useSchoolHoursMode && (
            <StatCard label={t('dashboard.unpaidHours')} value={formatHoursMinutes(stats.unpaidHours)} valueClassName="text-warning-600 dark:text-warning-400" />
          )}
          <StatCard
            label={t('dashboard.earnings')}
            value={formatCurrency(stats.paidHours * (settings?.hourly_rate || 120), settings?.currency || 'NOK')}
            valueClassName="text-primary-600 dark:text-primary-400"
          />
        </div>

        {/* School Hours Tracker */}
        {useSchoolHoursMode && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">{t('dashboard.schoolHoursThisWeek')}</h2>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">
                    {formatHoursMinutes(stats.unpaidHours)} / {formatHoursMinutes(schoolHours)} {t('dashboard.used')}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {formatHoursMinutes(stats.schoolHoursRemaining)} {t('dashboard.remaining')}
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
        )}

        {/* Today's Summary */}
        {todayShifts.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-bold mb-4">{t('dashboard.todaysShifts')}</h2>
            <div className="space-y-2">
              {todayShifts.map((shift) => (
                <ShiftListItem
                  key={shift.id}
                  shift={shift}
                  showDate={false}
                  onEdit={() => openEditModal(shift)}
                  onDelete={() => handleDeleteShift(shift.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Week Overview Calendar */}
        <div className="card">
          <h2 className="text-lg font-bold mb-4">{t('dashboard.weekOverview')}</h2>
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
                  <p className="text-sm font-bold mt-1">{formatHoursMinutes(dayTotal)}</p>
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
          <h2 className="text-lg font-bold mb-4">{t('dashboard.recentShifts')}</h2>
          <div className="space-y-2">
            {shifts.slice(0, 5).map((shift) => (
              <ShiftListItem
                key={shift.id}
                shift={shift}
                onEdit={() => openEditModal(shift)}
                onDelete={() => handleDeleteShift(shift.id)}
              />
            ))}
          </div>
        </div>
      </div>
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingShift(null)
        }}
        title={t('dashboard.editLoggedHours')}
        footer={
          <div className="flex gap-2">
            <button onClick={handleSaveEdit} className="btn-primary flex-1" disabled={editSaving}>
              {editSaving ? t('common.saving') : t('common.save')}
            </button>
            <button
              onClick={() => {
                setIsEditModalOpen(false)
                setEditingShift(null)
              }}
              className="btn-secondary flex-1"
            >
              {t('common.cancel')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('dashboard.date')}</label>
            <input
              type="date"
              value={editForm.date}
              onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              className="input-base w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('dashboard.duration')}</label>
            <DurationInput
              hours={editForm.hours}
              minutes={editForm.minutes}
              onHoursChange={(hours) => setEditForm({ ...editForm, hours })}
              onMinutesChange={(minutes) => setEditForm({ ...editForm, minutes })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('dashboard.category')}</label>
            <select
              value={editForm.category}
              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              className="input-base w-full"
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('dashboard.paidStatus')}</label>
            <select
              value={editForm.paidStatus}
              onChange={(e) =>
                setEditForm({ ...editForm, paidStatus: e.target.value as 'paid' | 'unpaid' })
              }
              className="input-base w-full"
            >
              <option value="paid">{t('dashboard.paidStatusPaid')}</option>
              <option value="unpaid">{t('dashboard.paidStatusUnpaid')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('dashboard.notes')}</label>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              className="input-base w-full h-24 resize-none"
            />
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
