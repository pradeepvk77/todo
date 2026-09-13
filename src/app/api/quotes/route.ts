const ZEN_QUOTES_URL = "https://zenquotes.io/api/quotes";

type ZenQuote = { q?: unknown; a?: unknown };

export async function GET() {
  try {
    const response = await fetch(ZEN_QUOTES_URL, { cache: "no-store" });
    if (!response.ok) {
      return Response.json({ error: "Unable to load quotes" }, { status: 502 });
    }

    const data = (await response.json()) as ZenQuote[];
    const quotes = Array.isArray(data)
      ? data
          .filter((quote): quote is { q: string; a: string } => typeof quote.q === "string" && typeof quote.a === "string")
          .map(({ q, a }) => ({ text: q, author: a }))
          .slice(0, 50)
      : [];

    if (!quotes.length) {
      return Response.json({ error: "Unable to load quotes" }, { status: 502 });
    }

    return Response.json({ quotes });
  } catch {
    return Response.json({ error: "Unable to load quotes" }, { status: 502 });
  }
}
