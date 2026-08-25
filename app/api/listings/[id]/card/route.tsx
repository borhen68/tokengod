import { getListing } from "@/lib/data";
import { renderStatCard } from "@/lib/stat-card";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return new Response("Listing not found", { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  return renderStatCard(listing, { download });
}

