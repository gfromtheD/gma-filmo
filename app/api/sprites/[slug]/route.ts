import { NextRequest, NextResponse } from "next/server";

const R2_BASE = "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug || !/^[\w-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  try {
    const res = await fetch(`${R2_BASE}/sprites/${slug}.vtt`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const text = await res.text();
    return new NextResponse(text, {
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Upstream error" }, { status: 502 });
  }
}
