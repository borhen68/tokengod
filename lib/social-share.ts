const socialCardRevision = "2026-08-26-2";

export function getSocialCacheKey(updatedAt: string) {
  return `${socialCardRevision}-${updatedAt}`;
}
