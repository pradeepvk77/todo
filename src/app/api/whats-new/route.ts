import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getLatestMajorRelease } from "@/lib/release-notes";
import { sql } from "@/lib/db";

// GET /api/whats-new
// Returns the latest major release — BUT only if this user hasn't seen it yet.
// Checks DB (server-side) so the "already seen" state persists across
// incognito tabs, new devices, and browser cache clears.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const release = getLatestMajorRelease();
  if (!release) {
    return NextResponse.json({ show: false, release: null });
  }

  // Check if this user has already dismissed this version
  const rows = (await sql`
    SELECT whats_new_seen_version
    FROM user_preferences
    WHERE user_id = ${session.userId}
  `) as { whats_new_seen_version: string }[];

  const seenVersion = rows[0]?.whats_new_seen_version ?? "";
  if (seenVersion === release.version) {
    // Already seen — return show: false (HTTP 200 so no console 404 error)
    return NextResponse.json({ show: false, release: null });
  }

  return NextResponse.json({
    show: true,
    release: {
      version: release.version,
      title: release.title,
      features: release.features,
      release_date: release.releaseDate,
    },
  });
}
