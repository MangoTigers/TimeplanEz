import React from 'react'
import { format, parseISO } from 'date-fns'
import { formatHoursMinutes, formatWeekLabel } from '@/lib/calculations'
import { ShiftStatusBadge } from './ShiftStatusBadge'
import { useTranslation } from '@/lib/i18n'

interface ShiftListItemProps {
  shift: {
    id: string
    date: string
    hours_worked: number
    paid: boolean | null
    category?: string
  }
  showDate?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export const ShiftListItem: React.FC<ShiftListItemProps> = ({ shift, showDate = true, onEdit, onDelete }) => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div>
        <p className="font-medium">
          {showDate ? format(parseISO(shift.date), 'MMM dd, yyyy') : formatHoursMinutes(shift.hours_worked)}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {showDate
            ? `${formatHoursMinutes(shift.hours_worked)} • ${formatWeekLabel(shift.date)} • ${shift.category || t('common.general')}`
            : shift.category || t('common.general')}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <ShiftStatusBadge paid={shift.paid} />
        {onEdit && (
          <button onClick={onEdit} className="btn-secondary px-3 py-1 text-xs">
            {t('common.edit')}
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="btn-danger px-3 py-1 text-xs">
            {t('common.delete')}
          </button>
        )}
      </div>
    </div>
  )
}
