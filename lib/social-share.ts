const socialCardRevision = "2026-08-27-outcomes";

export function getSocialCacheKey(updatedAt: string) {
  return `${socialCardRevision}-${updatedAt}`;
}
