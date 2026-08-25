import type { NextRequest } from "next/server";

function validMetadataValue(value: string | undefined) {
  return value && value.length <= 500 ? value : undefined;
}

export function getDataFastStripeMetadata(request: NextRequest) {
  const visitorId = validMetadataValue(request.cookies.get("datafast_visitor_id")?.value);
  const sessionId = validMetadataValue(request.cookies.get("datafast_session_id")?.value);

  return {
    ...(visitorId ? { datafast_visitor_id: visitorId } : {}),
    ...(sessionId ? { datafast_session_id: sessionId } : {}),
  };
}
