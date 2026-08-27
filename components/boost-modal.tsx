"use client";

import {
  ArrowRight,
  BadgeDollarSign,
  Crown,
  LoaderCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { trackDataFast } from "@/lib/datafast";
import type { LeaderboardListing } from "@/lib/types";

const focusableSelector =
  'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function subscribeToClient() {
  return () => undefined;
}

function wholeDollar(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export function BoostModal({
  listing,
  rank,
  leaderBidCents,
  paymentsReady,
  defaultOpen = false,
  initialError,
}: {
  listing: LeaderboardListing;
  rank: number;
  leaderBidCents: number;
  paymentsReady: boolean;
  defaultOpen?: boolean;
  initialError?: string;
}) {
  const router = useRouter();
  const mounted = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const takeFirstCents = Math.max(100, leaderBidCents - listing.bidCents + 100);
  const [open, setOpen] = useState(defaultOpen);
  const [amountCents, setAmountCents] = useState(takeFirstCents);
  const [customDollars, setCustomDollars] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError || "");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const choices = useMemo(
    () => [...new Set([100, 300, 500, takeFirstCents])].sort((a, b) => a - b),
    [takeFirstCents],
  );

  function closeModal() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
    if (defaultOpen) router.replace("/", { scroll: false });
  }

  useEffect(() => {
    if (!open) return;
    trackDataFast("surface_modal_opened", {
      listing_id: listing.id,
      rank,
      take_first_cents: takeFirstCents,
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);

    function onDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        if (defaultOpen) router.replace("/", { scroll: false });
      }
    }

    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onDocumentKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [defaultOpen, listing.id, open, rank, router, takeFirstCents]);

  function keepFocusInside(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function startCheckout() {
    if (!paymentsReady) {
      setError("TokenGod payments are not configured yet.");
      return;
    }
    setBusy(true);
    setError("");
    trackDataFast("surface_checkout_started", {
      listing_id: listing.id,
      amount_cents: amountCents,
      current_rank: rank,
    });
    try {
      const response = await fetch("/api/checkout/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id, amountCents }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Stripe checkout could not be opened.");
      }
      window.location.assign(payload.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Stripe checkout could not be opened.");
      setBusy(false);
    }
  }

  const modal = open ? (
    <div
      className="boost-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <div
        ref={dialogRef}
        className="boost-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`boost-title-${listing.id}`}
        onKeyDown={keepFocusInside}
      >
        <button
          ref={closeRef}
          className="boost-close"
          type="button"
          onClick={closeModal}
          aria-label="Close backing popup"
        >
          <X size={18} />
        </button>

        <span className="boost-kicker"><i /> LIVE TOP FUNDED</span>
        <div className="boost-crown"><Crown size={31} fill="currentColor" /></div>
        <h2 id={`boost-title-${listing.id}`}>
          {rank === 1 ? "Keep the #1 spot." : `Send ${listing.productName} to #1.`}
        </h2>
        <p>
          Back <strong>{listing.productName}</strong> by $1 or more. The full amount raises its
          Top Funded score immediately after Stripe confirms payment.
        </p>

        <div className="boost-scoreline">
          <div><span>NOW</span><strong>{wholeDollar(listing.bidCents)}</strong></div>
          <ArrowRight size={18} />
          <div><span>AFTER</span><strong>{wholeDollar(listing.bidCents + amountCents)}</strong></div>
        </div>

        <div className="boost-choices" role="group" aria-label="Backing amount">
          {choices.map((choice) => (
            <button
              className={amountCents === choice && !customDollars ? "is-active" : ""}
              type="button"
              key={choice}
              onClick={() => {
                setAmountCents(choice);
                setCustomDollars("");
              }}
            >
              <strong>+{wholeDollar(choice)}</strong>
              <span>{choice === takeFirstCents ? (rank === 1 ? "defend #1" : "take #1") : "add pressure"}</span>
            </button>
          ))}
        </div>

        <label className="boost-custom">
          <span>Or choose a whole-dollar amount</span>
          <div>
            <BadgeDollarSign size={17} />
            <input
              type="number"
              min="1"
              max="1000"
              step="1"
              inputMode="numeric"
              placeholder="10"
              value={customDollars}
              onChange={(event) => {
                const value = event.target.value;
                setCustomDollars(value);
                const dollars = Number(value);
                if (Number.isInteger(dollars) && dollars >= 1 && dollars <= 1000) {
                  setAmountCents(dollars * 100);
                }
              }}
            />
            <b>USD</b>
          </div>
        </label>

        {error ? <div className="boost-error" role="alert">{error}</div> : null}
        <button
          className="button button-primary boost-checkout"
          type="button"
          disabled={busy || amountCents < 100 || amountCents > 100_000}
          onClick={startCheckout}
        >
          {busy ? <><LoaderCircle className="spinner" size={17} /> Opening Stripe</> : <>Back with {wholeDollar(amountCents)} <ArrowRight size={17} /></>}
        </button>
        <div className="boost-rule">
          <ShieldCheck size={15} />
          <span><strong>Top Funded only.</strong> This never changes Love, Roast, revenue, or efficiency. Payments are final and non-refundable. <Link href="/terms" target="_blank" rel="noopener noreferrer">Terms &amp; Privacy</Link></span>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        className="surface-boost-button"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {rank === 1 ? <>Defend #1 <span>+$1</span></> : <>Take #1 <span>+{wholeDollar(takeFirstCents)}</span></>}
      </button>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
