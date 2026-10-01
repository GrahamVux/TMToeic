import { goalFromStored, type UserDto } from '@toeic/shared'
import type { UserRow } from '../db/schema'

/** The ONLY place a DB user row becomes an API payload — guarantees password_hash etc. never leak. */
export function toUserDto(u: UserRow): UserDto {
  return {
    id: u.id,
    username: u.username,
    studentCode: u.studentCode,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    avatarUrl: u.avatarUrl,
    targetScore: u.targetScore,
    goal: goalFromStored(u.goalTrack, u.targetScore),
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }
}
