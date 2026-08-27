import "server-only";

import { ApiError } from "@/lib/api";
import { getDatabase } from "@/lib/db";
import { materializeEntry, type MaterializedEntry } from "@/lib/entry-materializer";

export async function finalizeLaunchEntry(
  entry: MaterializedEntry,
  options: { anonymous: boolean },
) {
  const tx = await getDatabase().transaction("write");

  try {
    const retry = await tx.execute({
      sql: "select listing_id from launch_free_slots where submission_id = ? limit 1",
      args: [entry.submissionId],
    });
    if (retry.rows[0]?.listing_id) {
      const listingId = String(retry.rows[0].listing_id);
      await tx.rollback();
      return listingId;
    }

    const primaryProduct = entry.products[0];
    if (!primaryProduct) throw new ApiError("Add at least one product.", 400);
    const duplicateProduct = await tx.execute({
      sql: `select l.id
            from launch_free_slots s
            join listings l on l.id = s.listing_id
            where lower(rtrim(l.product_url, '/')) = lower(rtrim(?, '/'))
            limit 1`,
      args: [primaryProduct.url],
    });
    if (duplicateProduct.rows.length) {
      throw new ApiError("That product already used a free founder launch pass.", 409);
    }

    if (!options.anonymous) {
      const duplicateFounder = await tx.execute({
        sql: `select l.id
              from launch_free_slots s
              join listings l on l.id = s.listing_id
              join users u on u.id = l.owner_user_id
              where lower(u.x_handle) = lower(?)
              limit 1`,
        args: [entry.xHandle],
      });
      if (duplicateFounder.rows.length) {
        throw new ApiError("This X handle already claimed a free founder launch pass.", 409);
      }
    }

    const claimed = await tx.execute({
      sql: `update launch_free_slots
            set submission_id = ?, claimed_at = ?
            where slot_number = (
              select slot_number from launch_free_slots
              where submission_id is null
              order by slot_number asc
              limit 1
            )
            returning slot_number`,
      args: [entry.submissionId, Date.now()],
    });
    if (!claimed.rows.length) {
      await tx.rollback();
      return null;
    }

    const listingId = await materializeEntry(tx, entry, {
      legacyBidCents: 300,
      fundedCents: 0,
      checkoutSessionId: null,
      entrySource: "launch_free",
    });
    await tx.execute({
      sql: "update launch_free_slots set listing_id = ? where submission_id = ?",
      args: [listingId, entry.submissionId],
    });
    await tx.commit();
    return listingId;
  } catch (error) {
    if (!tx.closed) await tx.rollback();
    throw error;
  }
}
