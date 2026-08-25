"use client";

import {
  AtSign,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BadgeDollarSign,
  Check,
  Crown,
  ExternalLink,
  Globe2,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Waves,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useRef, useState, type CSSProperties } from "react";

import { formatEfficiency, formatMoney } from "@/lib/format";
import type { Viewer } from "@/lib/types";

type Provider = "openai" | "anthropic";
type VerificationResult = {
  receipt: string;
  amountUsd: number;
  periodStart: string;
  periodEnd: string;
};
type SitePreviewResult = {
  title: string;
  description: string;
  iconUrl: string | null;
  resolvedUrl: string;
};
type XProfileResult = {
  found: boolean;
  handle: string;
  name: string;
  avatarUrl: string | null;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Something went wrong.");
  return payload;
}

function StepState({ done, number }: { done: boolean; number: string }) {
  return (
    <span className={`submit-step-state ${done ? "is-done" : ""}`}>
      {done ? <Check size={15} /> : number}
    </span>
  );
}

export function SubmitFlow({
  viewer,
  configurationReady,
  paymentsReady,
  initialBidCents = 300,
  initialError,
  variant = "page",
}: {
  viewer: Viewer | null;
  configurationReady: boolean;
  paymentsReady: boolean;
  initialBidCents?: number;
  initialError?: string;
  variant?: "page" | "modal";
}) {
  const router = useRouter();
  const submissionIdRef = useRef<string | null>(null);
  const lastPreviewedUrlRef = useRef("");
  const lastProfiledHandleRef = useRef("");
  const xLookupSequenceRef = useRef(0);
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [xHandle, setXHandle] = useState(viewer?.xHandle ?? "");
  const [xProfile, setXProfile] = useState<XProfileResult | null>(() =>
    viewer
      ? { found: true, handle: viewer.xHandle, name: viewer.name, avatarUrl: viewer.avatarUrl }
      : null,
  );
  const [xProfileBusy, setXProfileBusy] = useState(false);
  const [xProfileMessage, setXProfileMessage] = useState("");
  const [stripeKey, setStripeKey] = useState("");
  const [aiKey, setAiKey] = useState("");
  const [stripeResult, setStripeResult] = useState<VerificationResult | null>(null);
  const [aiResult, setAiResult] = useState<VerificationResult | null>(null);
  const [busy, setBusy] = useState<"stripe" | "ai" | "publish" | null>(null);
  const [error, setError] = useState(initialError || "");
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [description, setDescription] = useState("");
  const [productLogoUrl, setProductLogoUrl] = useState<string | null>(null);
  const [sitePreviewBusy, setSitePreviewBusy] = useState(false);
  const [sitePreviewMessage, setSitePreviewMessage] = useState("");
  const [bidCents, setBidCents] = useState(() =>
    Math.min(100_000, Math.max(300, Math.round(initialBidCents / 100) * 100)),
  );
  const [customBoostDollars, setCustomBoostDollars] = useState("");

  const normalizedXHandle = xHandle.trim().replace(/^@/, "");
  const xHandleIsValid = /^[A-Za-z0-9_]{1,15}$/.test(normalizedXHandle);

  function getSubmissionId() {
    submissionIdRef.current ||= crypto.randomUUID();
    return submissionIdRef.current;
  }

  const efficiency = useMemo(() => {
    if (!stripeResult || !aiResult || aiResult.amountUsd <= 0) return null;
    return stripeResult.amountUsd / aiResult.amountUsd;
  }, [aiResult, stripeResult]);

  const waterLevel = aiResult
    ? Math.min(92, Math.max(12, 14 + Math.log10(aiResult.amountUsd + 1) * 19))
    : 4;
  const tankStyle = { "--water-level": `${waterLevel}%` } as CSSProperties;
  const Root = variant === "modal" ? "div" : "main";
  const entryChoices = [...new Set(
    [300, 400, 600, 800, initialBidCents]
      .map((value) => Math.min(100_000, Math.max(300, Math.round(value / 100) * 100))),
  )]
    .sort((a, b) => a - b);

  function wholeDollar(cents: number) {
    return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
  }

  async function previewXProfile(force = false) {
    const handle = normalizedXHandle;
    if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return;
    const cacheKey = handle.toLowerCase();
    if (!force && lastProfiledHandleRef.current === cacheKey) return;

    lastProfiledHandleRef.current = cacheKey;
    const sequence = ++xLookupSequenceRef.current;
    setXProfileBusy(true);
    setXProfileMessage("Finding the public X profile…");
    try {
      const profile = await postJson<XProfileResult>("/api/x-profile", { handle });
      if (sequence !== xLookupSequenceRef.current) return;
      setXProfile(profile);
      setXProfileMessage(
        profile.found
          ? "Public display name and profile photo found."
          : `X did not return a public profile, so @${handle} will be used.`,
      );
    } catch {
      if (sequence !== xLookupSequenceRef.current) return;
      setXProfile(null);
      setXProfileMessage(`Could not read X right now, so @${handle} will be used.`);
    } finally {
      if (sequence === xLookupSequenceRef.current) setXProfileBusy(false);
    }
  }

  async function verifyStripe(event: FormEvent) {
    event.preventDefault();
    setBusy("stripe");
    setError("");
    try {
      const result = await postJson<VerificationResult>("/api/verify/stripe", {
        apiKey: stripeKey,
        submissionId: getSubmissionId(),
      });
      setStripeResult(result);
      setStripeKey("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Stripe verification failed.");
    } finally {
      setBusy(null);
    }
  }

  async function verifyAi(event: FormEvent) {
    event.preventDefault();
    setBusy("ai");
    setError("");
    try {
      const result = await postJson<VerificationResult>(`/api/verify/${provider}`, {
        apiKey: aiKey,
        submissionId: getSubmissionId(),
      });
      setAiResult(result);
      setAiKey("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI spend verification failed.");
    } finally {
      setBusy(null);
    }
  }

  async function previewSite(force = false) {
    const rawUrl = productUrl.trim();
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    if (!url || (!force && lastPreviewedUrlRef.current === url)) return;
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) return;
    } catch {
      return;
    }

    lastPreviewedUrlRef.current = url;
    if (url !== productUrl) setProductUrl(url);
    setSitePreviewBusy(true);
    setSitePreviewMessage("Reading the site…");
    try {
      const preview = await postJson<SitePreviewResult>("/api/site-preview", { url });
      if (!productName.trim() && preview.title) setProductName(preview.title);
      if (!description.trim() && preview.description) setDescription(preview.description);
      setProductLogoUrl(preview.iconUrl);
      setSitePreviewMessage(
        preview.title || preview.description || preview.iconUrl
          ? "Logo and empty fields filled. Everything stays editable."
          : "Site reached, but it did not publish usable metadata.",
      );
    } catch (caught) {
      setSitePreviewMessage(
        caught instanceof Error
          ? `${caught.message} You can still enter the details manually.`
          : "Could not auto-fill this site. You can still enter it manually.",
      );
    } finally {
      setSitePreviewBusy(false);
    }
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!stripeResult || !aiResult) {
      setError("Verify Stripe and AI spend before publishing.");
      return;
    }

    setBusy("publish");
    setError("");
    try {
      const result = await postJson<{ url?: string; listingId?: string }>("/api/checkout/entry", {
        submissionId: getSubmissionId(),
        xHandle: normalizedXHandle,
        productName,
        productUrl,
        productDescription: description,
        productLogoUrl,
        tokenReceipt: aiResult.receipt,
        revenueReceipt: stripeResult.receipt,
        bidCents,
      });
      if (result.listingId) {
        router.push(`/listing/${result.listingId}`);
        return;
      }
      if (!result.url) throw new Error("Stripe checkout could not be opened.");
      window.location.assign(result.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Publishing failed.");
      setBusy(null);
    }
  }

  return (
    <Root className={`submit-page ${variant === "modal" ? "submit-page-modal" : "section-shell"}`}>
      {variant === "page" ? (
        <Link className="back-link" href="/"><ArrowLeft size={15} /> Back to the tank</Link>
      ) : null}
      <div className="submit-intro">
        <div>
          <span className="eyebrow">ENTER THE VERIFIED RACE</span>
          <h1>Show the burn.<br /><span>Prove the outcome.</span></h1>
          <p>$3, your X handle, two private connections, and one very public efficiency score.</p>
        </div>
        <div className="privacy-seal">
          <ShieldCheck size={25} />
          <div><strong>Aggregate only</strong><span>Credentials are used for one pull and never written to the database.</span></div>
        </div>
      </div>

      {!configurationReady ? (
        <div className="setup-notice" role="status">
          <strong>Verification setup needed</strong>
          Add the Turso and receipt-secret environment variables from <code>.env.example</code> to enable verification.
        </div>
      ) : null}
      {!paymentsReady ? (
        <div className="setup-notice" role="status">
          <strong>Checkout setup needed</strong>
          Add the TokenGod Stripe secret key from <code>.env.example</code> to accept the $3 entry fee.
        </div>
      ) : null}
      {error ? <div className="submit-error" role="alert">{error}</div> : null}

      <div className="submit-layout">
        <div className="submit-steps">
          <section className={`submit-card ${xHandleIsValid ? "is-complete" : ""}`}>
            <header>
              <StepState done={xHandleIsValid} number="1" />
              <div><span>ATTRIBUTION</span><h2>Add your X handle</h2></div>
              {xHandleIsValid ? <span className="verified-pill"><Check size={14} /> Ready</span> : null}
            </header>
            <div className="step-body">
              <p>No login and no posting permission. This handle is public attribution; your money numbers are still verified directly from the providers.</p>
              <label className="secret-input handle-input">
                <span>X handle</span>
                <div>
                  <AtSign size={16} />
                  <input
                    type="text"
                    value={xHandle}
                    onChange={(event) => {
                      setXHandle(event.target.value);
                      setXProfile(null);
                      setXProfileMessage("");
                      lastProfiledHandleRef.current = "";
                      xLookupSequenceRef.current += 1;
                    }}
                    onBlur={() => void previewXProfile()}
                    placeholder="yourhandle"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={16}
                    aria-invalid={Boolean(xHandle) && !xHandleIsValid}
                  />
                </div>
                <small className={xHandle && !xHandleIsValid ? "is-error" : ""}>
                  {xHandle && !xHandleIsValid ? "Use 1–15 letters, numbers, or underscores." : "You can include or omit the @."}
                </small>
              </label>
              {xProfileBusy ? (
                <div className="x-profile-status" role="status">
                  <LoaderCircle className="spinner" size={15} /> Finding the public X profile…
                </div>
              ) : xProfile?.found ? (
                <div className="x-profile-preview">
                  <span
                    className={xProfile.avatarUrl ? "has-avatar" : ""}
                    style={xProfile.avatarUrl ? { backgroundImage: `url(${JSON.stringify(xProfile.avatarUrl)})` } : undefined}
                    aria-hidden="true"
                  >
                    {!xProfile.avatarUrl ? <AtSign size={16} /> : null}
                  </span>
                  <div><strong>{xProfile.name}</strong><small>@{xProfile.handle} · public X profile</small></div>
                  <BadgeCheck size={16} />
                </div>
              ) : xProfileMessage ? (
                <div className="x-profile-status">{xProfileMessage}</div>
              ) : null}
            </div>
          </section>

          <section className={`submit-card ${stripeResult ? "is-complete" : ""}`}>
            <header>
              <StepState done={Boolean(stripeResult)} number="2" />
              <div><span>THE OUTCOME</span><h2>Verify Stripe revenue</h2></div>
              {stripeResult ? <span className="verified-pill"><BadgeCheck size={14} /> {formatMoney(stripeResult.amountUsd)}</span> : null}
            </header>
            <form className="step-body" onSubmit={verifyStripe}>
              <p>Create a live restricted key with <strong>Charges: Read</strong>. We total captured USD charges minus refunds over the same 90-day window.</p>
              <label className="secret-input">
                <span>Restricted key</span>
                <div><LockKeyhole size={16} /><input type="password" value={stripeKey} onChange={(event) => setStripeKey(event.target.value)} placeholder="rk_live_••••••••••••" autoComplete="off" disabled={!xHandleIsValid || Boolean(stripeResult)} required /></div>
              </label>
              <div className="form-row">
                <button className="button button-secondary" type="submit" disabled={!xHandleIsValid || !configurationReady || busy !== null || Boolean(stripeResult)}>
                  {busy === "stripe" ? <><LoaderCircle className="spinner" size={16} /> Checking Stripe</> : stripeResult ? <><Check size={16} /> Revenue verified</> : <>Verify 90-day revenue <ArrowRight size={16} /></>}
                </button>
                <a className="helper-link" href="https://dashboard.stripe.com/apikeys/create" target="_blank" rel="noopener noreferrer">Create restricted key <ExternalLink size={12} /></a>
              </div>
            </form>
          </section>

          <section className={`submit-card ${aiResult ? "is-complete" : ""}`}>
            <header>
              <StepState done={Boolean(aiResult)} number="3" />
              <div><span>THE BURN</span><h2>Measure AI spend</h2></div>
              {aiResult ? <span className="verified-pill"><BadgeCheck size={14} /> {formatMoney(aiResult.amountUsd)}</span> : null}
            </header>
            <form className="step-body" onSubmit={verifyAi}>
              <div className="provider-switch" role="group" aria-label="AI provider">
                <button className={provider === "anthropic" ? "is-active" : ""} type="button" onClick={() => { setProvider("anthropic"); setAiResult(null); }}>Anthropic</button>
                <button className={provider === "openai" ? "is-active" : ""} type="button" onClick={() => { setProvider("openai"); setAiResult(null); }}>OpenAI</button>
              </div>
              <p>{provider === "anthropic" ? "Use an Anthropic organization Admin API key. Standard workspace keys cannot read cost reports." : "Use an OpenAI organization Admin API key. Project API keys cannot read organization costs."}</p>
              <label className="secret-input">
                <span>{provider === "anthropic" ? "Anthropic Admin API key" : "OpenAI Admin API key"}</span>
                <div><KeyRound size={16} /><input type="password" value={aiKey} onChange={(event) => setAiKey(event.target.value)} placeholder={provider === "anthropic" ? "sk-ant-admin••••••••" : "sk-admin-••••••••"} autoComplete="off" disabled={!xHandleIsValid || Boolean(aiResult)} required /></div>
              </label>
              <button className="button button-secondary" type="submit" disabled={!xHandleIsValid || !configurationReady || busy !== null || Boolean(aiResult)}>
                {busy === "ai" ? <><LoaderCircle className="spinner" size={16} /> Reading the meter</> : aiResult ? <><Check size={16} /> Spend verified</> : <>Measure the flood <Waves size={16} /></>}
              </button>
            </form>
          </section>

          <section className={`submit-card ${productName && productUrl && description ? "has-content" : ""}`}>
            <header>
              <StepState done={Boolean(productName && productUrl && description)} number="4" />
              <div><span>THE BUILD + ENTRY</span><h2>Name it, then choose your surface pressure</h2></div>
            </header>
            <form className="step-body product-form" onSubmit={publish}>
              <div className="field-pair">
                <label><span>Product name</span><input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="What did the tokens build?" minLength={2} maxLength={80} required /></label>
                <label>
                  <span>Product URL · auto-fills the rest</span>
                  <div className="site-url-field">
                    <span
                      className={`site-logo-preview ${productLogoUrl ? "has-logo" : ""}`}
                      style={productLogoUrl ? { backgroundImage: `url(${JSON.stringify(productLogoUrl)})` } : undefined}
                      aria-hidden="true"
                    >
                      {!productLogoUrl ? <Globe2 size={16} /> : null}
                    </span>
                    <input
                      type="url"
                      value={productUrl}
                      onChange={(event) => {
                        setProductUrl(event.target.value);
                        setProductLogoUrl(null);
                        setSitePreviewMessage("");
                      }}
                      onBlur={() => void previewSite()}
                      placeholder="https://yourproduct.com"
                      required
                    />
                    <button
                      type="button"
                      disabled={sitePreviewBusy || !productUrl.trim()}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => void previewSite(true)}
                    >
                      {sitePreviewBusy ? <LoaderCircle className="spinner" size={13} /> : null}
                      {sitePreviewBusy ? "Reading" : "Auto-fill"}
                    </button>
                  </div>
                  {sitePreviewMessage ? <small className="site-preview-message">{sitePreviewMessage}</small> : null}
                </label>
              </div>
              <label><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="One sharp sentence. Give the timeline something to argue about." minLength={12} maxLength={320} rows={4} required /><small>{description.length}/320</small></label>

              <div className="entry-price-panel">
                <div className="entry-price-head">
                  <span><BadgeDollarSign size={18} /></span>
                  <div><strong>$3 gets you ranked</strong><small>Add $1+ only if you want a paid Surface 3 push.</small></div>
                  <b>{wholeDollar(bidCents)}</b>
                </div>
                <div className="entry-price-options" role="group" aria-label="Entry and surface amount">
                  {entryChoices.map((choice) => (
                    <button
                      className={choice === bidCents && !customBoostDollars ? "is-active" : ""}
                      type="button"
                      key={choice}
                      onClick={() => {
                        setBidCents(choice);
                        setCustomBoostDollars("");
                      }}
                    >
                      <strong>{choice === 300 ? "$3 entry" : `+$${(choice - 300) / 100}`}</strong>
                      <span>
                        {choice === 300
                          ? "earned boards only"
                          : choice === Math.round(initialBidCents / 100) * 100 && initialBidCents > 300
                            ? `${wholeDollar(choice)} total · target #1`
                            : `${wholeDollar(choice)} total`}
                      </span>
                    </button>
                  ))}
                </div>
                <label className="entry-custom-boost">
                  <span>Custom surface boost</span>
                  <div>
                    <span>+$</span>
                    <input
                      type="number"
                      min="1"
                      max="997"
                      step="1"
                      inputMode="numeric"
                      placeholder="10"
                      value={customBoostDollars}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCustomBoostDollars(value);
                        const dollars = Number(value);
                        if (Number.isInteger(dollars) && dollars >= 1 && dollars <= 997) {
                          setBidCents(300 + dollars * 100);
                        }
                      }}
                    />
                    <b>+ $3 entry = {wholeDollar(bidCents)}</b>
                  </div>
                </label>
                <p><Crown size={13} /> Paid dollars only move Surface 3. Love and Roast stay community-ranked.</p>
              </div>

              <button className="button button-primary publish-button" type="submit" disabled={!xHandleIsValid || !stripeResult || !aiResult || !configurationReady || !paymentsReady || busy !== null}>
                {busy === "publish" ? <><LoaderCircle className="spinner" size={17} /> Opening secure checkout</> : <>Pay {wholeDollar(bidCents)} &amp; publish <ArrowRight size={17} /></>}
              </button>
              <p className="publish-note"><ShieldCheck size={14} /> One-time Stripe payment. Product text is self-listed; money figures are provider-verified.</p>
            </form>
          </section>
        </div>

        <aside className="submit-preview" style={tankStyle}>
          <span className="preview-label">YOUR LIVE CARD</span>
          <div className="preview-card">
            <div className="preview-brand"><Waves size={18} /><strong>TOKEN<span>GOD</span></strong><small>90D VERIFIED</small></div>
            <div className="preview-copy">
              <span>@{normalizedXHandle || "yourhandle"} burned</span>
              <strong className={aiResult ? "" : "is-pending"}>{aiResult ? formatMoney(aiResult.amountUsd) : "WAITING"}</strong>
              <div className="preview-product-line">
                <span
                  className={`preview-product-logo ${productLogoUrl ? "has-logo" : ""}`}
                  style={productLogoUrl ? { backgroundImage: `url(${JSON.stringify(productLogoUrl)})` } : undefined}
                  aria-hidden="true"
                >
                  {!productLogoUrl ? <Globe2 size={12} /> : null}
                </span>
                <p>in AI tokens to build <b>{productName || "your product"}</b></p>
              </div>
            </div>
            <div className="preview-outcome">
              <span>REVENUE MADE</span><strong className={stripeResult ? "" : "is-pending"}>{stripeResult ? formatMoney(stripeResult.amountUsd) : "WAITING"}</strong>
            </div>
            <div className="preview-ratio"><span>{efficiency !== null ? formatEfficiency(efficiency) : "—"}</span><small>{efficiency !== null ? "made per $1 spent" : "efficiency after verification"}</small></div>
            <div className="preview-water"><i /><i /><i /></div>
          </div>
          <div className="preview-caption"><BadgeCheck size={14} /> This becomes a downloadable 1200×630 card.</div>
          <div className="window-note"><strong>One fair window.</strong><span>90 completed UTC days, ending yesterday. Both providers use the exact same dates.</span></div>
        </aside>
      </div>
    </Root>
  );
}
