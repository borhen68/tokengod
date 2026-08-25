import { NextResponse } from "next/server";

import { apiErrorResponse, assertSameOrigin } from "@/lib/api";
import { clearSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await clearSession();
    return NextResponse.redirect(new URL("/", request.url), { status: 303 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
