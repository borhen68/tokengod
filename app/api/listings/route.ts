import { apiErrorResponse, assertSameOrigin } from "@/lib/api";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return Response.json(
      { error: "Start from the guided entry flow to verify the numbers before publishing." },
      { status: 402 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
