/** Same-origin proxy so login cookies are first-party (iOS Safari blocks third-party cookies). */
const FALLBACK_API = 'https://toeic-api-2jb7.onrender.com'

export async function onRequest(context) {
  const apiOrigin = String(context.env?.API_ORIGIN || FALLBACK_API).replace(/\/$/, '')
  const incoming = new URL(context.request.url)
  const target = `${apiOrigin}${incoming.pathname}${incoming.search}`
  const headers = new Headers(context.request.headers)
  headers.set('host', new URL(apiOrigin).host)

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
