"use client";

import { ArrowUpRight, Check, Globe2, LoaderCircle, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { trackDataFast } from "@/lib/datafast";
import styles from "./join-wall-modal.module.css";

type Preview = { title: string; description: string; iconUrl: string | null; resolvedUrl: string };

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function hostname(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, ""); }
  catch { return value.slice(0, 255); }
}

export function JoinWallModal({ currentLeaderCents, className = "tg-header-cta", label = "Add your build" }: { currentLeaderCents: number; className?: string; label?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(() => searchParams.get("join") === "1");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => searchParams.get("payment") === "cancelled" ? "Checkout canceled. Your bubble was not published." : "");
  const [amountDollars, setAmountDollars] = useState(Math.max(1, Math.floor(currentLeaderCents / 100) + 1));
  const takeLeadDollars = Math.max(1, Math.floor(currentLeaderCents / 100) + 1);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    const openJoin = () => setOpen(true);
    window.addEventListener("tokengod:open-join", openJoin);
    return () => window.removeEventListener("tokengod:open-join", openJoin);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const normalized = normalizeUrl(url);
      if (!preview || preview.resolvedUrl !== normalized) {
        const previewResponse = await fetch("/api/site-preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: normalized }),
        });
        const nextPreview = await previewResponse.json() as Preview & { error?: string };
        if (!previewResponse.ok) throw new Error(nextPreview.error || "We could not read that website.");
        setPreview(nextPreview);
        setUrl(nextPreview.resolvedUrl);
        trackDataFast("preview_product", {
          product_domain: hostname(nextPreview.resolvedUrl),
        });
        setBusy(false);
        return;
      }

      const response = await fetch("/api/checkout/wall", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: preview.title,
          url: preview.resolvedUrl,
          description: preview.description,
          logoUrl: preview.iconUrl,
          amountCents: amountDollars * 100,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not add this product.");
      const checkout = result as { error?: string; url?: string };
      if (!checkout.url) throw new Error("Checkout could not be opened.");
      trackDataFast("initiate_checkout", {
        amount: amountDollars,
        currency: "USD",
        product_domain: hostname(preview.resolvedUrl),
      });
      window.location.assign(checkout.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setOpen(false);
    if (searchParams.get("join") === "1") router.replace("/");
  }

  return (
    <>
      <button
        className={className}
        type="button"
        onClick={() => setOpen(true)}
        data-fast-goal="open_join_modal"
        data-fast-goal-source="hero"
      >
        {label} <ArrowUpRight size={14} />
      </button>
      {open ? (
        <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="join-title">
            <button className={styles.close} type="button" onClick={close} aria-label="Close"><X size={18} /></button>
            <>
                <p className={styles.eyebrow}>YOUR PLACE ON THE WALL</p>
                <h2 id="join-title">Add your product.</h2>
                <p className={styles.intro}>Paste your website, choose your size, and join the wall.</p>
                <form onSubmit={submit}>
                  <label htmlFor="product-url">PRODUCT URL</label>
                  <div className={styles.inputWrap}><Globe2 size={18} /><input id="product-url" autoFocus required value={url} onChange={(event) => { setUrl(event.target.value); setPreview(null); }} placeholder="yourproduct.com" /></div>
                  {preview ? (
                    <div className={styles.preview}>
                      <span>{preview.iconUrl ? <img src={preview.iconUrl} alt="" /> : preview.title.slice(0, 1)}</span>
                      <div><strong>{preview.title}</strong><small>{preview.description || "Ready for the wall"}</small></div>
                      <Check size={17} />
                    </div>
                  ) : null}
                  {preview ? <>
                    <label className={styles.amountLabel} htmlFor="bubble-amount">HOW BIG DO YOU WANT TO START?</label>
                    <div className={styles.amountWrap}><span>$</span><input id="bubble-amount" type="number" min="1" max="1000" step="1" value={amountDollars} onChange={(event) => setAmountDollars(Math.max(1, Math.min(1000, Number(event.target.value) || 1)))} /><small>USD</small></div>
                    <div className={styles.amountChoices}>
                      {[1, 5, 10, takeLeadDollars].filter((value, index, all) => all.indexOf(value) === index).map((value) => <button type="button" className={amountDollars === value ? styles.activeAmount : ""} key={value} onClick={() => setAmountDollars(value)}>${value}{value === takeLeadDollars ? " · take lead" : ""}</button>)}
                    </div>
                    <p className={styles.leadHint}>Pay ${takeLeadDollars} to become the biggest bubble. More space means more visibility.</p>
                  </> : null}
                  {error ? <p className={styles.error}>{error}</p> : null}
                  <button className={styles.submit} type="submit" disabled={busy || !url.trim()}>
                    {busy ? <LoaderCircle className={styles.spinner} size={18} /> : null}
                    {preview ? `Pay $${amountDollars} to join` : "Create my bubble"}
                    {!busy ? <ArrowUpRight size={16} /> : null}
                  </button>
                </form>
                <p className={styles.note}>{preview ? "$1 minimum · secure Stripe checkout · no refunds" : "Paste a link to preview your bubble."}</p>
              </>
          </section>
        </div>
      ) : null}
    </>
  );
}
