import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import { AssignedDay } from "./time-utils";

export interface DailyVocabulary {
  id: number;
  date: string;
  created_at: string;
}

export interface VocabularyWord {
  id: number;
  daily_vocabulary_id: number;
  word: string;
  word_key: string;  // normalized: lowercase + trimmed, used for uniqueness
  part_of_speech: string;
  english_meaning: string;
  hindi_meaning: string;
  example_sentence: string;
  pronunciation: string;
  synonyms: string; // JSON-encoded string[]
  usage_context: string;
  created_at: string;
}

export type DaySection = "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";
export type Priority = "must_do" | "should_do" | "nice_to_do";
export type TaskKind = "habit" | "one_time" | "learning" | "exercise" | "personal" | "work" | "other";
export type Difficulty = "easy" | "medium" | "hard";
export type ExpectedEffort = "low" | "medium" | "high";
export type OccurrenceStatus = "pending" | "completed" | "skipped" | "rescheduled" | "no_action";
export type MissedReason =
  | "too_tired"
  | "forgot"
  | "not_in_mood"
  | "ran_out_of_time"
  | "something_came_up"
  | "not_important"
  | "other";

export interface Todo {
  id: number;
  user_id: string;
  title: string;
  completed: boolean;
  task_type: "time" | "checkbox" | "input" | "number";
  category: string;
  type_value: string;
  sort_order: number;
  assigned_day: AssignedDay;
  day_section: DaySection;
  last_reset_date: string;
  created_at: string;
  // Extended Phase 1 Fields
  priority?: Priority;
  task_kind?: TaskKind;
  estimated_duration?: number;
  difficulty?: Difficulty;
  expected_effort?: ExpectedEffort;
  goal_reason?: string;
  note?: string;
  scheduled_date?: string;
  scheduled_time?: string;
}

export interface TaskOccurrence {
  id: number;
  user_id: string;
  todo_id: number;
  occurrence_date: string;
  status: OccurrenceStatus;
  scheduled_time?: string;
  completed_at?: string;
  skipped_at?: string;
  rescheduled_at?: string;
  rescheduled_to_date?: string;
  rescheduled_to_time?: string;
  missed_reason?: MissedReason | "";
  missed_reason_notes?: string;
  review_status?: "unreviewed" | "reviewed";
  reviewed_at?: string;
  app_update_reason?: string;
  app_update_reason_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskActivity {
  id: number;
  user_id: string;
  todo_id: number;
  occurrence_date?: string;
  action_type: "created" | "completed" | "uncompleted" | "skipped" | "rescheduled" | "no_action" | "updated";
  previous_value?: string;
  new_value?: string;
  metadata?: string;
  created_at: string;
}

export function normalizeDaySection(daySection?: string | null, title?: string): DaySection {
  const validSections: DaySection[] = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"];
  if (daySection) {
    const upper = daySection.toUpperCase() as DaySection;
    if (validSections.includes(upper)) return upper;
  }
  if (title) {
    const lower = title.toLowerCase();
    if (lower.includes("breakfast") || lower.includes("wake") || lower.includes("morning")) return "MORNING";
    if (lower.includes("lunch") || lower.includes("afternoon")) return "AFTERNOON";
    if (lower.includes("evening") || lower.includes("walk") || lower.includes("dinner")) return "EVENING";
    if (lower.includes("night") || lower.includes("sleep") || lower.includes("bedtime")) return "NIGHT";
  }
  return "MORNING";
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const dbUrl = process.env.DATABASE_URL;
const isNeon = dbUrl.includes("neon.tech");

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function createPgSql(url: string) {
  if (!globalThis._pgPool) {
    globalThis._pgPool = new Pool({ connectionString: url });
  }
  const pool = globalThis._pgPool;

  async function sql(strings: TemplateStringsArray, ...values: any[]) {
    let text = strings[0];
    for (let i = 1; i < strings.length; i++) {
      text += `$${i}` + strings[i];
    }
    const res = await pool.query(text, values);
    return res.rows;
  }

  return sql as any;
}

export const sql = isNeon ? neon(dbUrl) : createPgSql(dbUrl);

// Initialize the todos table if it doesn't exist
export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS todos (
      id              SERIAL PRIMARY KEY,
      user_id         TEXT    DEFAULT 'user1',
      title           TEXT    NOT NULL,
      completed       BOOLEAN DEFAULT FALSE,
      task_type       TEXT    DEFAULT 'checkbox',
      category        TEXT    DEFAULT 'Personal',
      type_value      TEXT    DEFAULT '',
      sort_order      INTEGER DEFAULT 0,
      assigned_day    TEXT    DEFAULT 'everyday',
      day_section     TEXT    DEFAULT 'MORNING',
      last_reset_date TEXT    DEFAULT '',
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'user1'
  `;
  await sql`
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS assigned_day TEXT DEFAULT 'everyday'
  `;
  await sql`
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS day_section TEXT DEFAULT 'MORNING'
  `;
  await sql`
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS last_reset_date TEXT DEFAULT ''
  `;
  await sql`
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Personal'
  `;
  await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'should_do'`;
  await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS task_kind TEXT DEFAULT 'other'`;
  await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS estimated_duration INTEGER DEFAULT 15`;
  await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium'`;
  await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS expected_effort TEXT DEFAULT 'medium'`;
  await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS goal_reason TEXT DEFAULT ''`;
  await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS note TEXT DEFAULT ''`;
  await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS scheduled_date TEXT DEFAULT ''`;
  await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS scheduled_time TEXT DEFAULT ''`;

  await sql`
    CREATE TABLE IF NOT EXISTS task_completions (
      id              SERIAL PRIMARY KEY,
      user_id         TEXT NOT NULL,
      todo_id         INTEGER NOT NULL,
      todo_title      TEXT NOT NULL,
      task_type       TEXT NOT NULL,
      category        TEXT NOT NULL DEFAULT 'Personal',
      completed_date  TEXT NOT NULL,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, todo_id, completed_date)
    )
  `;
  await sql`
    ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Personal'
  `;
  await sql`ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NOW()`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS task_completions_user_todo_date_uidx ON task_completions (user_id, todo_id, completed_date)`;

  await sql`
    CREATE TABLE IF NOT EXISTS task_occurrences (
      id                  SERIAL PRIMARY KEY,
      user_id             TEXT NOT NULL,
      todo_id             INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      occurrence_date     TEXT NOT NULL,
      status              TEXT NOT NULL DEFAULT 'pending',
      scheduled_time      TEXT DEFAULT '',
      completed_at        TIMESTAMPTZ,
      skipped_at          TIMESTAMPTZ,
      rescheduled_at      TIMESTAMPTZ,
      missed_reason       TEXT DEFAULT '',
      missed_reason_notes TEXT DEFAULT '',
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      updated_at          TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, todo_id, occurrence_date)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS task_occurrences_user_date_idx ON task_occurrences (user_id, occurrence_date)`;
  await sql`CREATE INDEX IF NOT EXISTS task_occurrences_todo_id_idx ON task_occurrences (todo_id)`;
  await sql`ALTER TABLE task_occurrences ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'unreviewed'`;
  await sql`ALTER TABLE task_occurrences ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE task_occurrences ADD COLUMN IF NOT EXISTS app_update_reason TEXT DEFAULT ''`;
  await sql`ALTER TABLE task_occurrences ADD COLUMN IF NOT EXISTS app_update_reason_notes TEXT DEFAULT ''`;
  await sql`ALTER TABLE task_occurrences ADD COLUMN IF NOT EXISTS rescheduled_to_date TEXT DEFAULT ''`;
  await sql`ALTER TABLE task_occurrences ADD COLUMN IF NOT EXISTS rescheduled_to_time TEXT DEFAULT ''`;

  await sql`
    CREATE TABLE IF NOT EXISTS task_activities (
      id              SERIAL PRIMARY KEY,
      user_id         TEXT NOT NULL,
      todo_id         INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      occurrence_date TEXT DEFAULT '',
      action_type     TEXT NOT NULL,
      previous_value  TEXT DEFAULT '{}',
      new_value       TEXT DEFAULT '{}',
      metadata        TEXT DEFAULT '{}',
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS task_activities_user_todo_idx ON task_activities (user_id, todo_id)`;
  await sql`CREATE INDEX IF NOT EXISTS task_activities_created_at_idx ON task_activities (created_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL,
      endpoint    TEXT NOT NULL UNIQUE,
      p256dh      TEXT NOT NULL,
      auth        TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
    ON push_subscriptions (user_id)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id         TEXT PRIMARY KEY,
      friend_nickname TEXT NOT NULL DEFAULT '',
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await initVocabularyTables();
}

// Initialize vocabulary tables
export async function initVocabularyTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS daily_vocabulary (
      id         SERIAL PRIMARY KEY,
      date       TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Ensure the UNIQUE constraint exists for ON CONFLICT (date) even on tables
  // that were created before the UNIQUE keyword was added to the column definition.
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS daily_vocabulary_date_uidx ON daily_vocabulary (date)`;
  await sql`
    CREATE TABLE IF NOT EXISTS vocabulary_words (
      id                   SERIAL PRIMARY KEY,
      daily_vocabulary_id  INTEGER NOT NULL REFERENCES daily_vocabulary(id) ON DELETE CASCADE,
      word                 TEXT NOT NULL,
      word_key             TEXT NOT NULL,
      part_of_speech       TEXT NOT NULL DEFAULT '',
      english_meaning      TEXT NOT NULL DEFAULT '',
      hindi_meaning        TEXT NOT NULL DEFAULT '',
      example_sentence     TEXT NOT NULL DEFAULT '',
      pronunciation        TEXT NOT NULL DEFAULT '',
      synonyms             TEXT NOT NULL DEFAULT '[]',
      usage_context        TEXT NOT NULL DEFAULT '',
      created_at           TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Migration: add columns that may be missing on existing deployments
  await sql`ALTER TABLE vocabulary_words ADD COLUMN IF NOT EXISTS usage_context TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE vocabulary_words ADD COLUMN IF NOT EXISTS word_key TEXT NOT NULL DEFAULT ''`;
  // Back-fill word_key for any pre-existing rows that were inserted before this column existed
  await sql`UPDATE vocabulary_words SET word_key = LOWER(TRIM(word)) WHERE word_key = ''`;
  // Unique index on word_key — the primary normalized uniqueness guarantee
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS vocabulary_words_word_key_uidx ON vocabulary_words (word_key)`;
  await sql`CREATE INDEX IF NOT EXISTS vocabulary_words_daily_vocabulary_id_idx ON vocabulary_words (daily_vocabulary_id)`;

  // Back-fill Hindi meanings for any rows where hindi_meaning was empty or fallback-copied from English word
  try {
    const badRows = (await sql`
      SELECT id, word FROM vocabulary_words 
      WHERE hindi_meaning = '' OR LOWER(TRIM(hindi_meaning)) = LOWER(TRIM(word))
    `) as { id: number; word: string }[];

    const { HINDI_DICTIONARY } = await import("./vocabulary-words");
    for (const row of badRows) {
      const key = row.word.toLowerCase().trim();
      const hindi = HINDI_DICTIONARY[key];
      if (hindi) {
        await sql`UPDATE vocabulary_words SET hindi_meaning = ${hindi} WHERE id = ${row.id}`;
      }
    }
  } catch (e) {
    console.error("Migration error back-filling Hindi meanings:", e);
  }
}

