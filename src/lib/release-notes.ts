/**
 * RELEASE NOTES — edit this file before every deploy.
 *
 * releaseType:
 *   "major" → shows the "What's New" modal on the dashboard + sends push (if enabled)
 *   "minor" → sends push notification only — no modal, no interruption
 *
 * sendPushNotification:
 *   true  → push is sent to all subscribers on the next deploy (exactly once)
 *   false → no push sent (silent deploy)
 *
 * Push idempotency: tracked in the `release_notifications` DB table.
 * All display reads come purely from this file — zero DB queries.
 */

export type ReleaseType = "major" | "minor";

export interface ReleaseNote {
  /** Semver-style version string, e.g. "v1.2". Must be unique across ALL releases. */
  version: string;
  /** Human-readable release title shown in the modal and /whats-new page. */
  title: string;
  /** ISO date string, e.g. "2026-09-17". */
  releaseDate: string;
  /**
   * "major" → modal shown on dashboard + push notification
   * "minor" → push notification only, never shows in modal
   */
  releaseType: ReleaseType;
  /** Bullet-point list of changes. Keep short for minor releases. */
  features: string[];
  /** Set true to fire a push notification to all subscribers on deploy. */
  sendPushNotification: boolean;
}

// ─── ADD NEW RELEASES AT THE TOP ─────────────────────────────────────────────

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "v1.1",
    title: "New Features & Analytics Upgrades 🚀",
    releaseDate: "2026-09-17",
    releaseType: "major",
    features: [
      "Added Day Off option so your performance consistency isn't affected on rest days",
      "Increased daily English vocabulary words from 5 to 20 to boost learning",
      "Added precise task analytics and date range controls to pinpoint performance trends",
      "Added Quick Complete button on Dashboard Running Task card for instant action",
      "Added Running Task performance analytics directly on your dashboard",
    ],
    sendPushNotification: true,
  },
  {
    version: "v1.0",
    title: "First Release 🚀",
    releaseDate: "2026-09-17",
    releaseType: "major",
    features: [
      "Daily vocabulary words with Hindi meanings",
      "Push notifications for tasks",
      "Task analytics and streaks",
      "Missed task review flow",
      "Dark mode support",
    ],
    sendPushNotification: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────

/** Latest major release — used by the dashboard modal. Returns null if none. */
export function getLatestMajorRelease(): ReleaseNote | null {
  return RELEASE_NOTES.find((r) => r.releaseType === "major") ?? null;
}

/** All releases (major + minor), newest first. Used by /whats-new page. */
export function getAllReleases(): ReleaseNote[] {
  return RELEASE_NOTES;
}
