import React from 'react'

type ShiftStatus = boolean | null

interface ShiftStatusBadgeProps {
  paid: ShiftStatus
}

export const ShiftStatusBadge: React.FC<ShiftStatusBadgeProps> = ({ paid }) => {
  const className =
    paid === null
      ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
      : paid
        ? 'badge-success'
        : 'badge-warning'

  const label = paid === null ? 'Auto' : paid ? 'Paid' : 'Unpaid'

  return <span className={`badge ${className}`}>{label}</span>
}
