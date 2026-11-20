/**
 * Dev web on Vercel. The browser talks to this same host at /api, and this function
 * forwards the request to the dev API (API_ORIGIN). Login cookies stay first-party.
 * There is no fallback host: a missing API_ORIGIN must not send dev traffic at production.
 * Only the headers the API needs are forwarded. Client-IP headers are not.
 */
export const config = { runtime: 'edge' }

const PASS = ['accept', 'accept-language', 'content-type', 'cookie', 'origin', 'referer', 'user-agent', 'range', 'if-none-match', 'if-modified-since', 'x-toeic-client', 'x-toeic-view-as']

export default async function handler(request) {
  const apiOrigin = String(process.env.API_ORIGIN || 'https://toeic-api-dev.onrender.com').replace(/\/$/, '')

  const incoming = new URL(request.url)
  const target = `${apiOrigin}${incoming.pathname}${incoming.search}`
  const headers = new Headers()
  for (const name of PASS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  const method = request.method
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const res = await fetch(target, {
    method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: 'manual',
  })
  const out = new Headers(res.headers)
  out.delete('content-encoding')
  out.delete('content-length')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out })
}
