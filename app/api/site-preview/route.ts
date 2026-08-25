import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { z } from "zod";

import { ApiError, apiErrorResponse, assertSameOrigin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  url: z.string().trim().url().max(2_048),
});

const MAX_HTML_BYTES = 600_000;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 7_000;
const recentRequests = new Map<string, number[]>();

function isBlockedIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

function isBlockedAddress(address: string) {
  if (isIP(address) === 4) return isBlockedIpv4(address);
  if (isIP(address) !== 6) return true;
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mapped ? isBlockedIpv4(mapped) : false;
}

async function assertPublicUrl(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ApiError("Website URL must start with http:// or https://.", 400);
  }
  if (url.username || url.password) {
    throw new ApiError("Website URLs cannot contain credentials.", 400);
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new ApiError("Website URL must use the standard HTTP or HTTPS port.", 400);
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
    || hostname.endsWith(".home.arpa")
  ) {
    throw new ApiError("Private websites cannot be previewed.", 400);
  }

  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) throw new ApiError("Private websites cannot be previewed.", 400);
    return;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ApiError("That website could not be reached.", 422);
  }
  if (!addresses.length || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new ApiError("Private websites cannot be previewed.", 400);
  }
}

function enforceRateLimit(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwarded || request.headers.get("x-real-ip") || "local";
  const cutoff = Date.now() - 60_000;
  const recent = (recentRequests.get(key) || []).filter((time) => time > cutoff);
  if (recent.length >= 30) throw new ApiError("Too many website previews. Wait a minute and retry.", 429);
  if (recentRequests.size > 5_000) recentRequests.clear();
  recent.push(Date.now());
  recentRequests.set(key, recent);
}

async function readLimitedHtml(response: Response) {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let html = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = MAX_HTML_BYTES - bytes;
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

function cleanText(value: string, maxLength: number) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ")).slice(0, maxLength).trim();
}

function parseMetadata(html: string, finalUrl: URL) {
  const meta = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const key = (attribute(tag, "property") || attribute(tag, "name")).toLowerCase();
    const content = attribute(tag, "content");
    if (key && content && !meta.has(key)) meta.set(key, content);
  }

  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  const rawTitle = meta.get("og:site_name") || meta.get("og:title") || titleTag;
  const title = cleanText(rawTitle, 80);
  const description = cleanText(
    meta.get("og:description") || meta.get("twitter:description") || meta.get("description") || "",
    320,
  );

  let iconUrl: string | null = null;
  const links = html.match(/<link\b[^>]*>/gi) || [];
  const iconTag = links.find((tag) => /(?:^|\s)(?:apple-touch-icon|icon)(?:\s|$)/i.test(attribute(tag, "rel")));
  const iconHref = iconTag ? attribute(iconTag, "href") : "/favicon.ico";
  try {
    const candidate = new URL(iconHref, finalUrl);
    if (["http:", "https:"].includes(candidate.protocol)) iconUrl = candidate.toString();
  } catch {}

  return {
    title: title || finalUrl.hostname.replace(/^www\./, "").split(".")[0] || "",
    description,
    iconUrl,
    resolvedUrl: finalUrl.toString(),
  };
}

async function fetchWebsite(startUrl: URL) {
  let currentUrl = startUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    await assertPublicUrl(currentUrl);
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          Accept: "text/html,application/xhtml+xml",
          Range: `bytes=0-${MAX_HTML_BYTES - 1}`,
          "User-Agent": "TokenGod-SitePreview/1.0 (+https://tokengod.app)",
        },
      });
    } catch {
      throw new ApiError("That website did not respond in time.", 422);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) {
        throw new ApiError("That website redirected too many times.", 422);
      }
      currentUrl = new URL(location, currentUrl);
      continue;
    }
    if (!response.ok) throw new ApiError("That website could not be previewed.", 422);
    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new ApiError("That URL is not an HTML website.", 422);
    }
    return { html: await readLimitedHtml(response), finalUrl: currentUrl };
  }
  throw new ApiError("That website redirected too many times.", 422);
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request);
    const input = requestSchema.parse(await request.json());
    const requestedUrl = new URL(input.url);
    const { html, finalUrl } = await fetchWebsite(requestedUrl);
    const preview = parseMetadata(html, finalUrl);
    if (preview.iconUrl) {
      try {
        await assertPublicUrl(new URL(preview.iconUrl));
      } catch {
        preview.iconUrl = null;
      }
    }
    return Response.json(preview);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
