import { effectiveAvatarFrame, goalFromStored, teacherGrants, THEME_PRESET_IDS, type ThemePresetId, type UserDto } from '@toeic/shared'
import type { UserRow } from '../db/schema'

const THEME_SET = new Set<string>(THEME_PRESET_IDS)

/** The ONLY place a DB user row becomes an API payload — guarantees password_hash etc. never leak. */
export function toUserDto(u: UserRow, classroom?: { id: string; name: string } | null): UserDto {
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
    avatarFrame: effectiveAvatarFrame(u.role, u.avatarFrame, u.avatarFrameExpiresAt),
    themePreset: u.themePreset && THEME_SET.has(u.themePreset) ? (u.themePreset as ThemePresetId) : null,
    rewardPoints: u.rewardPoints ?? 0,
    targetScore: u.targetScore,
    goal: goalFromStored(u.goalTrack, u.targetScore),
    mustChangePassword: u.mustChangePassword,
    permissions: teacherGrants(u.role, {
      createStudents: u.permCreateStudents,
      manageAssignments: u.permManageAssignments,
      viewProgress: u.permViewProgress,
    }),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    classId: classroom?.id ?? null,
    className: classroom?.name ?? null,
  }
}
