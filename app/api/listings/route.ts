import { apiErrorResponse, assertSameOrigin } from "@/lib/api";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return Response.json(
      { error: "Payment is required. Start from the $3 entry flow." },
      { status: 402 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
