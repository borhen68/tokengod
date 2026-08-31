"use client";

import {useEffect, useState} from "react";

const PUBLIC_STATS_URL = "https://datafa.st/share/6a8df6bf91fe4779cdf73d53?realtime=1";

type TrafficStats = {
  online: number | null;
  totalVisitors: number | null;
};

const number = new Intl.NumberFormat("en-US");

export function PublicTrafficBadge() {
  const [stats, setStats] = useState<TrafficStats | null>(null);

  useEffect(() => {
    let disposed = false;

    async function refresh() {
      try {
        const response = await fetch("/api/public-traffic", {cache: "no-store"});
        if (!response.ok) return;
        const nextStats = await response.json() as TrafficStats;
        if (!disposed) setStats(nextStats);
      } catch {
        // Keep the public dashboard link usable if DataFast is temporarily unavailable.
      }
    }

    void refresh();
    const interval = window.setInterval(refresh, 20_000);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, []);

  const online = stats?.online;
  const totalVisitors = stats?.totalVisitors;
  const hasCounts = online !== null && online !== undefined
    && totalVisitors !== null && totalVisitors !== undefined;

  return (
    <a
      className="public-traffic-badge tg-public-traffic"
      href={PUBLIC_STATS_URL}
      target="_blank"
      rel="noreferrer"
      aria-label={hasCounts
        ? `${number.format(online)} online and ${number.format(totalVisitors)} visitors since launch. Open public analytics.`
        : "Open TokenGod public live analytics"}
    >
      <i aria-hidden="true" />
      {hasCounts ? (
        <>
          <strong>{number.format(online)} online</strong>
          <small>·</small>
          <b>{number.format(totalVisitors)} visitors</b>
        </>
      ) : (
        <b>Live analytics</b>
      )}
      <em>view live analytics ↗</em>
    </a>
  );
}
