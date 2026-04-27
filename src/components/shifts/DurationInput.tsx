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
  const [hoursInput, setHoursInput] = React.useState(String(hours))
  const [minutesInput, setMinutesInput] = React.useState(String(minutes))
  const [isHoursFocused, setIsHoursFocused] = React.useState(false)
  const [isMinutesFocused, setIsMinutesFocused] = React.useState(false)

  React.useEffect(() => {
    if (!isHoursFocused) {
      setHoursInput(String(hours))
    }
  }, [hours, isHoursFocused])

  React.useEffect(() => {
    if (!isMinutesFocused) {
      setMinutesInput(String(minutes))
    }
  }, [minutes, isMinutesFocused])

  const handleHoursChange = (rawValue: string) => {
    setHoursInput(rawValue)
    if (rawValue === '') {
      return
    }

    const parsed = Number.parseInt(rawValue, 10)
    if (Number.isNaN(parsed)) {
      return
    }

    const clamped = Math.max(0, Math.min(maxHours, parsed))
    onHoursChange(clamped)
  }

  const handleMinutesChange = (rawValue: string) => {
    setMinutesInput(rawValue)
    if (rawValue === '') {
      return
    }

    const parsed = Number.parseInt(rawValue, 10)
    if (Number.isNaN(parsed)) {
      return
    }

    const clamped = Math.max(0, Math.min(59, parsed))
    onMinutesChange(clamped)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        max={maxHours}
        value={hoursInput}
        onFocus={() => setIsHoursFocused(true)}
        onBlur={() => {
          setIsHoursFocused(false)
          if (hoursInput === '') {
            onHoursChange(0)
            return
          }

          const parsed = Number.parseInt(hoursInput, 10)
          const clamped = Math.max(0, Math.min(maxHours, Number.isNaN(parsed) ? 0 : parsed))
          onHoursChange(clamped)
          setHoursInput(String(clamped))
        }}
        onChange={(e) => handleHoursChange(e.target.value)}
        className="input-base w-24"
        placeholder="0"
      />
      <span className="text-sm text-gray-600 dark:text-gray-400">h</span>

      <input
        type="number"
        min="0"
        max="59"
        step="5"
        value={minutesInput}
        onFocus={() => setIsMinutesFocused(true)}
        onBlur={() => {
          setIsMinutesFocused(false)
          if (minutesInput === '') {
            onMinutesChange(0)
            return
          }

          const parsed = Number.parseInt(minutesInput, 10)
          const clamped = Math.max(0, Math.min(59, Number.isNaN(parsed) ? 0 : parsed))
          onMinutesChange(clamped)
          setMinutesInput(String(clamped))
        }}
        onChange={(e) => handleMinutesChange(e.target.value)}
        className="input-base w-24"
        placeholder="0"
      />
      <span className="text-sm text-gray-600 dark:text-gray-400">m</span>
    </div>
  )
}
