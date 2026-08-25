import "server-only";

export type PublicXProfile = {
  name: string;
  avatarUrl: string | null;
};

const PROFILE_TIMEOUT_MS = 7_000;
const MAX_PROFILE_HTML_BYTES = 300_000;
const SUCCESS_CACHE_MS = 24 * 60 * 60 * 1_000;
const MISS_CACHE_MS = 5 * 60 * 1_000;
const profileCache = new Map<string, { profile: PublicXProfile | null; expiresAt: number }>();

function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function attribute(tag: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`\\s${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeHtml(match?.[1] || match?.[2] || match?.[3] || "");
}

async function readHead(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let html = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = MAX_PROFILE_HTML_BYTES - bytes;
    if (value.byteLength > remaining) {
      html += decoder.decode(value.subarray(0, remaining), { stream: true });
      await reader.cancel();
      break;
    }
    bytes += value.byteLength;
    html += decoder.decode(value, { stream: true });
    if (/<\/head\s*>/i.test(html)) {
      await reader.cancel();
      break;
    }
  }

  return html + decoder.decode();
}

function safeAvatar(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "pbs.twimg.com") return null;
    if (!url.pathname.startsWith("/profile_images/")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function parsePublicProfile(html: string, requestedHandle: string): PublicXProfile | null {
  const title = decodeHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const titleMatch = title.match(/^(.*?)\s+\(@([A-Za-z0-9_]{1,15})\)\s+\/\s+X$/i);
  if (!titleMatch || titleMatch[2].toLowerCase() !== requestedHandle.toLowerCase()) return null;

  let avatarUrl: string | null = null;
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if (attribute(tag, "rel").toLowerCase() !== "preload") continue;
    if (attribute(tag, "as").toLowerCase() !== "image") continue;
    avatarUrl = safeAvatar(attribute(tag, "href"));
    if (avatarUrl) break;
  }

  return {
    name: titleMatch[1].slice(0, 100).trim() || `@${requestedHandle}`,
    avatarUrl,
  };
}

async function lookupWithOfficialApi(handle: string): Promise<PublicXProfile | null> {
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) return null;
  try {
    const response = await fetch(
      `https://api.x.com/2/users/by/username/${encodeURIComponent(handle)}?user.fields=name,profile_image_url,username`,
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(PROFILE_TIMEOUT_MS),
      },
    );
    if (!response.ok) return null;
    const payload = await response.json() as {
      data?: { name?: string; username?: string; profile_image_url?: string };
    };
    if (payload.data?.username?.toLowerCase() !== handle.toLowerCase()) return null;
    const name = payload.data.name?.trim();
    if (!name) return null;
    return {
      name: name.slice(0, 100),
      avatarUrl: payload.data.profile_image_url ? safeAvatar(payload.data.profile_image_url) : null,
    };
  } catch {
    return null;
  }
}

async function lookupFromPublicPage(handle: string): Promise<PublicXProfile | null> {
  try {
    const response = await fetch(`https://x.com/${encodeURIComponent(handle)}`, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(PROFILE_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; TokenGod/1.0; +https://tokengod.app)",
      },
    });
    const finalUrl = new URL(response.url);
    if (!response.ok || !["x.com", "www.x.com"].includes(finalUrl.hostname)) return null;
    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    if (!contentType.includes("text/html")) return null;
    return parsePublicProfile(await readHead(response), handle);
  } catch {
    return null;
  }
}

export async function lookupPublicXProfile(rawHandle: string): Promise<PublicXProfile | null> {
  const handle = rawHandle.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;

  const key = handle.toLowerCase();
  const cached = profileCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;

  const profile = await lookupWithOfficialApi(handle) || await lookupFromPublicPage(handle);
  if (profileCache.size > 2_000) profileCache.clear();
  profileCache.set(key, {
    profile,
    expiresAt: Date.now() + (profile ? SUCCESS_CACHE_MS : MISS_CACHE_MS),
  });
  return profile;
}
