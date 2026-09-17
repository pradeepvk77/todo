import { getAllReleases } from "@/lib/release-notes";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { Sparkles, CheckCircle2, Calendar, ArrowLeft, Wrench } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "What's New | Todo App",
  description: "See the latest features, improvements, and updates.",
};

export default async function WhatsNewPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const releases = getAllReleases();

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/30 flex items-center justify-center">
              <Sparkles className="size-6 text-violet-500" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
                What&apos;s New
              </h1>
              <p className="text-sm text-muted-foreground">
                All updates and improvements, newest first
              </p>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-violet-500 inline-block" />
              Major release
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-slate-400 inline-block" />
              Minor update / fixes
            </span>
          </div>

          <div className="h-px bg-gradient-to-r from-violet-500/40 via-purple-500/20 to-transparent" />
        </div>

        {/* Release cards */}
        {releases.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-10 text-center space-y-2">
            <Sparkles className="size-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground font-medium">No releases yet. Stay tuned!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {releases.map((release, idx) => {
              const isMajor = release.releaseType === "major";
              const isLatest = idx === 0;

              return (
                <article
                  key={release.version}
                  className={`rounded-2xl border bg-card overflow-hidden transition-shadow hover:shadow-md ${
                    isMajor
                      ? isLatest
                        ? "border-violet-500/30 shadow-xs"
                        : "border-border/60 shadow-xs"
                      : "border-border/40 shadow-none"
                  }`}
                >
                  {/* Top color strip — only for major releases */}
                  {isMajor && (
                    <div
                      className={`h-1 w-full ${
                        isLatest
                          ? "bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500"
                          : "bg-gradient-to-r from-slate-400 to-slate-500"
                      }`}
                    />
                  )}

                  <div className={`p-5 space-y-3 ${!isMajor ? "py-4" : ""}`}>
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Icon for minor */}
                          {!isMajor && (
                            <Wrench className="size-3.5 text-muted-foreground flex-shrink-0" />
                          )}

                          <h2
                            className={`font-extrabold text-foreground tracking-tight ${
                              isMajor ? "text-base" : "text-sm"
                            }`}
                          >
                            {release.title}
                          </h2>

                          {/* Version badge */}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase ${
                              isMajor && isLatest
                                ? "bg-violet-500/15 text-violet-500 border-violet-500/25"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {release.version}
                          </span>

                          {/* Latest badge */}
                          {isLatest && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/25 tracking-wide uppercase">
                              Latest
                            </span>
                          )}

                          {/* Minor tag */}
                          {!isMajor && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 border border-slate-500/20 tracking-wide uppercase">
                              Minor
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="size-3" />
                          <time dateTime={release.releaseDate}>
                            {new Date(release.releaseDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </time>
                        </div>
                      </div>
                    </div>

                    {/* Feature list */}
                    <ul className={`space-y-1.5 ${!isMajor ? "space-y-1" : ""}`}>
                      {release.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm">
                          <CheckCircle2
                            className={`size-4 mt-0.5 flex-shrink-0 ${
                              isMajor && isLatest
                                ? "text-emerald-500"
                                : "text-muted-foreground"
                            }`}
                          />
                          <span
                            className={`leading-snug ${
                              isMajor ? "text-foreground/85" : "text-muted-foreground text-xs"
                            }`}
                          >
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
