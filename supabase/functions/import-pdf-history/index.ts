import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReflectionFieldLike {
  id?: string
  label?: string
  type?: string
}

interface ImportRequestBody {
  fileName: string
  fileBase64: string
  fileType?: string | null
  openaiApiKey?: string | null
  reflectionFields?: ReflectionFieldLike[]
  mode?: 'preview' | 'import'
}

interface ParsedShiftRow {
  date: string
  hours_worked: number
  paid: boolean | null
  category: string | null
  notes: string | null
  reflection: string | null
  enhanced_reflection: string | null
}

function safeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
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

function buildReflectionPayload(reflectionText: string): string {
  return JSON.stringify({
    version: 2,
    values: {
      taskCompleted: reflectionText,
    },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return safeJsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const { fileName, fileBase64, fileType, openaiApiKey, reflectionFields = [], mode = 'preview' } = (await req.json()) as ImportRequestBody

    if (!fileName || !fileBase64) {
      return safeJsonResponse({ error: 'Missing fileName or fileBase64' }, 400)
    }

    const effectiveApiKey = openaiApiKey?.trim() || OPENAI_API_KEY
    if (!effectiveApiKey) {
      return safeJsonResponse({ error: 'OpenAI API key not configured' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''

    if (!supabaseUrl || !supabaseAnonKey) {
      return safeJsonResponse({ error: 'Supabase configuration missing' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return safeJsonResponse({ error: 'Missing Authorization header' }, 401)
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return safeJsonResponse({ error: 'Unauthorized' }, 401)
    }

    const reflectionFieldSummary = reflectionFields
      .map((field) => `${field.id || 'unknown'}: ${field.label || 'Unnamed'} (${field.type || 'text'})`)
      .join('\n')

    const effectiveFileType = (fileType || '').trim() || (fileName.toLowerCase().endsWith('.csv') ? 'text/csv' : fileName.toLowerCase().endsWith('.txt') ? 'text/plain' : 'application/pdf')

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
      '- Keep enhanced_reflection null unless clearly present in the PDF.',
      '- If uncertain about a row, skip it.',
      '',
      'User reflection fields for context:',
      reflectionFieldSummary || 'No field config provided.',
    ].join('\n')

    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${effectiveApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_file', filename: fileName, file_data: `data:${effectiveFileType};base64,${fileBase64}` },
            ],
          },
        ],
      }),
    })

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text()
      return safeJsonResponse({ error: `OpenAI API failed: ${errorText}` }, 502)
    }

    const openAiData: any = await openAiResponse.json()
    const outputText = openAiData.output_text

    if (!outputText || typeof outputText !== 'string') {
      return safeJsonResponse({ error: 'No parseable AI output received' }, 422)
    }

    const parsed = extractJsonObject(outputText)
    const parsedEntries = Array.isArray(parsed?.entries) ? parsed.entries : []
    const normalizedRows = parsedEntries
      .map((entry: any) => normalizeRow(entry))
      .filter((entry: ParsedShiftRow | null): entry is ParsedShiftRow => Boolean(entry))

    const uniqueRowsMap = new Map<string, ParsedShiftRow>()
    const serializeRowKey = (row: { date: string; hours_worked: number; paid: boolean | null; category: string | null; notes: string | null }) => {
      return [
        row.date,
        Number(row.hours_worked).toFixed(2),
        row.paid === null ? 'null' : String(row.paid),
        (row.category || '').trim().toLowerCase(),
        (row.notes || '').trim().toLowerCase(),
      ].join('|')
    }

    normalizedRows.forEach((row) => {
      const key = serializeRowKey(row)
      if (!uniqueRowsMap.has(key)) {
        uniqueRowsMap.set(key, row)
      }
    })

    const uniqueRows = Array.from(uniqueRowsMap.values())

    if (!uniqueRows.length) {
      return safeJsonResponse({
        parsedCount: parsedEntries.length,
        importedCount: 0,
        skippedDuplicates: 0,
        warnings: ['No valid rows could be extracted from the PDF.'],
      })
    }

    const importDates = Array.from(new Set(uniqueRows.map((row) => row.date)))

    const { data: existingShifts, error: existingError } = await supabase
      .from('shifts')
      .select('date,hours_worked,paid,category,notes')
      .eq('user_id', user.id)
      .in('date', importDates)

    if (existingError) {
      return safeJsonResponse({ error: existingError.message }, 500)
    }

    const existingKeys = new Set((existingShifts || []).map((row) => serializeRowKey(row)))

    const importCandidates = uniqueRows
      .filter((row) => !existingKeys.has(serializeRowKey(row)))

    if (mode === 'preview') {
      return safeJsonResponse({
        parsedCount: parsedEntries.length,
        importableCount: importCandidates.length,
        skippedDuplicates: uniqueRows.length - importCandidates.length,
        entries: importCandidates,
        warnings: [],
      })
    }

    const insertRows = importCandidates
      .map((row) => ({
        user_id: user.id,
        date: row.date,
        hours_worked: row.hours_worked,
        paid: row.paid,
        category: row.category || 'General',
        notes: row.notes,
        reflection: row.reflection ? buildReflectionPayload(row.reflection) : null,
        enhanced_reflection: row.enhanced_reflection,
      }))

    if (insertRows.length) {
      const { error: insertError } = await supabase.from('shifts').insert(insertRows)
      if (insertError) {
        return safeJsonResponse({ error: insertError.message }, 500)
      }
    }

    return safeJsonResponse({
      parsedCount: parsedEntries.length,
      importedCount: insertRows.length,
      skippedDuplicates: uniqueRows.length - importCandidates.length,
      warnings: [],
    })
  } catch (error) {
    console.error('import-pdf-history error', error)
    return safeJsonResponse(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    )
  }
})
