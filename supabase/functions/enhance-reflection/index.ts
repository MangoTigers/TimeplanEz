// Supabase Edge Function: Enhance reflection text with OpenAI
// Deploy to: supabase/functions/enhance-reflection

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

interface RequestBody {
  reflection: string
  openaiApiKey?: string | null
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { reflection, openaiApiKey } = (await req.json()) as RequestBody
    const effectiveApiKey = openaiApiKey?.trim() || OPENAI_API_KEY

    if (!reflection || typeof reflection !== 'string') {
      return jsonResponse({ error: 'Invalid reflection text' }, 400)
    }

    if (!effectiveApiKey) {
      return jsonResponse({ error: 'OpenAI API key not configured' }, 400)
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${effectiveApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that improves and expands short work reflections. Keep the original message intent but enhance grammar, clarity, and add some constructive insights. Keep it concise (2-3 sentences max).',
          },
          {
            role: 'user',
            content: `Enhance this work reflection: "${reflection}"`,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const enhanced_text = data.choices[0]?.message?.content || reflection

    return jsonResponse({ enhanced_text }, 200)
  } catch (error) {
    console.error('Error:', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    )
  }
})
