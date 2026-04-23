export interface ReflectionChecklist {
  completedPlannedWork: boolean
  neededHelp: boolean
  learnedSomething: boolean
}

export interface ReflectionData {
  taskCompleted: string
  howItWent: string
  checklist: ReflectionChecklist
}

export const defaultReflectionChecklist: ReflectionChecklist = {
  completedPlannedWork: false,
  neededHelp: false,
  learnedSomething: false,
}

export const defaultReflectionData: ReflectionData = {
  taskCompleted: '',
  howItWent: '',
  checklist: { ...defaultReflectionChecklist },
}

export const defaultCategories = ['General', 'Tutoring', 'Event', 'Administration', 'Other']

export function hasReflectionContent(reflection: ReflectionData): boolean {
  return (
    Boolean(reflection.taskCompleted.trim()) ||
    Boolean(reflection.howItWent.trim()) ||
    Object.values(reflection.checklist).some(Boolean)
  )
}

export function serializeReflection(reflection: ReflectionData): string {
  return JSON.stringify(reflection)
}

export function parseReflection(raw: string | null): ReflectionData {
  if (!raw) {
    return { ...defaultReflectionData, checklist: { ...defaultReflectionChecklist } }
  }

  try {
    const parsed = JSON.parse(raw)
    return {
      taskCompleted: typeof parsed?.taskCompleted === 'string' ? parsed.taskCompleted : '',
      howItWent: typeof parsed?.howItWent === 'string' ? parsed.howItWent : raw,
      checklist: {
        completedPlannedWork: Boolean(parsed?.checklist?.completedPlannedWork),
        neededHelp: Boolean(parsed?.checklist?.neededHelp),
        learnedSomething: Boolean(parsed?.checklist?.learnedSomething),
      },
    }
  } catch {
    return {
      taskCompleted: '',
      howItWent: raw,
      checklist: { ...defaultReflectionChecklist },
    }
  }
}
