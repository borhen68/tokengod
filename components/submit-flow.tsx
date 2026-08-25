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
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Trash2,
  Waves,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useRef, useState, type CSSProperties } from "react";

import { trackDataFast } from "@/lib/datafast";
import { formatEfficiency, formatMoney } from "@/lib/format";
import type { Viewer } from "@/lib/types";

type Provider = "openai" | "anthropic";
type SpendVerification = "api" | "self_reported";
type VerificationResult = {
  receipt: string;
  amountUsd: number;
  periodStart: string;
  periodEnd: string;
  verificationMethod: SpendVerification;
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
type SiteDraft = {
  id: string;
  name: string;
  url: string;
  description: string;
  logoUrl: string | null;
  previewBusy: boolean;
  previewMessage: string;
};

function emptySite(id: string): SiteDraft {
  return {
    id,
    name: "",
    url: "",
    description: "",
    logoUrl: null,
    previewBusy: false,
    previewMessage: "",
  };
}

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
  const lastPreviewedUrlsRef = useRef<Record<string, string>>({});
  const lastProfiledHandleRef = useRef("");
  const xLookupSequenceRef = useRef(0);
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [spendVerification, setSpendVerification] = useState<SpendVerification>("self_reported");
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
  const [reportedSpendDollars, setReportedSpendDollars] = useState("");
  const [stripeResult, setStripeResult] = useState<VerificationResult | null>(null);
  const [aiResult, setAiResult] = useState<VerificationResult | null>(null);
  const [busy, setBusy] = useState<"stripe" | "ai" | "publish" | null>(null);
  const [error, setError] = useState(initialError || "");
  const [sites, setSites] = useState<SiteDraft[]>(() => [emptySite("primary")]);
  const [bidCents, setBidCents] = useState(() =>
    Math.min(100_000, Math.max(300, Math.round(initialBidCents / 100) * 100)),
  );
  const [customBoostDollars, setCustomBoostDollars] = useState("");

  const normalizedXHandle = xHandle.trim().replace(/^@/, "");
  const xHandleIsValid = /^[A-Za-z0-9_]{1,15}$/.test(normalizedXHandle);
  const primarySite = sites[0];
  const sitesAreReady = sites.every((site, index) =>
    site.name.trim().length >= 2
    && site.url.trim().length > 0
    && (index > 0 || site.description.trim().length >= 12),
  );
  const extraSiteCount = Math.max(0, sites.length - 3);
  const siteFeeCents = extraSiteCount * 100;
  const checkoutTotalCents = bidCents + siteFeeCents;

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
      trackDataFast("revenue_verified", {
        period_days: 90,
      });
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
      trackDataFast("ai_spend_api_verified", {
        provider,
        period_days: 90,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI spend verification failed.");
    } finally {
      setBusy(null);
    }
  }

  async function reportAiSpend(event: FormEvent) {
    event.preventDefault();
    const amountUsd = Number(reportedSpendDollars);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0 || amountUsd > 1_000_000) {
      setError("Enter the amount you actually paid for AI subscriptions during the last 90 days.");
      return;
    }

    setBusy("ai");
    setError("");
    try {
      const result = await postJson<VerificationResult>("/api/verify/self-reported", {
        amountUsd,
        provider,
        submissionId: getSubmissionId(),
      });
      setAiResult(result);
      trackDataFast("ai_spend_reported", {
        provider,
        period_days: 90,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI spend could not be recorded.");
    } finally {
      setBusy(null);
    }
  }

  function chooseSpendVerification(next: SpendVerification) {
    setSpendVerification(next);
    setAiResult(null);
    setAiKey("");
    setError("");
  }

  function updateSite(id: string, patch: Partial<SiteDraft>) {
    setSites((current) => current.map((site) => site.id === id ? { ...site, ...patch } : site));
  }

  function addSite() {
    if (sites.length >= 20) {
      setError("A TokenGod profile can contain up to 20 sites.");
      return;
    }
    setError("");
    trackDataFast("site_added", {
      site_count: sites.length + 1,
      extra_fee_cents: Math.max(0, sites.length + 1 - 3) * 100,
    });
    setSites((current) => [...current, emptySite(crypto.randomUUID())]);
  }

  function removeSite(id: string) {
    if (id === "primary") return;
    delete lastPreviewedUrlsRef.current[id];
    setSites((current) => current.filter((site) => site.id !== id));
  }

  async function previewSite(siteId: string, force = false) {
    const site = sites.find((candidate) => candidate.id === siteId);
    if (!site) return;
    const rawUrl = site.url.trim();
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    if (!url || (!force && lastPreviewedUrlsRef.current[siteId] === url)) return;
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) return;
    } catch {
      return;
    }

    lastPreviewedUrlsRef.current[siteId] = url;
    updateSite(siteId, {
      url,
      previewBusy: true,
      previewMessage: "Reading the site…",
    });
    try {
      const preview = await postJson<SitePreviewResult>("/api/site-preview", { url });
      setSites((current) => current.map((candidate) => candidate.id === siteId ? {
        ...candidate,
        name: candidate.name.trim() ? candidate.name : preview.title,
        description: candidate.description.trim() ? candidate.description : preview.description,
        logoUrl: preview.iconUrl,
        previewMessage: preview.title || preview.description || preview.iconUrl
          ? "Logo and empty fields filled. Everything stays editable."
          : "Site reached, but it did not publish usable metadata.",
      } : candidate));
    } catch (caught) {
      updateSite(siteId, {
        previewMessage: caught instanceof Error
          ? `${caught.message} You can still enter the details manually.`
          : "Could not auto-fill this site. You can still enter it manually.",
      });
    } finally {
      updateSite(siteId, { previewBusy: false });
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
    trackDataFast("entry_checkout_started", {
      site_count: sites.length,
      entry_cents: bidCents,
      site_fee_cents: siteFeeCents,
      total_cents: checkoutTotalCents,
      spend_source: aiResult.verificationMethod,
    });
    try {
      const result = await postJson<{ url?: string; listingId?: string }>("/api/checkout/entry", {
        submissionId: getSubmissionId(),
        xHandle: normalizedXHandle,
        products: sites.map((site) => ({
          name: site.name,
          url: site.url,
          description: site.description,
          logoUrl: site.logoUrl,
        })),
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
          <span className="eyebrow">ENTER THE TRANSPARENT RACE</span>
          <h1>Show the burn.<br /><span>Prove the outcome.</span></h1>
          <p>$3, up to 3 product sites, verified revenue, and one honestly labeled AI-spend score.</p>
        </div>
        <div className="privacy-seal">
          <ShieldCheck size={25} />
          <div><strong>Trust is visible</strong><span>API spend is verified. Personal-plan spend is clearly marked Founder Reported.</span></div>
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
          Add the TokenGod Stripe secret key from <code>.env.example</code> to accept entry and extra-site payments.
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
                <div><LockKeyhole size={16} /><input type="password" value={stripeKey} onChange={(event) => setStripeKey(event.target.value)} placeholder="rk_live_••••••••••••" autoComplete="off" disabled={Boolean(stripeResult)} required /></div>
              </label>
              <div className="form-row">
                <button className="button button-secondary" type="submit" disabled={!configurationReady || busy !== null || Boolean(stripeResult)}>
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
              {aiResult ? (
                <span className={`verified-pill ${aiResult.verificationMethod === "self_reported" ? "is-reported" : ""}`}>
                  {aiResult.verificationMethod === "api" ? <BadgeCheck size={14} /> : <AtSign size={14} />}
                  {aiResult.verificationMethod === "api" ? "API verified" : "Reported"} · {formatMoney(aiResult.amountUsd)}
                </span>
              ) : null}
            </header>
            <form className="step-body" onSubmit={spendVerification === "api" ? verifyAi : reportAiSpend}>
              <div className="spend-source-switch" role="group" aria-label="AI spend verification method">
                <button
                  className={spendVerification === "self_reported" ? "is-active" : ""}
                  type="button"
                  onClick={() => chooseSpendVerification("self_reported")}
                >
                  <strong>Personal / subscription</strong>
                  <span>No admin key · gray badge</span>
                </button>
                <button
                  className={spendVerification === "api" ? "is-active is-api" : ""}
                  type="button"
                  onClick={() => chooseSpendVerification("api")}
                >
                  <strong>Organization API</strong>
                  <span>Provider checked · gold badge</span>
                </button>
              </div>
              <div className="provider-switch" role="group" aria-label="AI provider">
                <button className={provider === "anthropic" ? "is-active" : ""} type="button" onClick={() => { setProvider("anthropic"); setAiResult(null); }}>Claude / Anthropic</button>
                <button className={provider === "openai" ? "is-active" : ""} type="button" onClick={() => { setProvider("openai"); setAiResult(null); }}>ChatGPT / OpenAI</button>
              </div>
              {spendVerification === "self_reported" ? (
                <>
                  <p>For Claude Pro/Max or ChatGPT Plus/Pro: enter what you actually paid during the last 90 completed days. This is allowed into the race, but never presented as provider-verified.</p>
                  <label className="secret-input reported-spend-input">
                    <span>90-day subscription spend · USD</span>
                    <div><strong>$</strong><input type="number" value={reportedSpendDollars} onChange={(event) => setReportedSpendDollars(event.target.value)} placeholder="60" min="0.01" max="1000000" step="0.01" inputMode="decimal" disabled={Boolean(aiResult)} required /></div>
                  </label>
                  <div className="reporting-disclosure"><AtSign size={14} /><span>Your card and leaderboard row will say <strong>Founder Reported</strong>. API-verified entries win reaction-count ties.</span></div>
                  <button className="button button-secondary" type="submit" disabled={!configurationReady || busy !== null || Boolean(aiResult)}>
                    {busy === "ai" ? <><LoaderCircle className="spinner" size={16} /> Recording the burn</> : aiResult ? <><Check size={16} /> Spend recorded</> : <>Use founder-reported spend <Waves size={16} /></>}
                  </button>
                </>
              ) : (
                <>
                  <div className="admin-key-warning">
                    <ShieldCheck size={15} />
                    <span>{provider === "anthropic" ? "Anthropic Console Admin keys have broad organization access; individual accounts cannot create one." : "OpenAI cost reports require an organization Admin key, not a normal project key."} TokenGod uses it for one request and never stores it.</span>
                  </div>
                  <label className="secret-input">
                    <span>{provider === "anthropic" ? "Anthropic Admin API key" : "OpenAI Admin API key"}</span>
                    <div><KeyRound size={16} /><input type="password" value={aiKey} onChange={(event) => setAiKey(event.target.value)} placeholder={provider === "anthropic" ? "sk-ant-admin••••••••" : "sk-admin-••••••••"} autoComplete="off" disabled={Boolean(aiResult)} required /></div>
                  </label>
                  <div className="form-row ai-key-actions">
                    <button className="button button-secondary" type="submit" disabled={!configurationReady || busy !== null || Boolean(aiResult)}>
                      {busy === "ai" ? <><LoaderCircle className="spinner" size={16} /> Reading the meter</> : aiResult ? <><Check size={16} /> Spend API-verified</> : <>Verify API spend <Waves size={16} /></>}
                    </button>
                    <a className="helper-link" href={provider === "anthropic" ? "https://platform.claude.com/docs/en/manage-claude/admin-api-keys" : "https://platform.openai.com/settings/organization/admin-keys"} target="_blank" rel="noopener noreferrer">Read provider requirements <ExternalLink size={12} /></a>
                  </div>
                </>
              )}
            </form>
          </section>

          <section className={`submit-card ${sitesAreReady ? "has-content" : ""}`}>
            <header>
              <StepState done={sitesAreReady} number="4" />
              <div><span>YOUR BUILDS + ENTRY</span><h2>Add up to 3 sites for the same $3</h2></div>
            </header>
            <form className="step-body product-form" onSubmit={publish}>
              <div className="site-bundle-note">
                <Layers3 size={16} />
                <span><strong>{Math.min(sites.length, 3)}/3 included{extraSiteCount ? ` · ${extraSiteCount} paid extra` : ""}</strong> · Site 4 and beyond add $1 each. Every site shares one founder score and one leaderboard position.</span>
              </div>

              <div className="product-sites">
                {sites.map((site, index) => (
                  <div className={`product-site-card ${index >= 3 ? "is-paid-extra" : ""}`} key={site.id}>
                    <header>
                      <div>
                        <span>SITE {String(index + 1).padStart(2, "0")}</span>
                        <strong>{index === 0 ? "Primary build" : site.name || "Another build"}</strong>
                      </div>
                      <span className={`site-cost-badge ${index >= 3 ? "is-paid" : ""}`}>
                        {index < 3 ? "Included" : "+$1"}
                      </span>
                      {index > 0 ? (
                        <button type="button" className="remove-site-button" onClick={() => removeSite(site.id)} aria-label={`Remove site ${index + 1}`}>
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </header>
                    <div className="field-pair">
                      <label>
                        <span>Product name</span>
                        <input value={site.name} onChange={(event) => updateSite(site.id, { name: event.target.value })} placeholder="What did the tokens build?" minLength={2} maxLength={80} required />
                      </label>
                      <label>
                        <span>Product URL · auto-fills the rest</span>
                        <div className="site-url-field">
                          <span
                            className={`site-logo-preview ${site.logoUrl ? "has-logo" : ""}`}
                            style={site.logoUrl ? { backgroundImage: `url(${JSON.stringify(site.logoUrl)})` } : undefined}
                            aria-hidden="true"
                          >
                            {!site.logoUrl ? <Globe2 size={16} /> : null}
                          </span>
                          <input
                            type="url"
                            value={site.url}
                            onChange={(event) => updateSite(site.id, { url: event.target.value, logoUrl: null, previewMessage: "" })}
                            onBlur={() => void previewSite(site.id)}
                            placeholder="https://yourproduct.com"
                            required
                          />
                          <button
                            type="button"
                            disabled={site.previewBusy || !site.url.trim()}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => void previewSite(site.id, true)}
                          >
                            {site.previewBusy ? <LoaderCircle className="spinner" size={13} /> : null}
                            {site.previewBusy ? "Reading" : "Auto-fill"}
                          </button>
                        </div>
                        {site.previewMessage ? <small className="site-preview-message">{site.previewMessage}</small> : null}
                      </label>
                    </div>
                    <label>
                      <span>Description {index > 0 ? "· optional" : ""}</span>
                      <textarea
                        value={site.description}
                        onChange={(event) => updateSite(site.id, { description: event.target.value })}
                        placeholder={index === 0 ? "One sharp sentence. Give the timeline something to argue about." : "Optional one-liner for this site."}
                        minLength={index === 0 ? 12 : undefined}
                        maxLength={320}
                        rows={index === 0 ? 4 : 2}
                        required={index === 0}
                      />
                      <small>{site.description.length}/320</small>
                    </label>
                  </div>
                ))}
              </div>

              <button className="add-site-button" type="button" onClick={addSite} disabled={sites.length >= 20}>
                <Plus size={15} />
                {sites.length < 3 ? `Add site ${sites.length + 1} · included` : "Add another site · +$1"}
              </button>

              <div className="entry-price-panel">
                <div className="entry-price-head">
                  <span><BadgeDollarSign size={18} /></span>
                  <div><strong>$3 publishes up to 3 sites</strong><small>One founder profile and rank. Extra sites cost $1 each.</small></div>
                  <b>{wholeDollar(checkoutTotalCents)}</b>
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
                    <b>+ $3 entry{siteFeeCents ? ` + ${wholeDollar(siteFeeCents)} sites` : ""} = {wholeDollar(checkoutTotalCents)}</b>
                  </div>
                </label>
                {extraSiteCount ? (
                  <div className="site-fee-line"><span>{extraSiteCount} extra site{extraSiteCount === 1 ? "" : "s"} × $1</span><strong>+{wholeDollar(siteFeeCents)}</strong></div>
                ) : null}
                <p><Crown size={13} /> Only entry and boost dollars move Surface 3. Site fees never change rank.</p>
              </div>

              <button className="button button-primary publish-button" type="submit" disabled={!xHandleIsValid || !sitesAreReady || !stripeResult || !aiResult || !configurationReady || !paymentsReady || busy !== null}>
                {busy === "publish" ? <><LoaderCircle className="spinner" size={17} /> Opening secure checkout</> : <>Pay {wholeDollar(checkoutTotalCents)} &amp; publish {sites.length} site{sites.length === 1 ? "" : "s"} <ArrowRight size={17} /></>}
              </button>
              <p className="publish-note"><ShieldCheck size={14} /> One-time Stripe payment. Revenue is verified; the AI-spend badge always shows its source.</p>
            </form>
          </section>
        </div>

        <aside className="submit-preview" style={tankStyle}>
          <span className="preview-label">YOUR LIVE CARD</span>
          <div className="preview-card">
            <div className="preview-brand"><Waves size={18} /><strong>TOKEN<span>GOD</span></strong><small>{spendVerification === "api" ? "API + STRIPE VERIFIED" : "AI CLAIM · STRIPE VERIFIED"}</small></div>
            <div className="preview-copy">
              <span>@{normalizedXHandle || "yourhandle"} burned</span>
              <strong className={aiResult ? "" : "is-pending"}>{aiResult ? formatMoney(aiResult.amountUsd) : "WAITING"}</strong>
              <div className="preview-product-line">
                <span
                  className={`preview-product-logo ${primarySite.logoUrl ? "has-logo" : ""}`}
                  style={primarySite.logoUrl ? { backgroundImage: `url(${JSON.stringify(primarySite.logoUrl)})` } : undefined}
                  aria-hidden="true"
                >
                  {!primarySite.logoUrl ? <Globe2 size={12} /> : null}
                </span>
                <p>in AI tokens to build <b>{primarySite.name || "your product"}</b>{sites.length > 1 ? <em> +{sites.length - 1} more</em> : null}</p>
              </div>
            </div>
            <div className="preview-outcome">
              <span>REVENUE MADE</span><strong className={stripeResult ? "" : "is-pending"}>{stripeResult ? formatMoney(stripeResult.amountUsd) : "WAITING"}</strong>
            </div>
            <div className="preview-ratio"><span>{efficiency !== null ? formatEfficiency(efficiency) : "—"}</span><small>{efficiency !== null ? "made per $1 spent" : "efficiency after verification"}</small></div>
            <div className="preview-water"><i /><i /><i /></div>
          </div>
          <div className="preview-caption"><BadgeCheck size={14} /> This becomes a downloadable 1200×630 card.</div>
          <div className="window-note"><strong>One fair window.</strong><span>90 completed UTC days, ending yesterday. Reported and API-verified spend use the same date range.</span></div>
        </aside>
      </div>
    </Root>
  );
}
