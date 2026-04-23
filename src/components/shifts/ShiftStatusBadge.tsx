import React from 'react'

type ShiftStatus = boolean | null

interface ShiftStatusBadgeProps {
  paid: ShiftStatus
}

export const ShiftStatusBadge: React.FC<ShiftStatusBadgeProps> = ({ paid }) => {
  const className =
    paid
      ? 'badge-success'
      : 'badge-warning'

  const label = paid ? 'Paid' : 'Unpaid'

  return <span className={`badge ${className}`}>{label}</span>
}
