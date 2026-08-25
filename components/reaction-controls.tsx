"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { formatCount } from "@/lib/format";
import type { ReactionType } from "@/lib/types";

type Counts = { love: number; laugh: number };

export function ReactionControls({
  listingId,
  initialCounts,
  initialActive,
  isAuthenticated,
  compact = false,
  onUpdate,
}: {
  listingId: string;
  initialCounts: Counts;
  initialActive?: Partial<Record<ReactionType, boolean>>;
  isAuthenticated: boolean;
  compact?: boolean;
  onUpdate?: (counts: Counts) => void;
}) {
  const router = useRouter();
  const [counts, setCounts] = useState(initialCounts);
  const [active, setActive] = useState(initialActive ?? {});
  const [busy, setBusy] = useState<ReactionType | null>(null);
  const [message, setMessage] = useState("");

  async function react(type: ReactionType) {
    if (!isAuthenticated) {
      router.push(`/auth/x?next=${encodeURIComponent(`/listing/${listingId}`)}`);
      return;
    }

    setBusy(type);
    setMessage("");
    try {
      const response = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, type }),
      });
      const body = (await response.json()) as {
        active?: boolean;
        loveCount?: number;
        laughCount?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Reaction failed.");

      const nextCounts = {
        love: Number(body.loveCount ?? counts.love),
        laugh: Number(body.laughCount ?? counts.laugh),
      };
      setCounts(nextCounts);
      setActive((current) => ({ ...current, [type]: Boolean(body.active) }));
      onUpdate?.(nextCounts);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={`reaction-wrap ${compact ? "reaction-wrap-compact" : ""}`}>
      <div className="reaction-controls">
        <button
          className={`reaction-button reaction-love ${active.love ? "is-active" : ""}`}
          type="button"
          aria-label={`${active.love ? "Remove" : "Add"} love reaction`}
          aria-pressed={Boolean(active.love)}
          disabled={busy !== null}
          onClick={() => react("love")}
        >
          <span aria-hidden="true">❤️</span>
          <strong>{formatCount(counts.love)}</strong>
        </button>
        <button
          className={`reaction-button reaction-laugh ${active.laugh ? "is-active" : ""}`}
          type="button"
          aria-label={`${active.laugh ? "Remove" : "Add"} laugh reaction`}
          aria-pressed={Boolean(active.laugh)}
          disabled={busy !== null}
          onClick={() => react("laugh")}
        >
          <span aria-hidden="true">😂</span>
          <strong>{formatCount(counts.laugh)}</strong>
        </button>
      </div>
      {message ? <span className="reaction-error" role="status">{message}</span> : null}
    </div>
  );
}
