import React from 'react'
import { format, parseISO } from 'date-fns'
import { formatHoursMinutes } from '@/lib/calculations'
import { ShiftStatusBadge } from './ShiftStatusBadge'

interface ShiftRecord {
  id: string
  date: string
  hours_worked: number
  paid: boolean | null
  category?: string
}

interface ShiftTableProps {
  shifts: ShiftRecord[]
  currency: string
  hourlyRate: number
  maxRows?: number
  onDeleteShift?: (shiftId: string) => void
}

export const ShiftTable: React.FC<ShiftTableProps> = ({
  shifts,
  currency,
  hourlyRate,
  maxRows = 20,
  onDeleteShift,
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Date</th>
            <th className="text-left px-4 py-3 font-medium">Hours</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="text-left px-4 py-3 font-medium">Category</th>
            <th className="text-right px-4 py-3 font-medium">Earnings</th>
            {onDeleteShift && <th className="text-right px-4 py-3 font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {shifts.slice(0, maxRows).map((shift) => (
            <tr key={shift.id}>
              <td className="px-4 py-3">{format(parseISO(shift.date), 'MMM dd')}</td>
              <td className="px-4 py-3">{formatHoursMinutes(shift.hours_worked)}</td>
              <td className="px-4 py-3">
                <ShiftStatusBadge paid={shift.paid} />
              </td>
              <td className="px-4 py-3">{shift.category || '-'}</td>
              <td className="px-4 py-3 text-right">
                {shift.paid ? `${currency} ${(shift.hours_worked * hourlyRate).toFixed(0)}` : '-'}
              </td>
              {onDeleteShift && (
                <td className="px-4 py-3 text-right">
                  <button onClick={() => onDeleteShift(shift.id)} className="btn-danger px-3 py-1 text-xs">
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
