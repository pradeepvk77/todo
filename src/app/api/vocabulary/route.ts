import { NextResponse } from "next/server";
import { getDailyVocabulary } from "@/app/actions/vocabulary";

export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;

  const data = await getDailyVocabulary(date);
  if (!data) {
    return NextResponse.json({ error: "No vocabulary for this date" }, { status: 404 });
  }
  return NextResponse.json(data);
}
