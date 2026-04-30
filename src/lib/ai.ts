import { supabase } from '@/lib/supabase'
import type { ReflectionFieldConfig } from '@/lib/reflections'
// pdfjs-dist updated entry point for modern bundlers
import pdfjsLib from 'pdfjs-dist/build/pdf'
// Optional: set workerSrc if your environment can't load the default worker automatically
// (pdfjsLib as any).GlobalWorkerOptions = (pdfjsLib as any).GlobalWorkerOptions || {};
// (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.worker.js`;

export interface ParsedShiftRow {
  date: string
  hours_worked: number
  paid: boolean | null
  category: string
  notes: string | null
  reflection: string | null
  enhanced_reflection: string | null
}

function extractJsonObject(text: string): any {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1))
    }
    throw new Error('Invalid JSON output from AI parser')
  }
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeRow(input: any): ParsedShiftRow | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const date = normalizeDate(input.date)
  if (!date) {
    return null
  }

  const rawHours = Number(input.hours_worked)
  if (!Number.isFinite(rawHours) || rawHours <= 0 || rawHours > 24) {
    return null
  }

  const hours_worked = Math.round(rawHours * 100) / 100
  const paid = typeof input.paid === 'boolean' ? input.paid : null

  const category = typeof input.category === 'string' && input.category.trim()
    ? input.category.trim().slice(0, 100)
    : 'General'

  const notes = typeof input.notes === 'string' && input.notes.trim()
    ? input.notes.trim().slice(0, 4000)
    : null

  const reflection = typeof input.reflection === 'string' && input.reflection.trim()
    ? input.reflection.trim().slice(0, 12000)
    : null

  const enhanced_reflection = typeof input.enhanced_reflection === 'string' && input.enhanced_reflection.trim()
    ? input.enhanced_reflection.trim().slice(0, 12000)
    : null

  return {
    date,
    hours_worked,
    paid,
    category,
    notes,
    reflection,
    enhanced_reflection,
  }
}

function readApiKeyFromPersistedSettings(): string | null {
  try {
    const raw = localStorage.getItem('settings-storage')
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    const key = parsed?.state?.settings?.openai_api_key
    return typeof key === 'string' && key.trim() ? key.trim() : null
  } catch {
    return null
  }
}

export async function getEffectiveOpenAiApiKey(explicitKey?: string | null): Promise<string | null> {
  const fromArgument = explicitKey?.trim()
  if (fromArgument) {
    return fromArgument
  }

  const fromLocal = readApiKeyFromPersistedSettings()
  if (fromLocal) {
    return fromLocal
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return null
    }

    const { data, error } = await supabase
      .from('users')
      .select('openai_api_key')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      return null
    }

    const dbKey = data?.openai_api_key
    return typeof dbKey === 'string' && dbKey.trim() ? dbKey.trim() : null
  } catch {
    return null
  }
}

async function callOpenAiResponses(apiKey: string, input: Array<any>) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI API failed (${response.status}): ${text}`)
  }

  return response.json()
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

async function uploadFileToOpenAi(apiKey: string, fileName: string, mimeType: string, fileBase64: string): Promise<string> {
  const formData = new FormData()
  const blob = base64ToBlob(fileBase64, mimeType)
  formData.append('file', blob, fileName)
  formData.append('purpose', 'assistants')

  const response = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI file upload failed (${response.status}): ${text}`)
  }

  const data: any = await response.json()
  const fileId = data?.id
  if (!fileId || typeof fileId !== 'string') {
    throw new Error('OpenAI file upload did not return a file id')
  }

  return fileId
}

export async function extractTextFromPdfBase64(base64: string): Promise<string> {
  try {
    const binary = atob(base64)
    const len = binary.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)

    const loadingTask = pdfjsLib.getDocument({ data: bytes })
    const pdf = await loadingTask.promise
    let fullText = ''
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p)
      const content = await page.getTextContent()
      const pageText = content.items.map((it: any) => ('str' in it ? it.str : '')).join(' ')
      fullText += pageText + '\n\n'
    }
    return fullText.trim()
  } catch (err) {
    return ''
  }
}

function extractOpenAiText(data: any): string {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim()
  }

  const output = Array.isArray(data?.output) ? data.output : []
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : []
    for (const part of content) {
      if (typeof part?.text === 'string' && part.text.trim()) {
        return part.text.trim()
      }
      if (typeof part?.output_text === 'string' && part.output_text.trim()) {
        return part.output_text.trim()
      }
    }
  }

  const choices = Array.isArray(data?.choices) ? data.choices : []
  for (const choice of choices) {
    const msg = choice?.message
    if (typeof msg?.content === 'string' && msg.content.trim()) {
      return msg.content.trim()
    }
  }

  return ''
}

export async function enhanceReflectionWithAi(reflectionText: string, apiKey: string): Promise<string> {
  const data: any = await callOpenAiResponses(apiKey, [
    {
      role: 'system',
      content: [
        {
          type: 'input_text',
          text: 'You improve short work reflections. Keep original meaning, improve grammar and clarity, and keep it concise (2-3 sentences).',
        },
      ],
    },
    {
      role: 'user',
      content: [{ type: 'input_text', text: reflectionText }],
    },
  ])

  const output = extractOpenAiText(data)
  if (!output) {
    throw new Error('No enhancement received from OpenAI')
  }

  return output
}

export async function parseImportFileWithAi(params: {
  fileName: string
  fileBase64: string
  fileType?: string | null
  reflectionFields: ReflectionFieldConfig[]
  apiKey: string
}): Promise<ParsedShiftRow[]> {
  const { fileName, fileBase64, fileType, reflectionFields, apiKey } = params

  const reflectionFieldSummary = reflectionFields
    .map((field) => `${field.id}: ${field.label} (${field.type})`)
    .join('\n')

  const effectiveFileType =
    (fileType || '').trim() ||
    (fileName.toLowerCase().endsWith('.csv')
      ? 'text/csv'
      : fileName.toLowerCase().endsWith('.txt')
        ? 'text/plain'
        : 'application/pdf')

  const prompt = [
    'Extract historical work logs and reflections from the attached file.',
    'Return strict JSON only with this shape:',
    '{"entries":[{"date":"YYYY-MM-DD","hours_worked":2.5,"paid":true|false|null,"category":"string or null","notes":"string or null","reflection":"string or null","enhanced_reflection":"string or null"}]}',
    'Rules:',
    '- Include only rows that clearly represent worked hours.',
    '- Convert all date formats to YYYY-MM-DD.',
    '- hours_worked must be decimal hours.',
    '- If paid status is unknown, use null.',
    '- If reflection text exists, place it in reflection.',
    '- Keep enhanced_reflection null unless clearly present in source.',
    '- If uncertain about a row, skip it.',
    '',
    'User reflection fields for context:',
    reflectionFieldSummary || 'No field config provided.',
  ].join('\n')

  const isPdf = effectiveFileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')

  const inputFilePart = isPdf
    ? {
        type: 'input_file',
        file_id: await uploadFileToOpenAi(apiKey, fileName, effectiveFileType, fileBase64),
      }
    : {
        type: 'input_file',
        filename: fileName,
        file_data: `data:${effectiveFileType};base64,${fileBase64}`,
      }

  const data: any = await callOpenAiResponses(apiKey, [
    {
      role: 'user',
      content: [
        { type: 'input_text', text: prompt },
        inputFilePart,
      ],
    },
  ])

  const outputText = extractOpenAiText(data)
  if (!outputText) {
    throw new Error('No parseable AI output received')
  }

  const parsed = extractJsonObject(outputText)
  const parsedEntries = Array.isArray(parsed?.entries) ? parsed.entries : []

  const normalizedRows = parsedEntries
    .map((entry: any) => normalizeRow(entry))
    .filter((entry: ParsedShiftRow | null): entry is ParsedShiftRow => Boolean(entry))

  const dedupe = new Map<string, ParsedShiftRow>()
  const keyOf = (row: ParsedShiftRow) => {
    return [
      row.date,
      Number(row.hours_worked).toFixed(2),
      row.paid === null ? 'null' : String(row.paid),
      (row.category || '').trim().toLowerCase(),
      (row.notes || '').trim().toLowerCase(),
    ].join('|')
  }

  normalizedRows.forEach((row: ParsedShiftRow) => {
    const key = keyOf(row)
    if (!dedupe.has(key)) {
      dedupe.set(key, row)
    }
  })

  return Array.from(dedupe.values())
}
