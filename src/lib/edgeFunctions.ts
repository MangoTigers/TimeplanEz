export type EdgeFunctionErrorCode = 'not_deployed' | 'network' | 'unknown'

export function classifyEdgeFunctionError(error: unknown): EdgeFunctionErrorCode {
  const err = error as any
  const message = String(err?.message || '')
  const name = String(err?.name || '')
  const status = Number(
    err?.context?.response?.status ?? err?.status ?? err?.context?.status ?? 0
  )

  if (status === 404 || /\b404\b/.test(message)) {
    return 'not_deployed'
  }

  if (
    name === 'FunctionsFetchError' ||
    /Failed to send a request to the Edge Function/i.test(message) ||
    /Failed to fetch/i.test(message)
  ) {
    return 'network'
  }

  return 'unknown'
}

export function getEdgeFunctionTroubleshootingHint(): string {
  return 'Hvis funksjonen finnes, skyldes dette ofte manglende CORS-headere i feilrespons fra Edge Function eller en intern runtime-feil. Sjekk Function Logs i Supabase.'
}
