"use client";

import { ArrowRight, Minus, Plus } from "lucide-react";
import { useState } from "react";

import { EntryModal } from "@/components/entry-modal";
import type { Viewer } from "@/lib/types";

function dollars(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export function HeroEntry({
  viewer,
  configurationReady,
  paymentsReady,
  initialBidCents,
  takeFirstCents,
  defaultOpen,
  initialError,
}: {
  viewer: Viewer | null;
  configurationReady: boolean;
  paymentsReady: boolean;
  initialBidCents: number;
  takeFirstCents: number;
  defaultOpen: boolean;
  initialError?: string;
}) {
  const [bidCents, setBidCents] = useState(initialBidCents);
  const takesFirst = bidCents >= takeFirstCents;

  return (
    <>
      <div className="hero-bid-line">
        <h1>{takesFirst ? "Claim #1 for" : "Enter the board for"}</h1>
        <button
          type="button"
          aria-label="Decrease bid by one dollar"
          disabled={bidCents <= 300}
          onClick={() => setBidCents((current) => Math.max(300, current - 100))}
        >
          <Minus size={17} />
        </button>
        <strong>{dollars(bidCents)}</strong>
        <button
          type="button"
          aria-label="Increase bid by one dollar"
          onClick={() => setBidCents((current) => Math.min(100_000, current + 100))}
        >
          <Plus size={17} />
        </button>
      </div>
      <p className="hero-deck">
        <b>New entries start at $3.</b> Higher bids move up Top Funded. Love and Roast remain public reaction rankings.
      </p>
      <div className="hero-actions">
        <EntryModal
          viewer={viewer}
          configurationReady={configurationReady}
          paymentsReady={paymentsReady}
          initialBidCents={bidCents}
          defaultOpen={defaultOpen}
          initialError={initialError}
          className="button button-primary button-large"
        >
          Enter at {dollars(bidCents)} <ArrowRight size={18} />
        </EntryModal>
        <a className="text-link" href="#leaderboard">
          View leaderboard <span aria-hidden="true">↓</span>
        </a>
      </div>
    </>
  );
}
