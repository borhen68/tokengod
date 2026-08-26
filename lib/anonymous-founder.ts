export const ANONYMOUS_FOUNDER_NAME = "Anonymous builder";

const ANONYMOUS_HANDLE_PREFIX = "anonymous:";

export function anonymousFounderHandle(submissionId: string) {
  return `${ANONYMOUS_HANDLE_PREFIX}${submissionId}`;
}

export function isAnonymousFounderHandle(handle: string) {
  return handle.startsWith(ANONYMOUS_HANDLE_PREFIX);
}
