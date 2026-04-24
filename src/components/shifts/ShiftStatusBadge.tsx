import React from 'react'
import { useTranslation } from '@/lib/i18n'

type ShiftStatus = boolean | null

interface ShiftStatusBadgeProps {
  paid: ShiftStatus
}

export const ShiftStatusBadge: React.FC<ShiftStatusBadgeProps> = ({ paid }) => {
  const { t } = useTranslation()

  const className =
    paid
      ? 'badge-success'
      : 'badge-warning'

  const label = paid ? t('common.paid') : t('common.unpaid')

  return <span className={`badge ${className}`}>{label}</span>
}
