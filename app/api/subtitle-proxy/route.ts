import { NextRequest, NextResponse } from "next/server";

function srtToVtt(text: string): string {
  const normalized = text.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Replace SRT comma millisecond separator with VTT period
  const body = normalized.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return "WEBVTT\n\n" + body;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  // Only allow fetching from our R2 bucket domain
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const allowed = process.env.R2_PUBLIC_DOMAIN ?? process.env.NEXT_PUBLIC_R2_DOMAIN;
  if (allowed && parsed.hostname !== new URL(allowed.startsWith("http") ? allowed : `https://${allowed}`).hostname) {
    return NextResponse.json({ error: "Unauthorized domain" }, { status: 403 });
  }

  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: 86400 } });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }

  if (!res.ok) return NextResponse.json({ error: "Upstream error" }, { status: 502 });

  const text = await res.text();
  const isVtt = text.trimStart().startsWith("WEBVTT");
  const vtt   = isVtt ? text : srtToVtt(text);

  return new NextResponse(vtt, {
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
