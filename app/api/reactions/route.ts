import { z } from "zod";

import { ApiError, apiErrorResponse, assertSameOrigin } from "@/lib/api";
import { getDatabase } from "@/lib/db";
import { anonymousReactionUser, getOrCreateReactionViewerId } from "@/lib/reaction-identity";

const reactionSchema = z.object({
  listingId: z.string().uuid(),
  type: z.enum(["love", "laugh"]),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = reactionSchema.parse(await request.json());
    const viewerId = await getOrCreateReactionViewerId();
    const viewer = anonymousReactionUser(viewerId);
    const db = getDatabase();
    const tx = await db.transaction("write");
    const now = Date.now();
    let active = false;
    let loveCount = 0;
    let laughCount = 0;

    try {
      await tx.execute({
        sql: `insert into users
              (id, x_handle, x_user_id, display_name, avatar_url, created_at, updated_at)
              values (?, ?, ?, ?, null, ?, ?)
              on conflict(id) do nothing`,
        args: [viewer.id, viewer.xHandle, viewer.xUserId, viewer.displayName, now, now],
      });

      const listing = await tx.execute({
        sql: "select id from listings where id = ? limit 1",
        args: [input.listingId],
      });
      if (!listing.rows.length) throw new ApiError("That listing no longer exists.", 404);

      await tx.execute({
        sql: "delete from reaction_rate_events where user_id = ? and created_at < ?",
        args: [viewer.id, now - 60 * 60 * 1000],
      });
      const recent = await tx.execute({
        sql: "select count(*) as count from reaction_rate_events where user_id = ? and created_at > ?",
        args: [viewer.id, now - 60 * 1000],
      });
      if (Number(recent.rows[0]?.count ?? 0) >= 20) {
        throw new ApiError("Easy, Poseidon — you can react 20 times per minute.", 429);
      }

      await tx.execute({
        sql: "insert into reaction_rate_events (user_id, created_at) values (?, ?)",
        args: [viewer.id, now],
      });
      const existing = await tx.execute({
        sql: "select id from reactions where listing_id = ? and user_id = ? and type = ? limit 1",
        args: [input.listingId, viewer.id, input.type],
      });

      if (existing.rows.length) {
        await tx.execute({
          sql: "delete from reactions where listing_id = ? and user_id = ? and type = ?",
          args: [input.listingId, viewer.id, input.type],
        });
      } else {
        await tx.execute({
          sql: "insert into reactions (id, listing_id, user_id, type, created_at) values (lower(hex(randomblob(16))), ?, ?, ?, ?)",
          args: [input.listingId, viewer.id, input.type, now],
        });
        active = true;
      }

      const counts = await tx.execute({
        sql: "select sum(case when type = 'love' then 1 else 0 end) as love_count, sum(case when type = 'laugh' then 1 else 0 end) as laugh_count from reactions where listing_id = ?",
        args: [input.listingId],
      });
      loveCount = Number(counts.rows[0]?.love_count ?? 0);
      laughCount = Number(counts.rows[0]?.laugh_count ?? 0);
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }

    return Response.json({ active, loveCount, laughCount });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
