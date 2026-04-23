export type ReflectionFieldType = 'text' | 'textarea' | 'checkbox' | 'number' | 'select'

export interface ReflectionFieldConfig {
  id: string
  label: string
  type: ReflectionFieldType
  placeholder?: string
  helpText?: string
  required?: boolean
  options?: string[]
}

export type ReflectionValue = string | boolean
export type ReflectionValues = Record<string, ReflectionValue>

export interface ReflectionData {
  values: ReflectionValues
}

export const defaultReflectionFields: ReflectionFieldConfig[] = [
  {
    id: 'taskCompleted',
    label: 'Task Completed',
    type: 'textarea',
    placeholder: 'What tasks did you complete?',
  },
  {
    id: 'howItWent',
    label: 'How It Went',
    type: 'textarea',
    placeholder: 'How did the shift go?',
  },
  {
    id: 'completedPlannedWork',
    label: 'Completed Planned Work',
    type: 'checkbox',
  },
  {
    id: 'neededHelp',
    label: 'Needed Help',
    type: 'checkbox',
  },
  {
    id: 'learnedSomething',
    label: 'Learned Something',
    type: 'checkbox',
  },
]

export const defaultReflectionChecklist = {
  completedPlannedWork: false,
  neededHelp: false,
  learnedSomething: false,
}

export function createReflectionFieldId(label: string, existingIds: string[] = []): string {
  const base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const safeBase = base || 'field'
  let candidate = safeBase
  let counter = 2

  while (existingIds.includes(candidate)) {
    candidate = `${safeBase}-${counter}`
    counter += 1
  }

  return candidate
}

export function normalizeReflectionFields(fields?: ReflectionFieldConfig[] | null): ReflectionFieldConfig[] {
  const source = fields?.length ? fields : defaultReflectionFields
  const seenIds = new Set<string>()

  return source.map((field, index) => {
    const label = (field.label || `Field ${index + 1}`).trim()
    const type: ReflectionFieldType = ['text', 'textarea', 'checkbox', 'number', 'select'].includes(field.type)
      ? field.type
      : 'text'
    const rawId = (field.id || '').trim()
    const id = rawId && !seenIds.has(rawId) ? rawId : createReflectionFieldId(label, Array.from(seenIds))
    seenIds.add(id)

    return {
      id,
      label,
      type,
      placeholder: field.placeholder || '',
      helpText: field.helpText || '',
      required: Boolean(field.required),
      options: type === 'select' ? (field.options || []).filter(Boolean) : undefined,
    }
  })
}

export function createDefaultReflectionValues(fields: ReflectionFieldConfig[] = defaultReflectionFields): ReflectionValues {
  return fields.reduce((values, field) => {
    values[field.id] = field.type === 'checkbox' ? false : ''
    return values
  }, {} as ReflectionValues)
}

export const defaultReflectionData: ReflectionData = {
  values: createDefaultReflectionValues(),
}

function normalizeFieldValue(field: ReflectionFieldConfig, value: unknown): ReflectionValue {
  if (field.type === 'checkbox') {
    return Boolean(value)
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : ''
  }

  return ''
}

function looksLikeLegacyReflection(parsed: any): boolean {
  return Boolean(parsed && typeof parsed === 'object' && ('taskCompleted' in parsed || 'howItWent' in parsed || 'checklist' in parsed))
}

function getFirstTextFieldId(fields: ReflectionFieldConfig[]): string | null {
  return fields.find((field) => field.type === 'text' || field.type === 'textarea')?.id ?? null
}

function mapLegacyReflection(parsed: any, fields: ReflectionFieldConfig[]): ReflectionValues {
  const values = createDefaultReflectionValues(fields)
  const fieldById = new Map(fields.map((field) => [field.id, field]))
  const textFieldIds = fields.filter((field) => field.type === 'text' || field.type === 'textarea').map((field) => field.id)

  if (typeof parsed?.taskCompleted === 'string') {
    const targetId = fieldById.has('taskCompleted') ? 'taskCompleted' : textFieldIds[0]
    if (targetId) values[targetId] = parsed.taskCompleted
  }

  if (typeof parsed?.howItWent === 'string') {
    const targetId = fieldById.has('howItWent') ? 'howItWent' : textFieldIds[1] || textFieldIds[0]
    if (targetId) values[targetId] = parsed.howItWent
  }

  if (parsed?.checklist && typeof parsed.checklist === 'object') {
    const checklistMapping: Record<string, string> = {
      completedPlannedWork: 'completedPlannedWork',
      neededHelp: 'neededHelp',
      learnedSomething: 'learnedSomething',
    }

    Object.entries(checklistMapping).forEach(([legacyKey, fieldId]) => {
      if (fieldById.has(fieldId)) {
        values[fieldId] = Boolean(parsed.checklist[legacyKey])
      }
    })
  }

  if (typeof parsed?.reflection === 'string' && textFieldIds[0]) {
    values[textFieldIds[0]] = parsed.reflection
  }

  return values
}

function coerceParsedValues(parsed: any, fields: ReflectionFieldConfig[]): ReflectionValues {
  const defaults = createDefaultReflectionValues(fields)
  const sourceValues = parsed?.values && typeof parsed.values === 'object' ? parsed.values : parsed?.fields && typeof parsed.fields === 'object' ? parsed.fields : null

  if (!sourceValues) {
    return defaults
  }

  const values = { ...defaults }
  fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(sourceValues, field.id)) {
      values[field.id] = normalizeFieldValue(field, sourceValues[field.id])
    }
  })

  return values
}

export function parseReflection(raw: string | null, fields: ReflectionFieldConfig[] = defaultReflectionFields): ReflectionData {
  const normalizedFields = normalizeReflectionFields(fields)

  if (!raw) {
    return { values: createDefaultReflectionValues(normalizedFields) }
  }

  try {
    const parsed = JSON.parse(raw)

    if (looksLikeLegacyReflection(parsed)) {
      return { values: mapLegacyReflection(parsed, normalizedFields) }
    }

    return { values: coerceParsedValues(parsed, normalizedFields) }
  } catch {
    const values = createDefaultReflectionValues(normalizedFields)
    const firstTextFieldId = getFirstTextFieldId(normalizedFields)
    if (firstTextFieldId) {
      values[firstTextFieldId] = raw
    }
    return { values }
  }
}

export function serializeReflection(reflection: ReflectionData): string {
  return JSON.stringify({ version: 2, values: reflection.values })
}

export function hasReflectionContent(reflection: ReflectionData, fields: ReflectionFieldConfig[] = defaultReflectionFields): boolean {
  const normalizedFields = normalizeReflectionFields(fields)

  return normalizedFields.some((field) => {
    const value = reflection.values[field.id]

    if (field.type === 'checkbox') {
      return Boolean(value)
    }

    return typeof value === 'string' ? Boolean(value.trim()) : Boolean(value)
  })
}

export function getReflectionFieldValue(reflection: ReflectionData, fieldId: string): ReflectionValue {
  return reflection.values[fieldId] ?? ''
}

export function formatReflectionFieldValue(field: ReflectionFieldConfig, value: ReflectionValue | undefined): string {
  if (field.type === 'checkbox') {
    return value ? 'Yes' : 'No'
  }

  return typeof value === 'string' ? value : value ? String(value) : ''
}

export const defaultCategories = ['General', 'Tutoring', 'Event', 'Administration', 'Other']
