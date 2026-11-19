/**
 * Same-origin proxy so login cookies are first-party (iOS Safari blocks third-party cookies).
 * A new Pages project must set API_ORIGIN to its own Render API. The fallback keeps the current site working.
 *
 * Cloudflare headers must not be forwarded. Leaving cf-connecting-ip on the subrequest makes
 * Cloudflare count every API call against the visitor and answer 429 over and over.
 */
const FALLBACK_API = 'https://toeic-api-2jb7.onrender.com'
const STRIP = ['cf-connecting-ip', 'cf-ray', 'cf-ipcountry', 'cf-visitor', 'cf-ew-via', 'cf-worker', 'cdn-loop', 'x-real-ip']

export async function onRequest(context) {
  const apiOrigin = String(context.env?.API_ORIGIN || FALLBACK_API).replace(/\/$/, '')
  const incoming = new URL(context.request.url)
  const target = `${apiOrigin}${incoming.pathname}${incoming.search}`
  const headers = new Headers(context.request.headers)
  const clientIp = headers.get('cf-connecting-ip')
  for (const name of STRIP) headers.delete(name)
  headers.set('host', new URL(apiOrigin).host)
  headers.delete('content-length')
  if (clientIp) headers.set('x-forwarded-for', clientIp)

  const method = context.request.method
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const res = await fetch(target, {
    method,
    headers,
    body: hasBody ? context.request.body : undefined,
    redirect: 'manual',
    ...(hasBody ? { duplex: 'half' } : {}),
  })
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers })
}
