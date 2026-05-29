import { NextResponse } from "next/server";

import { HEALTH_COPY } from "@/lib/constants/app";
import type { HealthResponse } from "@/types/api";

export async function GET(): Promise<NextResponse<HealthResponse>> {
  try {
    return NextResponse.json({
      service: HEALTH_COPY.service,
      status: HEALTH_COPY.okStatus,
      message: HEALTH_COPY.bootMessage,
      checkedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        service: HEALTH_COPY.service,
        status: HEALTH_COPY.errorStatus,
        message: HEALTH_COPY.failureMessage,
        checkedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
