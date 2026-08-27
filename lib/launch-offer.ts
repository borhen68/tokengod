import "server-only";

import { cache } from "react";

import { isDatabaseConfigured } from "@/lib/config";
import { getDatabase } from "@/lib/db";

export const LAUNCH_SLOT_TOTAL = 5;

export type LaunchOffer = {
  total: number;
  claimed: number;
  remaining: number;
};

export const getLaunchOffer = cache(async (): Promise<LaunchOffer> => {
  if (!isDatabaseConfigured()) {
    return { total: LAUNCH_SLOT_TOTAL, claimed: LAUNCH_SLOT_TOTAL, remaining: 0 };
  }

  try {
    const result = await getDatabase().execute(
      "select count(*) as claimed from launch_free_slots where submission_id is not null",
    );
    const claimed = Math.min(
      LAUNCH_SLOT_TOTAL,
      Math.max(0, Number(result.rows[0]?.claimed ?? LAUNCH_SLOT_TOTAL)),
    );
    return {
      total: LAUNCH_SLOT_TOTAL,
      claimed,
      remaining: LAUNCH_SLOT_TOTAL - claimed,
    };
  } catch (error) {
    console.error("Launch offer query failed", error instanceof Error ? error.name : "UnknownError");
    return { total: LAUNCH_SLOT_TOTAL, claimed: LAUNCH_SLOT_TOTAL, remaining: 0 };
  }
});
