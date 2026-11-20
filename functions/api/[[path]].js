/**
 * Same-origin proxy so a host that still calls /api keeps login cookies first-party.
 * Production Pages no longer uses this path: a Worker fetch to Render shares a few Cloudflare
 * IPs, and Render's Cloudflare answers 429. The browser calls Render directly instead.
 *
 * If this function does run, forward only the headers the API needs. Copying Cloudflare
 * client-IP headers makes Render count every subrequest against the visitor.
 */
const FALLBACK_API = 'https://toeic-api-2jb7.onrender.com'
const PASS = ['accept', 'accept-language', 'content-type', 'cookie', 'origin', 'referer', 'user-agent', 'range', 'if-none-match', 'if-modified-since', 'x-toeic-client', 'x-toeic-view-as']

export async function onRequest(context) {
  const apiOrigin = String(context.env?.API_ORIGIN || FALLBACK_API).replace(/\/$/, '')
  const incoming = new URL(context.request.url)
  const target = `${apiOrigin}${incoming.pathname}${incoming.search}`
  const headers = new Headers()
  for (const name of PASS) {
    const value = context.request.headers.get(name)
    if (value) headers.set(name, value)
  }

  const method = context.request.method
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const res = await fetch(target, {
    method,
    headers,
    body: hasBody ? context.request.body : undefined,
    redirect: 'manual',
    ...(hasBody ? { duplex: 'half' } : {}),
  })
  const out = new Headers(res.headers)
  out.delete('content-encoding')
  out.delete('content-length')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out })
}
