import { NextResponse } from "next/server";
import { getUserId } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rate-limit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`${ip}/comment-report`, 5)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // TODO: insert into a reports table when one is created
  return NextResponse.json({ ok: true });
}
