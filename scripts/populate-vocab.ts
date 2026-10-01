import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { neon } from "@neondatabase/serverless";
import {
  VOCABULARY_WORD_POOL,
  getWordCandidatesForDate,
  getFallbackWordDetails,
  HINDI_DICTIONARY,
  WordEntry,
} from "../src/lib/vocabulary-words";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(process.env.DATABASE_URL);

function normalizeWordKey(word: string): string {
  return word.toLowerCase().trim();
}

function getWordStem(word: string): string {
  const w = normalizeWordKey(word);
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
  ];
  for (const s of suffixes) {
    if (w.endsWith(s) && w.length - s.length >= 4) {
      return w.slice(0, w.length - s.length);
    }
  }
  return w;
}

function isWordFamilyConflict(candidateWord: string, existingStems: Set<string>): boolean {
  const candidateStem = getWordStem(candidateWord);
  return existingStems.has(candidateStem);
}

interface DictionaryApiEntry {
  phonetics?: { text?: string }[];
  meanings?: {
    partOfSpeech?: string;
    definitions?: { definition?: string; example?: string; synonyms?: string[] }[];
    synonyms?: string[];
  }[];
}

async function fetchDictionaryData(word: string) {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (res.ok) {
      const data = (await res.json()) as DictionaryApiEntry[];
      const entry = data[0];
      if (entry) {
        const pronunciation = entry.phonetics?.find((p) => p.text)?.text ?? "";
        const firstMeaning = entry.meanings?.[0];
        if (firstMeaning) {
          const partOfSpeech = firstMeaning.partOfSpeech ?? "";
          const firstDef = firstMeaning.definitions?.[0];
          const englishMeaning = firstDef?.definition ?? "";
          const exampleSentence = firstDef?.example ?? "";

          const synonymsFromMeaning = firstMeaning.synonyms ?? [];
          const synonymsFromDef = firstDef?.synonyms ?? [];
          const synonyms = [...new Set([...synonymsFromMeaning, ...synonymsFromDef])]
            .slice(0, 4)
            .map((s) => String(s));

          if (englishMeaning) {
            return { partOfSpeech, englishMeaning, exampleSentence, pronunciation, synonyms };
          }
        }
      }
    }
  } catch {}

  const fallback = getFallbackWordDetails(word);
  return {
    partOfSpeech: fallback.partOfSpeech,
    englishMeaning: fallback.englishMeaning,
    exampleSentence: fallback.exampleSentence,
    pronunciation: fallback.pronunciation,
    synonyms: fallback.synonyms,
  };
}

async function fetchHindiMeaning(word: string): Promise<string> {
  const key = word.toLowerCase().trim();
  if (HINDI_DICTIONARY[key]) {
    return HINDI_DICTIONARY[key];
  }

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|hi`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = (await res.json()) as {
        responseStatus?: number;
        responseData?: { translatedText?: string };
      };

      if (data.responseStatus === 200) {
        const translated = data.responseData?.translatedText ?? "";
        if (translated && normalizeWordKey(translated) !== normalizeWordKey(word)) {
          return translated;
        }
      }
    }
  } catch {}

  const fallback = getFallbackWordDetails(word);
  return fallback.hindiMeaning || word;
}

async function generateDate(date: string) {
  console.log(`\n================ Processing ${date} ================`);

  // Ensure any empty placeholder row for this date is cleaned up first
  const existingRows = await sql`SELECT id FROM daily_vocabulary WHERE date = ${date}`;
  if (existingRows.length > 0) {
    for (const r of existingRows) {
      await sql`DELETE FROM vocabulary_words WHERE daily_vocabulary_id = ${r.id}`;
      await sql`DELETE FROM daily_vocabulary WHERE id = ${r.id}`;
    }
    console.log(`Cleaned existing rows for ${date}`);
  }

  const usedRows = (await sql`
    SELECT word, word_key FROM vocabulary_words
  `) as { word: string; word_key: string }[];

  const usedWordKeys = new Set(usedRows.map((r) => r.word_key || normalizeWordKey(r.word)));
  const usedStems = new Set(
    usedRows.map((r) => getWordStem(r.word_key || normalizeWordKey(r.word)))
  );

  console.log(`Current DB contains ${usedWordKeys.size} distinct words.`);

  const candidates = getWordCandidatesForDate(date, usedWordKeys);
  console.log(`Found ${candidates.length} candidates from pool for ${date}.`);

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
    if (collected.length >= 20) break;
    const wordKey = normalizeWordKey(candidate.word);
    if (usedWordKeys.has(wordKey)) continue;
    if (collected.some((c) => c.wordKey === wordKey)) continue;
    if (isWordFamilyConflict(wordKey, usedStems)) continue;
    const candidateStem = getWordStem(wordKey);
    if (collected.some((c) => getWordStem(c.wordKey) === candidateStem)) continue;

    const dictData = await fetchDictionaryData(candidate.word);
    const hindiMeaning = await fetchHindiMeaning(candidate.word);

    collected.push({
      entry: candidate,
      wordKey,
      partOfSpeech: dictData.partOfSpeech || "verb",
      englishMeaning: dictData.englishMeaning || `Essential vocabulary for ${candidate.context}.`,
      hindiMeaning: hindiMeaning || candidate.word,
      exampleSentence: dictData.exampleSentence || `Using "${candidate.word}" improves communication.`,
      pronunciation: dictData.pronunciation || `/${candidate.word}/`,
      synonyms: dictData.synonyms || [],
    });
    process.stdout.write(`  Collected ${collected.length}/20: ${candidate.word}\r`);
  }

  // Fallback if needed
  if (collected.length < 20) {
    for (const candidate of candidates) {
      if (collected.length >= 20) break;
      const wordKey = normalizeWordKey(candidate.word);
      if (collected.some((c) => c.wordKey === wordKey)) continue;
      const fb = getFallbackWordDetails(candidate.word);
      collected.push({
        entry: candidate,
        wordKey,
        partOfSpeech: fb.partOfSpeech,
        englishMeaning: fb.englishMeaning,
        hindiMeaning: fb.hindiMeaning,
        exampleSentence: fb.exampleSentence,
        pronunciation: fb.pronunciation,
        synonyms: fb.synonyms,
      });
    }
  }

  console.log(`\nInserting ${collected.length} words for ${date}...`);

  const [inserted] = (await sql`
    INSERT INTO daily_vocabulary (date)
    VALUES (${date})
    ON CONFLICT (date) DO UPDATE SET date = EXCLUDED.date
    RETURNING id
  `) as { id: number }[];

  const dailyVocabId = inserted.id;

  for (const w of collected) {
    await sql`
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
      ON CONFLICT (daily_vocabulary_id, word_key) DO NOTHING
    `;
  }

  const countRow = await sql`
    SELECT count(*) as count FROM vocabulary_words WHERE daily_vocabulary_id = ${dailyVocabId}
  `;
  console.log(`Successfully populated ${date}: ${countRow[0].count} words saved (ID: ${dailyVocabId}).`);
}

async function main() {
  const dates = [
    "2026-09-27",
    "2026-09-28",
    "2026-09-29",
    "2026-09-30",
    "2026-10-01", // today
  ];

  for (const d of dates) {
    await generateDate(d);
  }

  console.log("\nAll requested dates populated successfully!");
}

main().catch(console.error);
