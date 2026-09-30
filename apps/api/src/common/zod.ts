import type { z } from 'zod'
import { AppException } from './app-exception'

/** Parse & validate untrusted input with a shared Zod schema; throws a 400 with per-field details. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input ?? {})
  if (!result.success) {
    const fields: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_'
      fields[key] ??= issue.message
    }
    throw AppException.badRequest('Dữ liệu không hợp lệ', { fields })
  }
  return result.data
}
