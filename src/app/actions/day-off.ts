"use server";

import { sql, initDb, DayOff, DayOffType } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getISTDateString } from "@/lib/time-utils";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session.userId;
}

export async function getDayOffs(
  startDate?: string,
  endDate?: string,
  targetUserId?: string
): Promise<DayOff[]> {
  await initDb();
  const currentUserId = await requireUser();
  const userId = targetUserId === "other" ? (currentUserId === "user1" ? "user2" : "user1") : (targetUserId || currentUserId);

  if (startDate && endDate) {
    const rows = (await sql`
      SELECT id, user_id, date, type, note, created_at
      FROM day_offs
      WHERE user_id = ${userId}
        AND date >= ${startDate}
        AND date <= ${endDate}
      ORDER BY date DESC
    `) as DayOff[];
    return rows;
  }

  const rows = (await sql`
    SELECT id, user_id, date, type, note, created_at
    FROM day_offs
    WHERE user_id = ${userId}
    ORDER BY date DESC
  `) as DayOff[];
  return rows;
}

export async function markDayOff(
  date?: string,
  type: DayOffType = "day_off",
  note: string = ""
): Promise<{ success: boolean; date: string; type: DayOffType }> {
  await initDb();
  const userId = await requireUser();
  const targetDate = date || getISTDateString();

  await sql`
    INSERT INTO day_offs (user_id, date, type, note)
    VALUES (${userId}, ${targetDate}, ${type}, ${note})
    ON CONFLICT (user_id, date)
    DO UPDATE SET type = EXCLUDED.type, note = EXCLUDED.note, created_at = NOW()
  `;

  try {
    revalidatePath("/");
    revalidatePath("/analytics");
    revalidatePath("/history");
  } catch {
    // ignore outside request context
  }

  return { success: true, date: targetDate, type };
}

export async function removeDayOff(
  date: string
): Promise<{ success: boolean; date: string }> {
  await initDb();
  const userId = await requireUser();

  await sql`
    DELETE FROM day_offs
    WHERE user_id = ${userId} AND date = ${date}
  `;

  try {
    revalidatePath("/");
    revalidatePath("/analytics");
    revalidatePath("/history");
  } catch {
    // ignore outside request context
  }

  return { success: true, date };
}
