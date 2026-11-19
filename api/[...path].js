/**
 * Dev web on Vercel. The browser talks to this same host at /api, and this function
 * forwards the request to the dev API (API_ORIGIN). Login cookies stay first-party.
 * There is no fallback host: a missing API_ORIGIN must not send dev traffic at production.
 */
export const config = { runtime: 'edge' }

export default async function handler(request) {
  const apiOrigin = String(process.env.API_ORIGIN || 'https://toeic-api-dev.onrender.com').replace(/\/$/, '')

  const incoming = new URL(request.url)
  const target = `${apiOrigin}${incoming.pathname}${incoming.search}`
  const headers = new Headers(request.headers)
  const clientIp = headers.get('cf-connecting-ip') || headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  for (const name of ['cf-connecting-ip', 'cf-ray', 'cf-ipcountry', 'cf-visitor', 'cf-ew-via', 'cf-worker', 'cdn-loop', 'x-real-ip']) headers.delete(name)
  headers.set('host', new URL(apiOrigin).host)
  headers.delete('content-length')
  if (clientIp) headers.set('x-forwarded-for', clientIp)

  const method = request.method
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const res = await fetch(target, {
    method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: 'manual',
    ...(hasBody ? { duplex: 'half' } : {}),
  })
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers })
}
