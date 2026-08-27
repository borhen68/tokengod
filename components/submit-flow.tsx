"use client";

import {
  AtSign,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarRange,
  Check,
  EyeOff,
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
import type { LaunchOffer } from "@/lib/launch-offer";
import {
  projectOutcomeOptions,
  type ProjectOutcome,
} from "@/lib/project-outcomes";
import { RevenueProviderIcon } from "@/components/revenue-provider-icon";
import {
  defaultReportingPeriod,
  getReportingPeriodDefinition,
  getSubscriptionMonthLimit,
  reportingPeriods,
  type ReportingPeriod,
} from "@/lib/reporting-period";
import {
  getRevenueProvider,
  revenueProviders,
  type RevenueProvider,
} from "@/lib/revenue-providers";
import {
  calculateSubscriptionSpend,
  subscriptionPlans,
  type SubscriptionPlanId,
} from "@/lib/subscription-plans";
import type { Viewer } from "@/lib/types";

type Provider = "openai" | "anthropic";
type SpendVerification = "api" | "self_reported";
type VerificationResult = {
  receipt: string;
  amountUsd: number;
  periodStart: string;
  periodEnd: string;
  period: ReportingPeriod;
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
  launchOffer,
  preferLaunchFree = false,
  initialError,
  variant = "page",
}: {
  viewer: Viewer | null;
  configurationReady: boolean;
  paymentsReady: boolean;
  initialBidCents?: number;
  launchOffer: LaunchOffer;
  preferLaunchFree?: boolean;
  initialError?: string;
  variant?: "page" | "modal";
}) {
  const router = useRouter();
  const submissionIdRef = useRef<string | null>(null);
  const lastPreviewedUrlsRef = useRef<Record<string, string>>({});
  const lastProfiledHandleRef = useRef("");
  const xLookupSequenceRef = useRef(0);
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [revenueProvider, setRevenueProvider] = useState<RevenueProvider>("stripe");
  const [spendVerification, setSpendVerification] = useState<SpendVerification>("self_reported");
  const [anonymousEntry, setAnonymousEntry] = useState(false);
  const [projectOutcome, setProjectOutcome] = useState<ProjectOutcome>("revenue");
  const [founderLesson, setFounderLesson] = useState("");
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [xHandle, setXHandle] = useState(viewer?.xHandle ?? "");
  const [xProfile, setXProfile] = useState<XProfileResult | null>(() =>
    viewer
      ? { found: true, handle: viewer.xHandle, name: viewer.name, avatarUrl: viewer.avatarUrl }
      : null,
  );
  const [xProfileBusy, setXProfileBusy] = useState(false);
  const [xProfileMessage, setXProfileMessage] = useState("");
  const [revenueKey, setRevenueKey] = useState("");
  const [aiKey, setAiKey] = useState("");
  const [reportingPeriod, setReportingPeriod] = useState<ReportingPeriod>(defaultReportingPeriod);
  const [subscriptionPlanId, setSubscriptionPlanId] = useState<SubscriptionPlanId>("claude-pro");
  const [subscriptionMonths, setSubscriptionMonths] = useState(3);
  const [revenueResult, setRevenueResult] = useState<VerificationResult | null>(null);
  const [aiResult, setAiResult] = useState<VerificationResult | null>(null);
  const [busy, setBusy] = useState<"revenue" | "ai" | "publish" | null>(null);
  const [error, setError] = useState(initialError || "");
  const [sites, setSites] = useState<SiteDraft[]>(() => [emptySite("primary")]);
  const bidCents = Math.min(100_000, Math.max(300, Math.round(initialBidCents / 100) * 100));

  const normalizedXHandle = xHandle.trim().replace(/^@/, "");
  const xHandleIsValid = /^[A-Za-z0-9_]{1,15}$/.test(normalizedXHandle);
  const identityIsReady = anonymousEntry || xHandleIsValid;
  const primarySite = sites[0];
  const sitesAreReady = sites.every((site, index) =>
    site.name.trim().length >= 2
    && site.url.trim().length > 0
    && (index > 0 || site.description.trim().length >= 12),
  );
  const extraSiteCount = Math.max(0, sites.length - 3);
  const siteFeeCents = extraSiteCount * 100;
  const launchEligible = preferLaunchFree && launchOffer.remaining > 0 && bidCents === 300 && sites.length <= 3;
  const checkoutTotalCents = launchEligible ? 0 : bidCents + siteFeeCents;
  const periodDefinition = getReportingPeriodDefinition(reportingPeriod);
  const subscriptionMonthLimit = getSubscriptionMonthLimit(reportingPeriod);
  const subscriptionMonthOptions = Array.from(
    { length: subscriptionMonthLimit },
    (_, index) => index + 1,
  );
  const subscriptionSelection = calculateSubscriptionSpend(
    subscriptionPlanId,
    subscriptionMonths,
    reportingPeriod,
  );
  const selectedRevenueProvider = getRevenueProvider(revenueProvider);
  const maxUnlockedStep = revenueResult && aiResult
    ? 4
    : revenueResult
      ? 3
      : identityIsReady
        ? 2
        : 1;
  const previewProofLabel = revenueResult && aiResult
    ? `${aiResult.verificationMethod === "api" ? "AI VERIFIED" : "AI REPORTED"} · ${selectedRevenueProvider.name.toUpperCase()} VERIFIED`
    : `${Number(Boolean(revenueResult)) + Number(Boolean(aiResult))}/2 NUMBERS READY`;

  function getSubmissionId() {
    submissionIdRef.current ||= crypto.randomUUID();
    return submissionIdRef.current;
  }

  const efficiency = useMemo(() => {
    if (!revenueResult || !aiResult || aiResult.amountUsd <= 0) return null;
    return revenueResult.amountUsd / aiResult.amountUsd;
  }, [aiResult, revenueResult]);

  const waterLevel = aiResult
    ? Math.min(92, Math.max(12, 14 + Math.log10(aiResult.amountUsd + 1) * 19))
    : 4;
  const tankStyle = { "--water-level": `${waterLevel}%` } as CSSProperties;
  const Root = variant === "modal" ? "div" : "main";

  function wholeDollar(cents: number) {
    return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
  }

  async function previewXProfile(force = false) {
    if (anonymousEntry) return;
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

  function chooseIdentityMode(anonymous: boolean) {
    if (anonymous === anonymousEntry) return;
    setAnonymousEntry(anonymous);
    setXProfileMessage("");
    setXProfileBusy(false);
    xLookupSequenceRef.current += 1;
    trackDataFast("identity_mode_selected", {
      identity_visibility: anonymous ? "anonymous" : "public",
    });
  }

  async function verifyRevenue(event: FormEvent) {
    event.preventDefault();
    setBusy("revenue");
    setError("");
    try {
      const result = await postJson<VerificationResult>("/api/verify/revenue", {
        apiKey: revenueKey,
        provider: revenueProvider,
        submissionId: getSubmissionId(),
        period: reportingPeriod,
      });
      setRevenueResult(result);
      setProjectOutcome((current) => {
        if (current === "shut_down") return current;
        return result.amountUsd === 0 ? "pre_revenue" : "revenue";
      });
      setRevenueKey("");
      if (variant === "modal") setActiveStep(3);
      trackDataFast("revenue_verified", {
        provider: revenueProvider,
        reporting_period: reportingPeriod,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `${selectedRevenueProvider.name} verification failed.`);
    } finally {
      setBusy(null);
    }
  }

  function chooseRevenueProvider(next: RevenueProvider) {
    if (next === revenueProvider) return;
    setRevenueProvider(next);
    setRevenueResult(null);
    setRevenueKey("");
    setError("");
  }

  async function verifyAi(event: FormEvent) {
    event.preventDefault();
    setBusy("ai");
    setError("");
    try {
      const result = await postJson<VerificationResult>(`/api/verify/${provider}`, {
        apiKey: aiKey,
        submissionId: getSubmissionId(),
        period: reportingPeriod,
      });
      setAiResult(result);
      setAiKey("");
      if (variant === "modal") setActiveStep(4);
      trackDataFast("ai_spend_api_verified", {
        provider,
        reporting_period: reportingPeriod,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI spend verification failed.");
    } finally {
      setBusy(null);
    }
  }

  async function reportAiSpend(event: FormEvent) {
    event.preventDefault();
    if (!subscriptionSelection) {
      setError("Choose an AI subscription plan and the number of months you paid for it.");
      return;
    }

    setBusy("ai");
    setError("");
    try {
      const result = await postJson<VerificationResult>("/api/verify/self-reported", {
        planId: subscriptionSelection.plan.id,
        months: subscriptionSelection.months,
        submissionId: getSubmissionId(),
        period: reportingPeriod,
      });
      setAiResult(result);
      if (variant === "modal") setActiveStep(4);
      trackDataFast("ai_spend_reported", {
        provider: subscriptionSelection.plan.provider,
        plan: subscriptionSelection.plan.id,
        months: subscriptionSelection.months,
        amount_usd: subscriptionSelection.amountUsd,
        reporting_period: reportingPeriod,
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

  function chooseReportingPeriod(next: ReportingPeriod) {
    if (next === reportingPeriod) return;
    const nextMonthLimit = getSubscriptionMonthLimit(next);
    setReportingPeriod(next);
    setSubscriptionMonths((current) => Math.min(current, nextMonthLimit));
    setRevenueResult(null);
    setAiResult(null);
    setError("");
    if (variant === "modal" && activeStep > 2) setActiveStep(2);
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
    if (!revenueResult || !aiResult) {
      setError("Verify revenue and AI spend before publishing.");
      return;
    }

    setBusy("publish");
    setError("");
    trackDataFast(launchEligible ? "launch_free_claim_started" : "entry_checkout_started", {
      site_count: sites.length,
      entry_cents: bidCents,
      site_fee_cents: siteFeeCents,
      total_cents: checkoutTotalCents,
      spend_source: aiResult.verificationMethod,
      identity_visibility: anonymousEntry ? "anonymous" : "public",
      project_outcome: projectOutcome,
    });
    try {
      const result = await postJson<{ url?: string; listingId?: string }>("/api/checkout/entry", {
        submissionId: getSubmissionId(),
        anonymous: anonymousEntry,
        xHandle: anonymousEntry ? "" : normalizedXHandle,
        products: sites.map((site) => ({
          name: site.name,
          url: site.url,
          description: site.description,
          logoUrl: site.logoUrl,
        })),
        tokenReceipt: aiResult.receipt,
        revenueReceipt: revenueResult.receipt,
        projectOutcome,
        founderLesson,
        bidCents,
        claimLaunchFree: launchEligible,
      });
      if (result.listingId) {
        if (launchEligible) {
          trackDataFast("launch_free_profile_published", {
            listing_id: result.listingId,
            remaining_before_claim: launchOffer.remaining,
          });
        }
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
      {variant === "modal" ? (
        <div className="submit-modal-intro">
          <div className="submit-modal-copy">
            <span>GET RANKED IN FOUR STEPS</span>
            <h1>Show the <span>spend.</span> <em>Prove the return.</em></h1>
            <p>Your product gets the spotlight. You decide whether your identity does.</p>
            <div>
              <span><Check size={13} /> Up to 3 products</span>
              <span><Check size={13} /> Share card included</span>
              <span><ShieldCheck size={13} /> Credentials never stored</span>
            </div>
          </div>
          <div className={`submit-modal-ticket ${launchEligible ? "is-launch-free" : ""}`} aria-label={launchEligible ? `${launchOffer.remaining} free launch passes left` : "$3 minimum one-time entry"}>
            <span>{launchEligible ? "FOUNDING FIVE" : "ONE-TIME ENTRY"}</span>
            <strong>{launchEligible ? "$0" : "$3+"}</strong>
            <small>{launchEligible ? `${launchOffer.remaining} passes left` : "No subscription"}</small>
          </div>
        </div>
      ) : (
        <div className="submit-intro">
          <div>
            <span className="eyebrow">{preferLaunchFree && launchOffer.remaining > 0 ? `FOUNDING FIVE · ${launchOffer.remaining} FREE LEFT` : "$3 ONE-TIME ENTRY"}</span>
            <h1>Show the spend.<br /><span>Prove the return.</span></h1>
            <p>One founder profile, up to three products, and a shareable card. Your bid ranks Top Funded; reactions rank Respect and Roast.</p>
          </div>
          <div className="privacy-seal">
            <ShieldCheck size={25} />
            <div><strong>Trust is visible</strong><span>API spend is verified. Personal-plan spend is clearly marked Founder Reported.</span></div>
          </div>
        </div>
      )}

      {!configurationReady ? (
        <div className="setup-notice" role="status">
          <strong>Verification setup needed</strong>
          Add the Turso and receipt-secret environment variables from <code>.env.example</code> to enable verification.
        </div>
      ) : null}
      {!paymentsReady && !launchEligible ? (
        <div className="setup-notice" role="status">
          <strong>Checkout setup needed</strong>
          Add the TokenGod Stripe secret key from <code>.env.example</code> to accept entry and extra-site payments.
        </div>
      ) : null}
      {error ? <div className="submit-error" role="alert">{error}</div> : null}

      {variant === "modal" ? (
        <nav className="submit-progress" aria-label="Submission progress">
          {([
            [1, "Identity", "Choose", identityIsReady],
            [2, "Revenue", "Verify", Boolean(revenueResult)],
            [3, "AI spend", "Measure", Boolean(aiResult)],
            [4, "Product", "Publish", false],
          ] as const).map(([number, label, action, complete]) => (
            <button
              className={`${activeStep === number ? "is-active" : ""} ${complete ? "is-complete" : ""}`}
              type="button"
              disabled={number > maxUnlockedStep}
              aria-current={activeStep === number ? "step" : undefined}
              onClick={() => setActiveStep(number)}
              key={number}
            >
              <span>{complete ? <Check size={14} /> : number}</span>
              <span><strong>{label}</strong><small>{action}</small></span>
            </button>
          ))}
        </nav>
      ) : null}

      {variant === "page" || activeStep === 2 || activeStep === 3 ? (
        <section className="reporting-window-panel" aria-labelledby="reporting-window-title">
          <div className="reporting-window-copy">
            <CalendarRange size={18} />
            <div>
              <span>REPORTING WINDOW</span>
              <strong id="reporting-window-title">Use one period for both numbers</strong>
            </div>
          </div>
          <div className="reporting-period-switch" role="group" aria-label="Reporting window">
            {reportingPeriods.map((period) => (
              <button
                className={reportingPeriod === period.id ? "is-active" : ""}
                type="button"
                aria-pressed={reportingPeriod === period.id}
                disabled={busy !== null}
                onClick={() => chooseReportingPeriod(period.id)}
                key={period.id}
              >
                <strong>{period.label}</strong>
                <small>{period.shortLabel}</small>
              </button>
            ))}
          </div>
          <p>{periodDefinition.description}. Revenue and AI spend must use this exact window.</p>
        </section>
      ) : null}

      <div className="submit-layout">
        <div className="submit-steps">
          <section className={`submit-card ${identityIsReady ? "is-complete" : ""} ${variant === "modal" ? activeStep === 1 ? "is-active-step" : "is-hidden-step" : ""}`}>
            <header>
              <StepState done={identityIsReady} number="1" />
              <div><span>IDENTITY</span><h2>Choose how you appear</h2></div>
              {identityIsReady ? <span className="verified-pill"><Check size={14} /> {anonymousEntry ? "Anonymous" : "Ready"}</span> : null}
            </header>
            <div className="step-body">
              <p>Choose public credit or private identity. Your product stays clickable and your proof label stays visible either way.</p>
              <div className="identity-mode-switch" role="group" aria-label="Public identity choice">
                <button
                  className={!anonymousEntry ? "is-active" : ""}
                  type="button"
                  aria-pressed={!anonymousEntry}
                  onClick={() => chooseIdentityMode(false)}
                >
                  <AtSign size={17} />
                  <span><strong>Use my X</strong><small>Name, photo and @handle</small></span>
                </button>
                <button
                  className={anonymousEntry ? "is-active is-anonymous" : ""}
                  type="button"
                  aria-pressed={anonymousEntry}
                  onClick={() => chooseIdentityMode(true)}
                >
                  <EyeOff size={17} />
                  <span><strong>Stay anonymous</strong><small>Hide identity, keep product public</small></span>
                </button>
              </div>
              {!anonymousEntry ? (
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
                    {xHandle && !xHandleIsValid ? "Use 1–15 letters, numbers, or underscores." : "You can include or omit the @. No login or posting permission."}
                  </small>
                </label>
              ) : (
                <div className="anonymous-profile-preview">
                  <span aria-hidden="true"><EyeOff size={17} /></span>
                  <div><strong>Private founder</strong><small>Your product, rank, and proof stay public.</small></div>
                  <ShieldCheck size={16} />
                </div>
              )}
              {!anonymousEntry && xProfileBusy ? (
                <div className="x-profile-status" role="status">
                  <LoaderCircle className="spinner" size={15} /> Finding the public X profile…
                </div>
              ) : !anonymousEntry && xProfile?.found ? (
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
              ) : !anonymousEntry && xProfileMessage ? (
                <div className="x-profile-status">{xProfileMessage}</div>
              ) : null}
              {variant === "modal" ? (
                <button
                  className="button button-primary modal-continue-button"
                  type="button"
                  disabled={!identityIsReady}
                  onClick={() => setActiveStep(2)}
                >
                  Continue to revenue <ArrowRight size={16} />
                </button>
              ) : null}
            </div>
          </section>

          <section className={`submit-card ${revenueResult ? "is-complete" : ""} ${variant === "modal" ? activeStep === 2 ? "is-active-step" : "is-hidden-step" : ""}`}>
            <header>
              <StepState done={Boolean(revenueResult)} number="2" />
              <div><span>THE OUTCOME</span><h2>Verify revenue</h2></div>
              {revenueResult ? <span className="verified-pill"><BadgeCheck size={14} /> {selectedRevenueProvider.name} · {formatMoney(revenueResult.amountUsd)}</span> : null}
            </header>
            <form className="step-body" onSubmit={verifyRevenue}>
              <div className="revenue-provider-grid" role="group" aria-label="Revenue provider">
                {revenueProviders.map((candidate) => (
                  <button
                    className={revenueProvider === candidate.id ? "is-active" : ""}
                    type="button"
                    aria-pressed={revenueProvider === candidate.id}
                    disabled={busy !== null}
                    onClick={() => chooseRevenueProvider(candidate.id)}
                    key={candidate.id}
                  >
                    <span
                      className="revenue-provider-mark"
                      style={{
                        "--provider-color": candidate.color,
                        "--provider-tint": candidate.tint,
                      } as CSSProperties}
                      aria-hidden="true"
                    >
                      <RevenueProviderIcon provider={candidate.id} />
                    </span>
                    <strong>{candidate.name}</strong>
                    {revenueProvider === candidate.id ? <Check size={13} /> : null}
                  </button>
                ))}
              </div>
              <p>{selectedRevenueProvider.instructions} Only USD activity inside the selected {periodDefinition.label.toLowerCase()} window is accepted.</p>
              <div className="revenue-key-note">
                <ShieldCheck size={15} />
                <span>Your credential is sent directly to TokenGod for this one verification request, then discarded. It is never saved in Turso.</span>
              </div>
              <label className="secret-input">
                <span>{selectedRevenueProvider.credentialLabel}</span>
                <div><LockKeyhole size={16} /><input type="password" value={revenueKey} onChange={(event) => setRevenueKey(event.target.value)} placeholder={selectedRevenueProvider.placeholder} autoComplete="off" disabled={Boolean(revenueResult)} required /></div>
              </label>
              <div className="form-row">
                <button className="button button-secondary" type="submit" disabled={!configurationReady || busy !== null || Boolean(revenueResult)}>
                  {busy === "revenue" ? <><LoaderCircle className="spinner" size={16} /> Checking {selectedRevenueProvider.name}</> : revenueResult ? <><Check size={16} /> Revenue verified</> : <>Verify {selectedRevenueProvider.name} · {periodDefinition.shortLabel} <ArrowRight size={16} /></>}
                </button>
                <a className="helper-link" href={selectedRevenueProvider.docsUrl} target="_blank" rel="noopener noreferrer">{selectedRevenueProvider.docsLabel} <ExternalLink size={12} /></a>
              </div>
            </form>
          </section>

          <section className={`submit-card ${aiResult ? "is-complete" : ""} ${variant === "modal" ? activeStep === 3 ? "is-active-step" : "is-hidden-step" : ""}`}>
            <header>
              <StepState done={Boolean(aiResult)} number="3" />
              <div><span>THE BURN</span><h2>Measure AI spend</h2></div>
              {aiResult ? (
                <span className={`verified-pill ${aiResult.verificationMethod === "self_reported" ? "is-reported" : ""}`}>
                  {aiResult.verificationMethod === "api" ? <BadgeCheck size={14} /> : <AtSign size={14} />}
                  {aiResult.verificationMethod === "api" ? "API verified" : "Reported"} · {periodDefinition.shortLabel} · {formatMoney(aiResult.amountUsd)}
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
              {spendVerification === "self_reported" ? (
                <>
                  <p>Choose your subscription and how many completed billing months you paid {reportingPeriod === "all" ? "since January 2020" : `during the last ${periodDefinition.label.toLowerCase()}`}. TokenGod calculates the burn automatically.</p>
                  <div className="subscription-fields">
                    <label className="subscription-field">
                      <span>Subscription plan</span>
                      <select
                        value={subscriptionPlanId}
                        onChange={(event) => {
                          setSubscriptionPlanId(event.target.value as SubscriptionPlanId);
                          setAiResult(null);
                          setError("");
                        }}
                        disabled={busy !== null}
                      >
                        {subscriptionPlans.map((plan) => (
                          <option value={plan.id} key={plan.id}>{plan.name} · ${plan.monthlyUsd}/mo</option>
                        ))}
                      </select>
                    </label>
                    <label className="subscription-field">
                      <span>Months paid · max {subscriptionMonthLimit}</span>
                      {reportingPeriod === "all" ? (
                        <input
                          type="number"
                          min={1}
                          max={subscriptionMonthLimit}
                          step={1}
                          value={subscriptionMonths}
                          onChange={(event) => {
                            setSubscriptionMonths(Number(event.target.value));
                            setAiResult(null);
                            setError("");
                          }}
                          disabled={busy !== null}
                          inputMode="numeric"
                        />
                      ) : (
                        <select
                          value={subscriptionMonths}
                          onChange={(event) => {
                            setSubscriptionMonths(Number(event.target.value));
                            setAiResult(null);
                            setError("");
                          }}
                          disabled={busy !== null}
                        >
                          {subscriptionMonthOptions.map((months) => (
                            <option value={months} key={months}>{months} {months === 1 ? "month" : "months"}</option>
                          ))}
                        </select>
                      )}
                    </label>
                  </div>
                  {subscriptionSelection ? (
                    <div className="subscription-total" aria-live="polite">
                      <div>
                        <span>Calculated {periodDefinition.label} burn</span>
                        <small>{subscriptionSelection.months} × ${subscriptionSelection.plan.monthlyUsd}/month · {subscriptionSelection.plan.name}</small>
                      </div>
                      <strong>{formatMoney(subscriptionSelection.amountUsd)}</strong>
                    </div>
                  ) : null}
                  <div className="reporting-disclosure"><AtSign size={14} /><span>Your card and leaderboard row will say <strong>Founder Reported</strong>. API-verified entries win reaction-count ties.</span></div>
                  <button className="button button-secondary" type="submit" disabled={!configurationReady || busy !== null || Boolean(aiResult)}>
                    {busy === "ai" ? <><LoaderCircle className="spinner" size={16} /> Recording the burn</> : aiResult ? <><Check size={16} /> Spend recorded</> : <>Record {formatMoney(subscriptionSelection?.amountUsd ?? 0)} subscription spend <Waves size={16} /></>}
                  </button>
                </>
              ) : (
                <>
                  <div className="provider-switch" role="group" aria-label="AI provider">
                    <button className={provider === "anthropic" ? "is-active" : ""} type="button" onClick={() => { setProvider("anthropic"); setAiResult(null); }}>Claude / Anthropic</button>
                    <button className={provider === "openai" ? "is-active" : ""} type="button" onClick={() => { setProvider("openai"); setAiResult(null); }}>ChatGPT / OpenAI</button>
                  </div>
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

          <section className={`submit-card ${sitesAreReady ? "has-content" : ""} ${variant === "modal" ? activeStep === 4 ? "is-active-step" : "is-hidden-step" : ""}`}>
            <header>
              <StepState done={sitesAreReady} number="4" />
              <div><span>OUTCOME + BUILDS</span><h2>{preferLaunchFree && launchOffer.remaining > 0 ? "Add up to 3 sites with your free pass" : "Add up to 3 sites for the same $3"}</h2></div>
            </header>
            <form className="step-body product-form" onSubmit={publish}>
              <fieldset className="project-outcome-fieldset">
                <legend>Where did this project end up? <small>Founder selected · revenue stays verified</small></legend>
                <div className="project-outcome-switch" role="group" aria-label="Project outcome">
                  {projectOutcomeOptions.map((outcome) => {
                    const verifiedRevenue = revenueResult?.amountUsd;
                    const conflictsWithRevenue = verifiedRevenue !== undefined
                      && ((outcome.id === "revenue" && verifiedRevenue === 0)
                        || (outcome.id === "pre_revenue" && verifiedRevenue > 0));
                    return (
                      <button
                        className={projectOutcome === outcome.id ? "is-active" : ""}
                        type="button"
                        aria-pressed={projectOutcome === outcome.id}
                        disabled={conflictsWithRevenue}
                        onClick={() => setProjectOutcome(outcome.id)}
                        key={outcome.id}
                      >
                        <strong>{outcome.label}</strong>
                        <span>{outcome.description}</span>
                      </button>
                    );
                  })}
                </div>
                {projectOutcome === "shut_down" ? (
                  <label className="founder-lesson-field">
                    <span>What did you learn? · optional</span>
                    <textarea
                      value={founderLesson}
                      onChange={(event) => setFounderLesson(event.target.value)}
                      placeholder="One useful sentence for the next builder."
                      maxLength={180}
                      rows={2}
                    />
                    <small>{founderLesson.length}/180</small>
                  </label>
                ) : null}
              </fieldset>

              <div className="site-bundle-note">
                <Layers3 size={16} />
                <span><strong>{Math.min(sites.length, 3)}/3 included{extraSiteCount ? ` · ${extraSiteCount} paid extra` : ""}</strong> · {preferLaunchFree && launchOffer.remaining > 0 ? "A launch pass covers up to 3 sites. Site 4 switches this submission to the paid entry." : "Site 4 and beyond add $1 each."} Every site shares one founder score.</span>
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
                  <div><strong>{launchEligible ? "Founding Five launch pass" : "Leaderboard entry"}</strong><small>{launchEligible ? `${launchOffer.remaining} free passes remain at this moment` : "$3 minimum · founder profile + up to 3 products"}</small></div>
                  <b>{wholeDollar(checkoutTotalCents)}</b>
                </div>
                {launchEligible ? (
                  <div className="entry-price-rule is-launch-credit">
                    <span>Base founder profile</span>
                    <strong><s>$3</s> FREE</strong>
                  </div>
                ) : (
                  <div className="entry-price-rule">
                    <span>Base entry</span>
                    <strong>$3</strong>
                  </div>
                )}
                {!launchEligible && bidCents > 300 ? (
                  <div className="entry-price-rule">
                    <span>Top Funded backing</span>
                    <strong>+{wholeDollar(bidCents - 300)}</strong>
                  </div>
                ) : null}
                {extraSiteCount ? (
                  <div className="entry-price-rule">
                    <span>{extraSiteCount} extra product{extraSiteCount === 1 ? "" : "s"} × $1</span>
                    <strong>+{wholeDollar(siteFeeCents)}</strong>
                  </div>
                ) : null}
                <div className="entry-price-total">
                  <span>{launchEligible ? "Due today" : "Total due today"}</span>
                  <b>{wholeDollar(checkoutTotalCents)}</b>
                </div>
                <p><ShieldCheck size={13} /> {launchEligible ? "Your profile starts with $0 paid backing. Proof, weekly votes, and reactions earn every non-paid rank." : "Paid backing sets Top Funded rank only. It never buys Respect, Roast, or efficiency standing."}</p>
              </div>

              <button className="button button-primary publish-button" type="submit" disabled={!identityIsReady || !sitesAreReady || !revenueResult || !aiResult || !configurationReady || (!launchEligible && !paymentsReady) || busy !== null}>
                {busy === "publish" ? <><LoaderCircle className="spinner" size={17} /> {launchEligible ? "Claiming launch pass" : "Opening secure checkout"}</> : <>{launchEligible ? "Publish free" : `Pay ${wholeDollar(checkoutTotalCents)} & publish`} {sites.length} site{sites.length === 1 ? "" : "s"} <ArrowRight size={17} /></>}
              </button>
              <p className="publish-note"><ShieldCheck size={14} /> {launchEligible ? "No card required. The pass is claimed only after every proof check succeeds." : "One-time Stripe payment."} Revenue and AI-spend proof labels stay visible.</p>
            </form>
          </section>
        </div>

        <aside className="submit-preview" style={tankStyle}>
          <span className="preview-label"><span>YOUR LIVE PROOF CARD</span>{variant === "modal" ? <em>STEP {activeStep} / 4</em> : null}</span>
          <div className="preview-card">
            <div className="preview-brand"><Waves size={18} /><strong>TOKEN<span>GOD</span></strong><small>{previewProofLabel}</small></div>
            <div className="preview-copy">
              <span>{anonymousEntry ? "Private founder" : `@${normalizedXHandle || "yourhandle"}`} burned</span>
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
            <div className={`preview-outcome ${projectOutcome === "shut_down" ? "is-failure" : ""}`}>
              <span>{projectOutcome === "shut_down" ? "SHUT DOWN · REVENUE" : projectOutcome === "pre_revenue" ? "PRE-REVENUE" : "REVENUE MADE"}</span><strong className={revenueResult ? "" : "is-pending"}>{revenueResult ? formatMoney(revenueResult.amountUsd) : "WAITING"}</strong>
            </div>
            <div className="preview-ratio"><span>{efficiency !== null ? formatEfficiency(efficiency) : "—"}</span><small>{efficiency !== null ? "made per $1 spent" : "efficiency after verification"}</small></div>
            <div className="preview-water"><i /><i /><i /></div>
          </div>
          <div className="preview-caption"><BadgeCheck size={14} /> This becomes a downloadable 1200×630 card.</div>
          {variant === "modal" ? (
            <div className="preview-value-note">
              {anonymousEntry ? <EyeOff size={17} /> : <ExternalLink size={17} />}
              <div>
                <strong>{anonymousEntry ? "Anonymous, not invisible." : "Turn proof into product traffic."}</strong>
                <span>{anonymousEntry ? "Your name stays private. Your product remains visible, clickable, and ranked." : "Your founder identity, product link, and proof travel together."}</span>
              </div>
            </div>
          ) : null}
          <div className="window-note"><strong>{periodDefinition.label} · one fair window.</strong><span>{periodDefinition.description}. Reported and API-verified spend use the same date range.</span></div>
        </aside>
      </div>
    </Root>
  );
}
