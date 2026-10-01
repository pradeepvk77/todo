import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { neon } from "@neondatabase/serverless";
import { getISTDateString, getISTDayOfWeek, isTaskActiveOnDay } from "../src/lib/time-utils";
import { detectNoActionOccurrences as newBulkDetect } from "../src/lib/no-action-detector";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
const sql = neon(process.env.DATABASE_URL);

const TEST_USER_OLD = "test_user_parity_old";
const TEST_USER_NEW = "test_user_parity_new";

function dateFromISTString(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00+05:30`);
}

function formatISTDate(date: Date): string {
  return getISTDateString(date);
}

/**
 * Exact replica of the old un-optimized loop from git history
 */
async function oldDetectNoActionOccurrences(userId: string, daysBack = 7) {
  const todayStr = getISTDateString();
  const todayDate = dateFromISTString(todayStr);

  // 1. Cleanup false no_action entries where task_completions exist
  await sql`
    UPDATE task_occurrences o
    SET status = 'completed',
        completed_at = COALESCE(c.completed_at, NOW()),
        review_status = 'reviewed',
        updated_at = NOW()
    FROM task_completions c
    JOIN todos t ON (c.todo_id = t.id OR LOWER(TRIM(c.todo_title)) = LOWER(TRIM(t.title)))
    WHERE o.user_id = ${userId}
      AND o.todo_id = t.id
      AND o.occurrence_date = c.completed_date
      AND o.status = 'no_action'
  `;

  // 2. Auto-mark historical no_action entries older than 3 days as 'reviewed'
  const threeDaysAgo = new Date(todayDate);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysAgoStr = formatISTDate(threeDaysAgo);

  await sql`
    UPDATE task_occurrences
    SET review_status = 'reviewed', updated_at = NOW()
    WHERE user_id = ${userId}
      AND status = 'no_action'
      AND occurrence_date < ${threeDaysAgoStr}
      AND (review_status = 'unreviewed' OR review_status IS NULL OR review_status = '')
  `;

  // Fetch user's todos
  const todos = (await sql`
    SELECT id, user_id, title, assigned_day, scheduled_date, scheduled_time, created_at
    FROM todos
    WHERE user_id = ${userId}
  `) as { id: number; user_id: string; title: string; assigned_day: string; scheduled_date?: string; scheduled_time?: string; created_at: string }[];

  if (todos.length === 0) return;

  // Scan previous N days
  for (let i = 1; i <= daysBack; i++) {
    const pastCursor = new Date(todayDate);
    pastCursor.setDate(pastCursor.getDate() - i);
    const pastDateStr = formatISTDate(pastCursor);
    const pastDayOfWeek = getISTDayOfWeek(pastCursor);

    for (const todo of todos) {
      const taskCreatedDate = getISTDateString(new Date(todo.created_at));
      if (pastDateStr < taskCreatedDate) continue;

      const [occurrence] = (await sql`
        SELECT id, status FROM task_occurrences
        WHERE user_id = ${userId} AND todo_id = ${todo.id} AND occurrence_date = ${pastDateStr}
      `) as { id: number; status: string }[];

      if (occurrence && occurrence.status !== "pending") {
        continue;
      }

      const isActive =
        occurrence?.status === "pending" ||
        (todo.scheduled_date
          ? todo.scheduled_date === pastDateStr
          : isTaskActiveOnDay(todo.assigned_day, pastDayOfWeek));

      if (!isActive) continue;

      const [completion] = (await sql`
        SELECT id, completed_at FROM task_completions
        WHERE user_id = ${userId}
          AND (todo_id = ${todo.id} OR LOWER(TRIM(todo_title)) = LOWER(TRIM(${todo.title})))
          AND completed_date = ${pastDateStr}
      `) as { id: number; completed_at?: string }[];

      if (completion) {
        await sql`
          INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, scheduled_time, completed_at, review_status)
          VALUES (${userId}, ${todo.id}, ${pastDateStr}, 'completed', ${todo.scheduled_time || ""}, ${completion.completed_at || new Date().toISOString()}, 'reviewed')
          ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
          SET status = 'completed', completed_at = EXCLUDED.completed_at, review_status = 'reviewed', updated_at = NOW()
        `;
      } else {
        await sql`
          INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, scheduled_time, review_status)
          VALUES (${userId}, ${todo.id}, ${pastDateStr}, 'no_action', ${todo.scheduled_time || ""}, 'unreviewed')
          ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
          SET status = 'no_action', updated_at = NOW()
        `;

        const [existingActivity] = (await sql`
          SELECT id FROM task_activities
          WHERE user_id = ${userId} AND todo_id = ${todo.id} AND occurrence_date = ${pastDateStr} AND action_type = 'no_action'
        `) as { id: number }[];

        if (!existingActivity) {
          await sql`
            INSERT INTO task_activities (user_id, todo_id, occurrence_date, action_type, metadata)
            VALUES (${userId}, ${todo.id}, ${pastDateStr}, 'no_action', ${JSON.stringify({ reason: "scheduled_occurrence_passed" })})
          `;
        }
      }
    }
  }
}

async function cleanup(userId: string) {
  await sql`DELETE FROM task_activities WHERE user_id = ${userId}`;
  await sql`DELETE FROM task_occurrences WHERE user_id = ${userId}`;
  await sql`DELETE FROM task_completions WHERE user_id = ${userId}`;
  await sql`DELETE FROM todos WHERE user_id = ${userId}`;
}

async function seedData(userId: string) {
  // 1. Create 3 diverse tasks
  const [t1] = await sql`
    INSERT INTO todos (user_id, title, assigned_day, created_at)
    VALUES (${userId}, 'Everyday Exercise', 'all', NOW() - INTERVAL '10 days')
    RETURNING id
  `;
  const [t2] = await sql`
    INSERT INTO todos (user_id, title, assigned_day, created_at)
    VALUES (${userId}, 'Weekday Standup', 'weekdays', NOW() - INTERVAL '10 days')
    RETURNING id
  `;
  const [t3] = await sql`
    INSERT INTO todos (user_id, title, assigned_day, created_at)
    VALUES (${userId}, 'Weekend Review', 'weekends', NOW() - INTERVAL '10 days')
    RETURNING id
  `;

  const todayStr = getISTDateString();
  const todayDate = dateFromISTString(todayStr);

  const getPast = (daysAgo: number) => {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - daysAgo);
    return formatISTDate(d);
  };

  // Seed completions for some past dates (e.g. 2 days ago completed t1)
  await sql`
    INSERT INTO task_completions (user_id, todo_id, todo_title, task_type, completed_date, completed_at)
    VALUES (${userId}, ${t1.id}, 'Everyday Exercise', 'boolean', ${getPast(2)}, NOW())
  `;

  // Seed existing pre-aged unreviewed occurrence (e.g. 5 days ago) to test age-off logic
  await sql`
    INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, review_status)
    VALUES (${userId}, ${t1.id}, ${getPast(5)}, 'no_action', 'unreviewed')
  `;

  return { t1Id: t1.id, t2Id: t2.id, t3Id: t3.id };
}

async function runParityTest() {
  console.log("=== Running Behavior Parity Test ===");

  console.log("1. Cleaning previous test artifacts...");
  await cleanup(TEST_USER_OLD);
  await cleanup(TEST_USER_NEW);

  console.log("2. Seeding identical datasets for both users...");
  const oldIds = await seedData(TEST_USER_OLD);
  const newIds = await seedData(TEST_USER_NEW);

  console.log("3. Running old detectNoActionOccurrences on TEST_USER_OLD...");
  const startOld = Date.now();
  await oldDetectNoActionOccurrences(TEST_USER_OLD, 7);
  const durOld = Date.now() - startOld;
  console.log(`   Old logic executed in ${durOld}ms`);

  console.log("4. Running new bulk detectNoActionOccurrences on TEST_USER_NEW...");
  const startNew = Date.now();
  await newBulkDetect(TEST_USER_NEW, 7);
  const durNew = Date.now() - startNew;
  console.log(`   New bulk logic executed in ${durNew}ms`);

  console.log("5. Fetching generated task_occurrences for comparison...");
  const oldOccurrences = await sql`
    SELECT occurrence_date, status, review_status, scheduled_time
    FROM task_occurrences
    WHERE user_id = ${TEST_USER_OLD}
    ORDER BY occurrence_date ASC, todo_id ASC
  `;

  const newOccurrences = await sql`
    SELECT occurrence_date, status, review_status, scheduled_time
    FROM task_occurrences
    WHERE user_id = ${TEST_USER_NEW}
    ORDER BY occurrence_date ASC, todo_id ASC
  `;

  console.log("6. Fetching generated task_activities for comparison...");
  const oldActivities = await sql`
    SELECT occurrence_date, action_type
    FROM task_activities
    WHERE user_id = ${TEST_USER_OLD}
    ORDER BY occurrence_date ASC, todo_id ASC
  `;

  const newActivities = await sql`
    SELECT occurrence_date, action_type
    FROM task_activities
    WHERE user_id = ${TEST_USER_NEW}
    ORDER BY occurrence_date ASC, todo_id ASC
  `;

  console.log("\n=== Parity Verification Results ===");
  console.log(`task_occurrences count: Old = ${oldOccurrences.length}, New = ${newOccurrences.length}`);
  console.log(`task_activities count:  Old = ${oldActivities.length}, New = ${newActivities.length}`);

  let mismatches = 0;

  if (oldOccurrences.length !== newOccurrences.length) {
    console.error(`❌ Occurrence length mismatch! Old: ${oldOccurrences.length}, New: ${newOccurrences.length}`);
    mismatches++;
  } else {
    for (let i = 0; i < oldOccurrences.length; i++) {
      const o = oldOccurrences[i];
      const n = newOccurrences[i];
      if (
        o.occurrence_date !== n.occurrence_date ||
        o.status !== n.status ||
        o.review_status !== n.review_status
      ) {
        console.error(`❌ Occurrence diff at row ${i}:`, { old: o, new: n });
        mismatches++;
      }
    }
  }

  if (oldActivities.length !== newActivities.length) {
    console.error(`❌ Activity length mismatch! Old: ${oldActivities.length}, New: ${newActivities.length}`);
    mismatches++;
  } else {
    for (let i = 0; i < oldActivities.length; i++) {
      const o = oldActivities[i];
      const n = newActivities[i];
      if (o.occurrence_date !== n.occurrence_date || o.action_type !== n.action_type) {
        console.error(`❌ Activity diff at row ${i}:`, { old: o, new: n });
        mismatches++;
      }
    }
  }

  console.log("\n7. Checking 3-day age-off behavior:");
  const oldAged = oldOccurrences.find((r) => r.occurrence_date === formatISTDate((() => {
    const d = new Date(dateFromISTString(getISTDateString()));
    d.setDate(d.getDate() - 5);
    return d;
  })()));
  const newAged = newOccurrences.find((r) => r.occurrence_date === formatISTDate((() => {
    const d = new Date(dateFromISTString(getISTDateString()));
    d.setDate(d.getDate() - 5);
    return d;
  })()));

  console.log(`   Old pre-aged occurrence (5 days ago) review_status: "${oldAged?.review_status}"`);
  console.log(`   New pre-aged occurrence (5 days ago) review_status: "${newAged?.review_status}"`);

  if (oldAged?.review_status === "reviewed" && newAged?.review_status === "reviewed") {
    console.log("   ✅ 3-day age-off logic verified identical in both versions!");
  } else {
    console.error("   ❌ Age-off mismatch detected");
    mismatches++;
  }

  console.log("\n8. Cleaning up test data...");
  await cleanup(TEST_USER_OLD);
  await cleanup(TEST_USER_NEW);

  if (mismatches === 0) {
    console.log("\n🎉 PERFECT PARITY: All task_occurrences and task_activities matched 100%!");
    console.log(`Speedup: ${durOld}ms → ${durNew}ms (${(durOld / Math.max(durNew, 1)).toFixed(1)}x faster)`);
  } else {
    console.error(`\n❌ Parity test failed with ${mismatches} mismatches!`);
    process.exit(1);
  }
}

runParityTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
