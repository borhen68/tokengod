export class ProviderVerificationError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ProviderVerificationError";
  }
}

export async function providerErrorMessage(
  response: Response,
  fallback: string,
) {
  if (response.status === 401 || response.status === 403) {
    return `${fallback} Check that it is a live key with permission to read payments for this account.`;
  }
  if (response.status === 429) return "The provider rate limit was reached. Try again shortly.";
  return `${fallback} The provider returned HTTP ${response.status}.`;
}
