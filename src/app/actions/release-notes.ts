"use server";

import { getLatestMajorRelease, getAllReleases } from "@/lib/release-notes";
import { getSession } from "@/lib/session";
import { sql } from "@/lib/db";

// Re-export static helpers
export { getLatestMajorRelease, getAllReleases };

/**
 * Called when a user dismisses the "What's New" modal.
 * Saves the version to the DB so we never show that modal again —
 * even in incognito, on a new device, or after clearing browser storage.
 */
export async function markWhatsNewSeen(version: string): Promise<void> {
  const session = await getSession();
  if (!session) return;

  await sql`
    INSERT INTO user_preferences (user_id, whats_new_seen_version)
    VALUES (${session.userId}, ${version})
    ON CONFLICT (user_id)
    DO UPDATE SET whats_new_seen_version = ${version}, updated_at = NOW()
  `;
}
