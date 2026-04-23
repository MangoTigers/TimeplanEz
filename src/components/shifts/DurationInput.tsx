import React from 'react'

interface DurationInputProps {
  hours: number
  minutes: number
  onHoursChange: (hours: number) => void
  onMinutesChange: (minutes: number) => void
  maxHours?: number
}

export const DurationInput: React.FC<DurationInputProps> = ({
  hours,
  minutes,
  onHoursChange,
  onMinutesChange,
  maxHours = 24,
}) => {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        max={maxHours}
        value={hours}
        onChange={(e) => {
          const parsed = Number.parseInt(e.target.value, 10)
          onHoursChange(Number.isNaN(parsed) ? 0 : parsed)
        }}
        className="input-base w-24"
        placeholder="0"
      />
      <span className="text-sm text-gray-600 dark:text-gray-400">h</span>

      <input
        type="number"
        min="0"
        max="59"
        step="5"
        value={minutes}
        onChange={(e) => {
          const parsed = Number.parseInt(e.target.value, 10)
          const clamped = Math.max(0, Math.min(59, Number.isNaN(parsed) ? 0 : parsed))
          onMinutesChange(clamped)
        }}
        className="input-base w-24"
        placeholder="0"
      />
      <span className="text-sm text-gray-600 dark:text-gray-400">m</span>
    </div>
  )
}
