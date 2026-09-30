import { Injectable } from '@nestjs/common'
import { hash, verify } from '@node-rs/argon2'
import { randomInt } from 'node:crypto'

// OWASP-recommended Argon2id parameters (19 MiB, t=2, p=1).
const ARGON_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const

// No 0/O/1/l/I to keep temporary passwords readable when handed over in person.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'

@Injectable()
export class PasswordService {
  /** Precomputed hash used to burn equivalent CPU time when the account doesn't exist (prevents user enumeration by timing). */
  private dummyHash?: Promise<string>

  hash(plain: string): Promise<string> {
    return hash(plain, ARGON_OPTIONS)
  }

  async verify(storedHash: string, plain: string): Promise<boolean> {
    try {
      return await verify(storedHash, plain)
    } catch {
      return false
    }
  }

  async verifyDummy(plain: string): Promise<void> {
    this.dummyHash ??= this.hash('dummy-password-for-timing-0')
    await this.verify(await this.dummyHash, plain)
  }

  /** 12 chars, guaranteed to contain letters and digits so it satisfies the password policy. */
  generateTemporaryPassword(length = 12): string {
    const all = LETTERS + DIGITS
    const chars = [LETTERS[randomInt(LETTERS.length)], DIGITS[randomInt(DIGITS.length)]]
    while (chars.length < length) chars.push(all[randomInt(all.length)])
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1)
      ;[chars[i], chars[j]] = [chars[j], chars[i]]
    }
    return chars.join('')
  }
}
