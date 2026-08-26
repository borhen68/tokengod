const DATAFAST_WEBSITE_ID = "6a8df6bf91fe4779cdf73d53";
const DATAFAST_API = "https://datafa.st/api/analytics";

function safeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null;
}

async function fetchDataFast(path: string) {
  const response = await fetch(`${DATAFAST_API}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(4_000),
  });

  if (!response.ok) {
    throw new Error(`DataFast returned ${response.status}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

export async function GET() {
  const [realtimeResult, lifetimeResult] = await Promise.allSettled([
    fetchDataFast(`/realtime?websiteId=${DATAFAST_WEBSITE_ID}`),
    fetchDataFast(`/main?websiteId=${DATAFAST_WEBSITE_ID}&period=all&granularity=monthly`),
  ]);

  const online = realtimeResult.status === "fulfilled"
    ? safeCount(realtimeResult.value.count)
    : null;
  const totalVisitors = lifetimeResult.status === "fulfilled"
    ? safeCount(lifetimeResult.value.totalVisitors)
    : null;

  return Response.json(
    {online, totalVisitors},
    {
      headers: {
        "Cache-Control": "public, max-age=10, stale-while-revalidate=20",
      },
    },
  );
}
