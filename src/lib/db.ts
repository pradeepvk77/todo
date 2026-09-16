import { neon } from "@neondatabase/serverless";
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

export const sql = neon(process.env.DATABASE_URL);

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

