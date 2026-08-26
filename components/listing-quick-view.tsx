"use client";

import {
  ArrowUpRight,
  AtSign,
  BadgeCheck,
  Droplets,
  Flame,
  Layers3,
  Share2,
  X,
} from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { trackDataFast } from "@/lib/datafast";
import { formatEfficiency, formatMoney, safeExternalUrl } from "@/lib/format";
import { hasFounderReportedNumbers, listingProofLabel, revenueProofLabel } from "@/lib/proof";
import { getReportingPeriodDefinition } from "@/lib/reporting-period";
import { getSocialCacheKey } from "@/lib/social-share";
import type { LeaderboardListing } from "@/lib/types";

const focusableSelector =
  'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function subscribeToClient() {
  return () => undefined;
}

function imageStyle(url: string | null) {
  return url ? { backgroundImage: `url(${JSON.stringify(url)})` } : undefined;
}

export function ListingQuickView({
  listing,
  className,
  ariaLabel,
  children,
}: {
  listing: LeaderboardListing;
  className?: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  const mounted = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    trackDataFast("listing_quick_view_opened", { listing_id: listing.id });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [listing.id, open]);

  function closeModal() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

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

  const founderImage = listing.avatarUrl;
  const buildLabel = listing.products.length > 1
    ? `${listing.productName} + ${listing.products.length - 1} more`
    : listing.productName;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://tokengod.lol").replace(/\/$/, "");
  const listingUrl = `${siteUrl}/listing/${listing.id}?v=${encodeURIComponent(getSocialCacheKey(listing.updatedAt))}`;
  const periodLabel = getReportingPeriodDefinition(listing.reportingPeriod).label.toLowerCase();
  const shareText = `${listing.founderName} burned ${formatMoney(listing.tokensSpentUsd)} in AI tokens over ${periodLabel}, built ${buildLabel}, and made ${formatMoney(listing.revenueUsd)} — ${formatEfficiency(listing.efficiencyScore)} back per $1. Respect it or roast it 👇`;
  const shareHref = `https://x.com/intent/post?${new URLSearchParams({ text: shareText, url: listingUrl })}`;
  const modal = open ? (
    <div
      className="listing-quick-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <div
        ref={dialogRef}
        className="listing-quick-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`listing-quick-title-${listing.id}`}
        onKeyDown={keepFocusInside}
      >
        <button
          ref={closeRef}
          className="listing-quick-close"
          type="button"
          onClick={closeModal}
          aria-label="Close founder profile"
        >
          <X size={18} />
        </button>

        <header className="listing-quick-hero">
          <div
            className={`listing-quick-avatar ${founderImage ? "has-image" : ""}`}
            style={imageStyle(founderImage)}
            aria-hidden="true"
          >
            {!founderImage ? listing.founderName.slice(0, 1).toUpperCase() : null}
          </div>
          <div className="listing-quick-title">
            <span>FOUNDER PROFILE · {listing.products.length} {listing.products.length === 1 ? "BUILD" : "BUILDS"}</span>
            <h2 id={`listing-quick-title-${listing.id}`}>{listing.founderName}</h2>
            <a href={`https://x.com/${listing.xHandle}`} target="_blank" rel="noopener noreferrer">
              @{listing.xHandle} · {listing.products.length} {listing.products.length === 1 ? "build" : "builds"} <ArrowUpRight size={13} />
            </a>
          </div>
          <div className="listing-quick-hero-footer">
            <div className={`listing-quick-proof ${hasFounderReportedNumbers(listing) ? "is-reported" : ""}`}>
              {hasFounderReportedNumbers(listing) ? <AtSign size={14} /> : <BadgeCheck size={14} fill="currentColor" />}
              {listingProofLabel(listing)} · {getReportingPeriodDefinition(listing.reportingPeriod).shortLabel}
            </div>
            <a
              className="listing-quick-share"
              href={shareHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackDataFast("listing_quick_view_shared", { listing_id: listing.id })}
            >
              <Share2 size={14} /> Share on X
            </a>
          </div>
        </header>

        <div className="listing-quick-scores">
          <div><span><Flame size={13} /> AI burn</span><strong>{formatMoney(listing.tokensSpentUsd, true)}</strong><small>{listing.aiSpendVerification === "api" ? "API verified" : "founder reported"} · {periodLabel}</small></div>
          <div><span>Revenue</span><strong>{formatMoney(listing.revenueUsd, true)}</strong><small>{revenueProofLabel(listing)} · {periodLabel}</small></div>
          <div><span>Made per $1</span><strong>{formatEfficiency(listing.efficiencyScore)}</strong><small>efficiency score</small></div>
          <div><span><Droplets size={13} /> Verdict</span><strong>{listing.loveCount} ❤️ · {listing.laughCount} 😂</strong><small>live reactions</small></div>
        </div>

        <section className="listing-quick-sites">
          <header>
            <div><Layers3 size={16} /><strong>Choose a site to visit</strong></div>
            <span>Opens in a new tab</span>
          </header>
          <div>
            {listing.products.map((product, index) => (
              <a
                href={safeExternalUrl(product.url)}
                target="_blank"
                rel="noopener noreferrer"
                key={`${product.url}-${index}`}
              >
                <span
                  className={product.logoUrl ? "has-image" : ""}
                  style={imageStyle(product.logoUrl)}
                  aria-hidden="true"
                >
                  {!product.logoUrl ? product.name.slice(0, 1).toUpperCase() : null}
                </span>
                <div>
                  <small>{index === 0 ? "PRIMARY BUILD" : `BUILD ${String(index + 1).padStart(2, "0")}`}</small>
                  <strong>{product.name}</strong>
                  {product.description ? <p>{product.description}</p> : null}
                </div>
                <b>Visit <ArrowUpRight size={14} /></b>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        className={className}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
