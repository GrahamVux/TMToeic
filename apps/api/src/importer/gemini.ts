/** Minimal Gemini REST client for structured extraction (no SDK). The API key is read by the caller and never logged. */

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { mimeType: string; fileUri: string } }

export type GeminiUsage = { promptTokens: number; outputTokens: number; thinkingTokens: number }

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function inlineFile(mimeType: string, data: Buffer): GeminiPart {
  return { inlineData: { mimeType, data: data.toString('base64') } }
}

export function filePart(mimeType: string, fileUri: string): GeminiPart {
  return { fileData: { mimeType, fileUri } }
}

/** Upload a file the inline 20 MB limit cannot take (answer-key PDFs). Waits until Gemini finishes processing. */
export async function uploadGeminiFile(apiKey: string, mimeType: string, data: Buffer, displayName: string): Promise<{ uri: string; mimeType: string; name: string }> {
  const start = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(data.length),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { displayName } }),
  })
  const uploadUrl = start.headers.get('x-goog-upload-url')
  if (!uploadUrl) throw new GeminiError(`File upload start failed (${start.status}): ${await start.text()}`, start.status)

  const put = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(data.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: new Uint8Array(data),
  })
  const json = (await put.json().catch(() => null)) as { file?: { uri?: string; mimeType?: string; name?: string; state?: string } } | null
  const file = json?.file
  if (!file?.uri || !file.name) throw new GeminiError(`File upload failed (${put.status}): ${JSON.stringify(json)}`, put.status)

  for (let i = 0; i < 30; i++) {
    const info = (await (await fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}?key=${encodeURIComponent(apiKey)}`)).json()) as {
      state?: string
      uri?: string
      mimeType?: string
      error?: { message?: string }
    }
    if (info.state === 'ACTIVE') return { uri: info.uri ?? file.uri, mimeType: info.mimeType ?? mimeType, name: file.name }
    if (info.state === 'FAILED' || info.error) throw new GeminiError(`File processing failed: ${info.error?.message ?? info.state}`, 500)
    await sleep(1000)
  }
  throw new GeminiError('File is still processing after 30s', 504)
}

export async function generateJson<T>(opts: {
  apiKey: string
  model: string
  parts: GeminiPart[]
  /** Gemini responseSchema (OpenAPI subset, uppercase type names). */
  schema: Record<string, unknown>
  maxOutputTokens?: number
  signal?: AbortSignal
}): Promise<{ data: T; usage: GeminiUsage }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: opts.parts }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: opts.schema,
      maxOutputTokens: opts.maxOutputTokens ?? 60000,
    },
  })

  let lastError: GeminiError | null = null
  // 429/5xx: a couple of short retries here; ModelRunner then tries the next model instead of waiting minutes.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(Math.min(30_000, 2_000 * 2 ** (attempt - 1)))
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': opts.apiKey },
        body,
        signal: opts.signal ?? AbortSignal.timeout(90_000),
      })
    } catch (err) {
      lastError = new GeminiError(`Network error: ${(err as Error).message}`, 0)
      continue
    }
    const json = (await res.json().catch(() => null)) as {
      error?: { message?: string }
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }
    } | null

    if (!res.ok) {
      const message = json?.error?.message ?? 'unknown error'
      lastError = new GeminiError(`Gemini ${res.status}: ${message}`, res.status)
      if (res.status === 429) {
        if (/PerDay/i.test(message)) throw lastError
        const retrySec = Number(/Please retry in ([0-9.]+)s/i.exec(message)?.[1])
        const wait = Number.isFinite(retrySec) ? Math.ceil(retrySec * 1000) + 500 : Math.min(60_000, 5_000 * 2 ** attempt)
        await sleep(wait)
        continue
      }
      if (res.status >= 500) continue
      throw lastError
    }
    const candidate = json?.candidates?.[0]
    const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    if (candidate?.finishReason === 'MAX_TOKENS') throw new GeminiError('Response was cut off (MAX_TOKENS): request fewer questions per call', 200)
    if (!text) {
      lastError = new GeminiError(`Empty response (finishReason=${candidate?.finishReason ?? 'none'})`, 200)
      continue
    }
    try {
      return {
        data: JSON.parse(text) as T,
        usage: {
          promptTokens: json?.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: json?.usageMetadata?.candidatesTokenCount ?? 0,
          thinkingTokens: json?.usageMetadata?.thoughtsTokenCount ?? 0,
        },
      }
    } catch {
      lastError = new GeminiError('Response was not valid JSON', 200)
    }
  }
  throw lastError ?? new GeminiError('Gemini request failed', 0)
}
