import React from 'react'

interface StatCardProps {
  label: string
  value: string
  valueClassName?: string
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, valueClassName = '' }) => {
  return (
    <div className="card">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueClassName}`.trim()}>{value}</p>
    </div>
  )
}
