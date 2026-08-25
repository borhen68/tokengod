export function isDatabaseConfigured() {
  return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
}

export function isXAuthConfigured() {
  return Boolean(
    process.env.X_CLIENT_ID &&
      process.env.X_CLIENT_SECRET &&
      process.env.SESSION_SECRET,
  );
}

export function isPaymentConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isApplicationConfigured() {
  return Boolean(
    isDatabaseConfigured() &&
      process.env.VERIFICATION_RECEIPT_SECRET,
  );
}
