import "server-only";

import { createClient, type Client } from "@libsql/client";

import { isDatabaseConfigured } from "@/lib/config";

let database: Client | null = null;

export function getDatabase() {
  if (!isDatabaseConfigured()) throw new Error("Turso is not configured.");

  if (!database) {
    database = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
  }

  return database;
}

