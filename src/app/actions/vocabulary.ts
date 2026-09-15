"use server";

import { sql, initVocabularyTables, VocabularyWord } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getISTDateString } from "@/lib/time-utils";
import { getWordCandidatesForDate, WordEntry } from "@/lib/vocabulary-words";

let vocabDbInitialized = false;
async function ensureVocabDb() {
  if (!vocabDbInitialized) {
    try {
      await initVocabularyTables();
      vocabDbInitialized = true;
    } catch (error) {
      console.error("Failed to initialize vocabulary tables:", error);
    }
  }
}

export interface VocabularyWordData {
  id: number;
  word: string;
  partOfSpeech: string;
  englishMeaning: string;
  hindiMeaning: string;
  exampleSentence: string;
  pronunciation: string;
  synonyms: string[];
  usageContext: string;
}

export interface DailyVocabularyData {
  date: string;
  words: VocabularyWordData[];
}

// ─── Word normalization ────────────────────────────────────────────────────────

/**
 * Normalizes a word to a canonical key for uniqueness checking.
 * "Clarify", "clarify", "CLARIFY", " clarify " → "clarify"
 */
function normalizeWordKey(word: string): string {
  return word.toLowerCase().trim();
}

/**
 * Strips common English inflectional/derivational suffixes to produce a root stem.
 * Used to detect word-family duplicates (improve → improvement, communicate → communication).
 *
 * This is intentionally conservative: only strips well-known suffixes and requires
 * the stem to be at least 4 characters long so short words are never over-stemmed.
 */
function getWordStem(word: string): string {
  const w = normalizeWordKey(word);

  // Ordered from longest to shortest so the most specific suffix is stripped first
  const suffixes = [
    "ization", "isation",
    "ational", "fulness", "lessness",
    "ication", "ousness",
    "ation", "ition", "tion", "sion",
    "ment", "ness", "ful", "less",
    "able", "ible", "ive", "ize", "ise", "ify",
    "ing", "ion", "ent", "ant",
    "ence", "ance", "al", "ic",
    "ed", "er", "ly",
    "s",
  ];

  for (const suffix of suffixes) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 4) {
      return w.slice(0, w.length - suffix.length);
    }
  }
  return w;
}

/**
 * Returns true if 'candidate' is a word-family duplicate of any already-used stem.
 *
 * Example: if "communicate" was taught yesterday, "communication" has the same
 * stem ("communicat") and would be rejected.
 *
 * The check is deliberately lenient: stems must be identical (not just similar)
 * to avoid over-rejection of genuinely different words.
 */
function isWordFamilyConflict(candidate: string, usedStems: Set<string>): boolean {
  const stem = getWordStem(candidate);
  // A stem shorter than 4 chars is too ambiguous — skip the family check
  if (stem.length < 4) return false;
  return usedStems.has(stem);
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

function parseWord(row: VocabularyWord): VocabularyWordData {
  let synonyms: string[] = [];
  try {
    synonyms = JSON.parse(row.synonyms) as string[];
  } catch {
    synonyms = [];
  }
  return {
    id: row.id,
    word: row.word,
    partOfSpeech: row.part_of_speech,
    englishMeaning: row.english_meaning,
    hindiMeaning: row.hindi_meaning,
    exampleSentence: row.example_sentence,
    pronunciation: row.pronunciation,
    synonyms,
    usageContext: row.usage_context ?? "",
  };
}

// ─── Public server actions ────────────────────────────────────────────────────

/**
 * Returns the vocabulary set for a given date (defaults to today in IST).
 * If today's set doesn't exist yet, it triggers generation automatically.
 * Past dates that have no data return null (they are never auto-generated).
 */
export async function getDailyVocabulary(
  date?: string
): Promise<DailyVocabularyData | null> {
  try {
    await ensureVocabDb();
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const targetDate = date ?? getISTDateString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return null;

    // Fast path: return existing data from DB (no API calls)
    const [existing] = (await sql`
      SELECT id FROM daily_vocabulary WHERE date = ${targetDate}
    `) as { id: number }[];

    if (existing) {
      const words = (await sql`
        SELECT * FROM vocabulary_words
        WHERE daily_vocabulary_id = ${existing.id}
        ORDER BY id ASC
      `) as VocabularyWord[];
      return { date: targetDate, words: words.map(parseWord) };
    }

    // Only generate for today — never auto-generate historical dates
    const today = getISTDateString();
    if (targetDate !== today) return null;

    return await generateAndSaveDailyVocabulary(targetDate);
  } catch (error) {
    console.error("Failed to get daily vocabulary:", error);
    return null;
  }
}

/**
 * Returns a list of all dates that have saved vocabulary, newest first.
 */
export async function getVocabularyHistory(): Promise<string[]> {
  try {
    await ensureVocabDb();
    const session = await getSession();
    if (!session) return [];

    const rows = (await sql`
      SELECT date FROM daily_vocabulary ORDER BY date DESC
    `) as { date: string }[];

    return rows.map((r) => r.date);
  } catch (error) {
    console.error("Failed to get vocabulary history:", error);
    return [];
  }
}

export interface AllVocabularyWordData extends VocabularyWordData {
  date: string;
}

/**
 * Returns all saved vocabulary words across all dates.
 */
export async function getAllVocabularyWords(): Promise<AllVocabularyWordData[]> {
  try {
    await ensureVocabDb();
    const session = await getSession();
    if (!session) return [];

    const rows = (await sql`
      SELECT w.*, v.date
      FROM vocabulary_words w
      JOIN daily_vocabulary v ON w.daily_vocabulary_id = v.id
      ORDER BY v.date DESC, w.id ASC
    `) as (VocabularyWord & { date: string })[];

    return rows.map((row) => ({
      ...parseWord(row),
      date: row.date,
    }));
  } catch (error) {
    console.error("Failed to get all vocabulary words:", error);
    return [];
  }
}

// ─── Internal generation ──────────────────────────────────────────────────────

interface DictionaryApiPhonetic { text?: string; }
interface DictionaryApiDefinition { definition?: string; example?: string; synonyms?: string[]; }
interface DictionaryApiMeaning { partOfSpeech?: string; definitions?: DictionaryApiDefinition[]; synonyms?: string[]; }
interface DictionaryApiEntry { phonetics?: DictionaryApiPhonetic[]; meanings?: DictionaryApiMeaning[]; }

async function fetchDictionaryData(word: string): Promise<{
  partOfSpeech: string;
  englishMeaning: string;
  exampleSentence: string;
  pronunciation: string;
  synonyms: string[];
} | null> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as DictionaryApiEntry[];
    const entry = data[0];
    if (!entry) return null;

    const pronunciation = entry.phonetics?.find((p) => p.text)?.text ?? "";
    const firstMeaning = entry.meanings?.[0];
    if (!firstMeaning) return null;

    const partOfSpeech = firstMeaning.partOfSpeech ?? "";
    const firstDef = firstMeaning.definitions?.[0];
    const englishMeaning = firstDef?.definition ?? "";
    const exampleSentence = firstDef?.example ?? "";

    const synonymsFromMeaning = firstMeaning.synonyms ?? [];
    const synonymsFromDef = firstDef?.synonyms ?? [];
    const synonyms = [...new Set([...synonymsFromMeaning, ...synonymsFromDef])]
      .slice(0, 4)
      .map((s) => String(s));

    if (!englishMeaning) return null;
    return { partOfSpeech, englishMeaning, exampleSentence, pronunciation, synonyms };
  } catch {
    return null;
  }
}

async function fetchHindiMeaning(word: string): Promise<string> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|hi`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return "";

    const data = (await res.json()) as {
      responseStatus?: number;
      responseData?: { translatedText?: string };
    };

    if (data.responseStatus !== 200) return "";
    const translated = data.responseData?.translatedText ?? "";
    if (normalizeWordKey(translated) === normalizeWordKey(word)) return "";
    return translated;
  } catch {
    return "";
  }
}

/**
 * Quality filter: rejects a word if its dictionary definition signals it is
 * archaic, obsolete, literary, or too specialized for everyday use.
 */
function isPracticalWord(englishMeaning: string, partOfSpeech: string): boolean {
  if (!englishMeaning || englishMeaning.length < 10) return false;

  const lower = englishMeaning.toLowerCase();
  const rejectMarkers = [
    "archaic", "obsolete", "literary", "rare usage", "historical",
    "technical term", "botany", "zoology", "heraldry", "poetic",
    "old-fashioned", "dated usage",
  ];
  if (rejectMarkers.some((m) => lower.includes(m))) return false;

  const validPos = ["noun", "verb", "adjective", "adverb", "preposition", "conjunction"];
  if (partOfSpeech && !validPos.includes(partOfSpeech.toLowerCase())) return false;

  return true;
}

/**
 * Core daily generation function.
 *
 * Steps:
 *  1. Query all previously used word_keys and their stems from DB.
 *  2. Get a deterministically shuffled candidate list for this date.
 *  3. For each candidate:
 *     a. Skip if word_key already in DB (exact duplicate).
 *     b. Skip if word stem already in DB (word-family duplicate).
 *     c. Fetch dictionary definition.
 *     d. Run quality/practicality validation.
 *     e. Fetch Hindi meaning.
 *  4. After collecting exactly 5 valid words, insert daily_vocabulary row.
 *  5. Insert all 5 vocabulary_words in a try/catch; roll back parent on failure.
 */
async function generateAndSaveDailyVocabulary(
  date: string
): Promise<DailyVocabularyData | null> {
  // ── 1. Load all previously used words from DB ────────────────────────────
  const usedRows = (await sql`
    SELECT word, word_key FROM vocabulary_words
  `) as { word: string; word_key: string }[];

  // Exact normalized keys already in DB
  const usedWordKeys = new Set(usedRows.map((r) => r.word_key || normalizeWordKey(r.word)));

  // Stems of words already in DB (for word-family deduplication)
  const usedStems = new Set(
    usedRows.map((r) => getWordStem(r.word_key || normalizeWordKey(r.word)))
  );

  // ── 2. Get shuffled candidates for this date ─────────────────────────────
  const candidates = getWordCandidatesForDate(date, usedWordKeys);

  // ── 3. Collect 5 valid words ─────────────────────────────────────────────
  type Collected = {
    entry: WordEntry;
    wordKey: string;
    partOfSpeech: string;
    englishMeaning: string;
    hindiMeaning: string;
    exampleSentence: string;
    pronunciation: string;
    synonyms: string[];
  };
  const collected: Collected[] = [];

  for (const candidate of candidates) {
    if (collected.length >= 5) break;

    const wordKey = normalizeWordKey(candidate.word);

    // a. Exact duplicate check (app layer — DB unique index is the backstop)
    if (usedWordKeys.has(wordKey)) continue;
    // Also check against words we're already collecting this session
    if (collected.some((c) => c.wordKey === wordKey)) continue;

    // b. Word-family duplicate check
    if (isWordFamilyConflict(wordKey, usedStems)) continue;
    // Also check against stems we're already collecting this session
    const candidateStem = getWordStem(wordKey);
    if (collected.some((c) => getWordStem(c.wordKey) === candidateStem)) continue;

    // c. Dictionary lookup
    const dictData = await fetchDictionaryData(candidate.word);
    if (!dictData) continue;

    // d. Quality validation
    if (!isPracticalWord(dictData.englishMeaning, dictData.partOfSpeech)) continue;

    // e. Hindi meaning (failure is non-blocking — we still save the word)
    const hindiMeaning = await fetchHindiMeaning(candidate.word);

    collected.push({
      entry: candidate,
      wordKey,
      partOfSpeech: dictData.partOfSpeech,
      englishMeaning: dictData.englishMeaning,
      hindiMeaning,
      exampleSentence: dictData.exampleSentence,
      pronunciation: dictData.pronunciation,
      synonyms: dictData.synonyms,
    });
  }

  if (collected.length < 5) {
    console.error(
      `Vocabulary generation failed: only ${collected.length}/5 words found for ${date}`
    );
    return null;
  }

  // ── 4. Insert daily_vocabulary (UPSERT handles concurrent race conditions) ─
  let dailyVocabId: number;
  try {
    const [inserted] = (await sql`
      INSERT INTO daily_vocabulary (date)
      VALUES (${date})
      ON CONFLICT (date) DO UPDATE SET date = EXCLUDED.date
      RETURNING id
    `) as { id: number }[];
    dailyVocabId = inserted.id;
  } catch (error) {
    console.error("Failed to insert daily_vocabulary row:", error);
    return null;
  }

  // ── 5. Insert 5 words; roll back parent on failure ───────────────────────
  const savedWords: VocabularyWordData[] = [];
  try {
    for (const w of collected) {
      // ON CONFLICT (word_key) is the DB-level duplicate guard
      const [row] = (await sql`
        INSERT INTO vocabulary_words (
          daily_vocabulary_id, word, word_key, part_of_speech, english_meaning,
          hindi_meaning, example_sentence, pronunciation, synonyms, usage_context
        ) VALUES (
          ${dailyVocabId},
          ${w.entry.word},
          ${w.wordKey},
          ${w.partOfSpeech},
          ${w.englishMeaning},
          ${w.hindiMeaning},
          ${w.exampleSentence},
          ${w.pronunciation},
          ${JSON.stringify(w.synonyms)},
          ${w.entry.context}
        )
        ON CONFLICT (word_key) DO NOTHING
        RETURNING *
      `) as VocabularyWord[];

      if (row) savedWords.push(parseWord(row));
    }
  } catch (error) {
    console.error("Failed to insert vocabulary words, rolling back:", error);
    try {
      await sql`DELETE FROM daily_vocabulary WHERE id = ${dailyVocabId}`;
    } catch (rb) {
      console.error("Failed to rollback daily_vocabulary row:", rb);
    }
    return null;
  }

  // If some words were skipped by the DB conflict guard, re-fetch the full set
  if (savedWords.length < 5) {
    const allWords = (await sql`
      SELECT * FROM vocabulary_words
      WHERE daily_vocabulary_id = ${dailyVocabId}
      ORDER BY id ASC
    `) as VocabularyWord[];
    return { date, words: allWords.map(parseWord) };
  }

  return { date, words: savedWords };
}
