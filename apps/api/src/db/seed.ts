import { sql } from 'drizzle-orm'
import { ENABLED_SKILLS, PART_SEED, SKILL_SEED } from '@toeic/shared'
import type { Db } from './database.module'
import { parts, skills } from './schema'

/** Idempotent seed of Skill + Part reference data. `enabled` is (re)synced from ENABLED_SKILLS. */
export async function seedReferenceData(db: Db) {
  const skillRows = await db
    .insert(skills)
    .values(
      SKILL_SEED.map((s) => ({
        code: s.code,
        name: s.name,
        displayOrder: s.displayOrder,
        enabled: ENABLED_SKILLS.includes(s.code),
      })),
    )
    .onConflictDoUpdate({
      target: skills.code,
      set: { name: sql`excluded.name`, displayOrder: sql`excluded.display_order`, enabled: sql`excluded.enabled` },
    })
    .returning({ id: skills.id, code: skills.code })

  const skillId = new Map(skillRows.map((r) => [r.code, r.id]))
  await db
    .insert(parts)
    .values(
      PART_SEED.map((p) => ({
        skillId: skillId.get(p.skill)!,
        code: p.code,
        name: p.name,
        description: p.description,
        displayOrder: p.displayOrder,
      })),
    )
    .onConflictDoUpdate({
      target: parts.code,
      set: { name: sql`excluded.name`, description: sql`excluded.description`, displayOrder: sql`excluded.display_order` },
    })
}
