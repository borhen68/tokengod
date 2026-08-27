"use client";

import type { CSSProperties, ReactNode } from "react";

import { trackDataFast } from "@/lib/datafast";
import { safeExternalUrl } from "@/lib/format";

export type ProductVisitSource = "leaderboard" | "quick_view" | "listing" | "battle";

export function TrackedProductLink({
  listingId,
  productName,
  productUrl,
  source,
  className,
  style,
  ariaLabel,
  title,
  children,
}: {
  listingId: string;
  productName: string;
  productUrl: string;
  source: ProductVisitSource;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  title?: string;
  children: ReactNode;
}) {
  function trackVisit() {
    trackDataFast("product_visit_clicked", {
      listing_id: listingId,
      product_name: productName,
      source,
    });
    void fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, productUrl, source }),
      keepalive: true,
    }).catch(() => undefined);
  }

  return (
    <a
      className={className}
      style={style}
      href={safeExternalUrl(productUrl)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      title={title}
      onClick={trackVisit}
    >
      {children}
    </a>
  );
}
