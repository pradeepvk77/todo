/**
 * Practical English vocabulary word pool for the Daily Vocabulary feature.
 *
 * Selection criteria for every word:
 *  ✅ High real-world frequency (appears regularly in daily/professional English)
 *  ✅ Genuinely useful in conversations, emails, meetings, or writing
 *  ✅ Learner can realistically use the word today
 *  ✅ Transferable across multiple situations
 *  ❌ NOT selected merely because it is rare, academic, or sounds impressive
 */

export interface WordEntry {
  word: string;
  /** How / where the word is most usefully applied */
  context: string;
}

export const VOCABULARY_WORD_POOL: WordEntry[] = [
  // ── Conversation & expressing yourself ──────────────────────────────────────
  { word: "clarify",      context: "Conversations / Meetings" },
  { word: "mention",      context: "Conversations / Emails" },
  { word: "explain",      context: "Conversations / Teaching" },
  { word: "describe",     context: "Conversations / Writing" },
  { word: "express",      context: "Conversations / Emails" },
  { word: "admit",        context: "Conversations / Honesty" },
  { word: "agree",        context: "Conversations / Discussions" },
  { word: "disagree",     context: "Conversations / Discussions" },
  { word: "confirm",      context: "Emails / Meetings" },
  { word: "remind",       context: "Conversations / Emails" },
  { word: "respond",      context: "Emails / Conversations" },
  { word: "react",        context: "Conversations / Situations" },
  { word: "suggest",      context: "Conversations / Meetings" },
  { word: "recommend",    context: "Conversations / Advice" },
  { word: "prefer",       context: "Conversations / Choices" },
  { word: "insist",       context: "Conversations / Arguments" },
  { word: "hesitate",     context: "Conversations / Decisions" },
  { word: "assume",       context: "Conversations / Thinking" },
  { word: "realize",      context: "Conversations / Situations" },
  { word: "notice",       context: "Conversations / Observations" },

  // ── Workplace & professional communication ──────────────────────────────────
  { word: "prioritize",   context: "Workplace / Time Management" },
  { word: "coordinate",   context: "Workplace / Teams" },
  { word: "collaborate",  context: "Workplace / Teams" },
  { word: "delegate",     context: "Workplace / Management" },
  { word: "implement",    context: "Workplace / Projects" },
  { word: "evaluate",     context: "Workplace / Reviews" },
  { word: "schedule",     context: "Workplace / Planning" },
  { word: "deadline",     context: "Workplace / Projects" },
  { word: "feedback",     context: "Workplace / Reviews" },
  { word: "update",       context: "Workplace / Communication" },
  { word: "approach",     context: "Workplace / Problem Solving" },
  { word: "handle",       context: "Workplace / Situations" },
  { word: "manage",       context: "Workplace / Responsibilities" },
  { word: "address",      context: "Workplace / Issues" },
  { word: "resolve",      context: "Workplace / Problems" },
  { word: "achieve",      context: "Workplace / Goals" },
  { word: "deliver",      context: "Workplace / Results" },
  { word: "track",        context: "Workplace / Progress" },
  { word: "review",       context: "Workplace / Documents" },
  { word: "submit",       context: "Workplace / Tasks" },
  { word: "complete",     context: "Workplace / Tasks" },
  { word: "assign",       context: "Workplace / Teams" },
  { word: "report",       context: "Workplace / Communication" },
  { word: "present",      context: "Workplace / Meetings" },
  { word: "discuss",      context: "Workplace / Meetings" },
  { word: "involve",      context: "Workplace / Collaboration" },
  { word: "require",      context: "Workplace / Conditions" },
  { word: "ensure",       context: "Workplace / Quality" },
  { word: "approve",      context: "Workplace / Decisions" },
  { word: "reject",       context: "Workplace / Decisions" },
  { word: "propose",      context: "Workplace / Meetings" },

  // ── Emails & written communication ─────────────────────────────────────────
  { word: "attach",       context: "Emails / Documents" },
  { word: "forward",      context: "Emails / Communication" },
  { word: "summarize",    context: "Emails / Reports" },
  { word: "outline",      context: "Emails / Planning" },
  { word: "draft",        context: "Emails / Writing" },
  { word: "acknowledge",  context: "Emails / Responses" },
  { word: "request",      context: "Emails / Communication" },
  { word: "provide",      context: "Emails / Information" },
  { word: "refer",        context: "Emails / Documents" },
  { word: "include",      context: "Emails / Details" },
  { word: "exclude",      context: "Emails / Conditions" },

  // ── Describing quality & performance ────────────────────────────────────────
  { word: "accurate",     context: "Descriptions / Work Quality" },
  { word: "reliable",     context: "Descriptions / People / Products" },
  { word: "efficient",    context: "Descriptions / Work / Systems" },
  { word: "flexible",     context: "Descriptions / Schedules / People" },
  { word: "relevant",     context: "Descriptions / Information" },
  { word: "effective",    context: "Descriptions / Methods / People" },
  { word: "appropriate",  context: "Descriptions / Behavior / Content" },
  { word: "reasonable",   context: "Descriptions / Decisions / Requests" },
  { word: "significant",  context: "Descriptions / Importance" },
  { word: "specific",     context: "Descriptions / Instructions" },
  { word: "available",    context: "Descriptions / Schedules / Items" },
  { word: "necessary",    context: "Descriptions / Requirements" },
  { word: "suitable",     context: "Descriptions / Choices / Options" },
  { word: "consistent",   context: "Descriptions / Behavior / Work" },
  { word: "practical",    context: "Descriptions / Solutions / Ideas" },
  { word: "capable",      context: "Descriptions / People / Skills" },
  { word: "responsible",  context: "Descriptions / People / Tasks" },
  { word: "productive",   context: "Descriptions / Work / Days" },
  { word: "confident",    context: "Descriptions / People / Tone" },
  { word: "thorough",     context: "Descriptions / Work / Reviews" },

  // ── Decisions & thinking ────────────────────────────────────────────────────
  { word: "consider",     context: "Thinking / Decisions" },
  { word: "decide",       context: "Decisions / Actions" },
  { word: "determine",    context: "Decisions / Analysis" },
  { word: "justify",      context: "Decisions / Arguments" },
  { word: "analyze",      context: "Thinking / Research" },
  { word: "identify",     context: "Thinking / Problem Solving" },
  { word: "compare",      context: "Thinking / Choices" },
  { word: "predict",      context: "Thinking / Planning" },
  { word: "estimate",     context: "Thinking / Planning" },
  { word: "examine",      context: "Thinking / Research" },
  { word: "verify",       context: "Thinking / Checking" },
  { word: "anticipate",   context: "Thinking / Planning" },
  { word: "reflect",      context: "Thinking / Self-Improvement" },
  { word: "reconsider",   context: "Thinking / Decisions" },
  { word: "evaluate",     context: "Thinking / Assessment" },

  // ── Describing situations & problems ────────────────────────────────────────
  { word: "concern",      context: "Situations / Issues" },
  { word: "issue",        context: "Situations / Problems" },
  { word: "challenge",    context: "Situations / Difficulties" },
  { word: "obstacle",     context: "Situations / Problems" },
  { word: "opportunity",  context: "Situations / Possibilities" },
  { word: "situation",    context: "Situations / Context" },
  { word: "condition",    context: "Situations / Circumstances" },
  { word: "impact",       context: "Situations / Effects" },
  { word: "consequence",  context: "Situations / Effects" },
  { word: "benefit",      context: "Situations / Advantages" },
  { word: "risk",         context: "Situations / Planning" },
  { word: "limitation",   context: "Situations / Constraints" },
  { word: "pressure",     context: "Situations / Stress" },
  { word: "progress",     context: "Situations / Work" },
  { word: "outcome",      context: "Situations / Results" },
  { word: "result",       context: "Situations / Work" },

  // ── Growth & action ─────────────────────────────────────────────────────────
  { word: "improve",      context: "Growth / Work" },
  { word: "develop",      context: "Growth / Skills / Projects" },
  { word: "learn",        context: "Growth / Education" },
  { word: "adapt",        context: "Growth / Change" },
  { word: "adjust",       context: "Growth / Change" },
  { word: "grow",         context: "Growth / Skills" },
  { word: "focus",        context: "Growth / Productivity" },
  { word: "commit",       context: "Growth / Goals" },
  { word: "motivate",     context: "Growth / Teams" },
  { word: "encourage",    context: "Growth / People" },
  { word: "support",      context: "Growth / Teams / People" },
  { word: "maintain",     context: "Growth / Consistency" },
  { word: "sustain",      context: "Growth / Effort" },
  { word: "overcome",     context: "Growth / Challenges" },
  { word: "persist",      context: "Growth / Effort" },
  { word: "prepare",      context: "Growth / Planning" },
  { word: "practice",     context: "Growth / Learning" },

  // ── Relationships & teamwork ─────────────────────────────────────────────────
  { word: "communicate",  context: "Teamwork / Relationships" },
  { word: "cooperate",    context: "Teamwork / Groups" },
  { word: "negotiate",    context: "Teamwork / Business" },
  { word: "convince",     context: "Teamwork / Communication" },
  { word: "persuade",     context: "Teamwork / Arguments" },
  { word: "appreciate",   context: "Relationships / Gratitude" },
  { word: "respect",      context: "Relationships / Values" },
  { word: "trust",        context: "Relationships / Teams" },
  { word: "depend",       context: "Relationships / Reliability" },
  { word: "assist",       context: "Relationships / Help" },
  { word: "share",        context: "Relationships / Information" },
  { word: "involve",      context: "Relationships / Inclusion" },
  { word: "engage",       context: "Relationships / Participation" },
  { word: "connect",      context: "Relationships / People" },

  // ── Describing time & tasks ──────────────────────────────────────────────────
  { word: "urgent",       context: "Time / Tasks" },
  { word: "delay",        context: "Time / Planning" },
  { word: "postpone",     context: "Time / Planning" },
  { word: "immediate",    context: "Time / Urgency" },
  { word: "temporary",    context: "Time / Situations" },
  { word: "permanent",    context: "Time / Situations" },
  { word: "frequent",     context: "Time / Patterns" },
  { word: "occasional",   context: "Time / Patterns" },
  { word: "ongoing",      context: "Time / Projects" },
  { word: "upcoming",     context: "Time / Planning" },
  { word: "current",      context: "Time / Status" },
  { word: "previous",     context: "Time / History" },

  // ── Common adjectives for professional context ───────────────────────────────
  { word: "brief",        context: "Writing / Communication" },
  { word: "clear",        context: "Writing / Communication" },
  { word: "direct",       context: "Communication / Tone" },
  { word: "detailed",     context: "Writing / Instructions" },
  { word: "thorough",     context: "Work / Quality" },
  { word: "formal",       context: "Communication / Tone" },
  { word: "informal",     context: "Communication / Tone" },
  { word: "positive",     context: "Attitude / Communication" },
  { word: "critical",     context: "Thinking / Feedback" },
  { word: "objective",    context: "Thinking / Decisions" },
  { word: "transparent",  context: "Communication / Trust" },
  { word: "straightforward", context: "Communication / Clarity" },

  // ── Slightly advanced but highly practical ───────────────────────────────────
  { word: "acknowledge",  context: "Emails / Conversations" },
  { word: "emphasize",    context: "Communication / Presentations" },
  { word: "highlight",    context: "Communication / Reports" },
  { word: "indicate",     context: "Communication / Data" },
  { word: "demonstrate",  context: "Communication / Work" },
  { word: "establish",    context: "Workplace / Processes" },
  { word: "initiate",     context: "Workplace / Projects" },
  { word: "monitor",      context: "Workplace / Progress" },
  { word: "optimize",     context: "Workplace / Efficiency" },
  { word: "simplify",     context: "Work / Communication" },
  { word: "streamline",   context: "Work / Processes" },
  { word: "facilitate",   context: "Meetings / Collaboration" },
  { word: "contribute",   context: "Teamwork / Projects" },
  { word: "achieve",      context: "Goals / Work" },
  { word: "generate",     context: "Work / Ideas" },
  { word: "integrate",    context: "Work / Systems" },
  { word: "coordinate",   context: "Work / Teams" },
  { word: "allocate",     context: "Work / Resources" },
  { word: "document",     context: "Work / Records" },
  { word: "validate",     context: "Work / Quality" },
];

/**
 * Returns a deterministic but shuffled list of word candidates for a given date (YYYY-MM-DD),
 * excluding words that have already been used on previous days.
 *
 * The same date always produces the same shuffle order, ensuring
 * if generation is retried on the same day the same candidates are tried first.
 */
export function getWordCandidatesForDate(
  date: string,
  usedWords: Set<string>
): WordEntry[] {
  // Simple seeded value from the date characters
  const seed = date.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  const available = VOCABULARY_WORD_POOL.filter(
    (entry) => !usedWords.has(entry.word.toLowerCase())
  );

  // Fisher-Yates shuffle with LCG-based seeded random
  const arr = [...available];
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}
