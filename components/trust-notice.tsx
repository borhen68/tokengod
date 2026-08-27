"use client";

import { ShieldCheck } from "lucide-react";
import { useSyncExternalStore } from "react";

const storageKey = "tokengod-trust-notice-v1";
const changeEvent = "tokengod:trust-notice-change";
let dismissedInMemory = false;

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(changeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(changeEvent, onStoreChange);
  };
}

function getSnapshot() {
  if (dismissedInMemory) return false;
  try {
    return window.localStorage.getItem(storageKey) !== "dismissed";
  } catch {
    return true;
  }
}

export function TrustNotice() {
  const visible = useSyncExternalStore(subscribe, getSnapshot, () => false);

  if (!visible) return null;

  function dismiss() {
    dismissedInMemory = true;
    try {
      window.localStorage.setItem(storageKey, "dismissed");
    } catch {
      // In-memory dismissal still works when browser storage is blocked.
    }
    window.dispatchEvent(new Event(changeEvent));
  }

  return (
    <aside className="trust-notice" role="status" aria-label="TokenGod privacy promise">
      <span className="trust-notice-icon" aria-hidden="true"><ShieldCheck size={20} /></span>
      <div>
        <strong>Verification keys are never stored.</strong>
        <p>Used once, then discarded. Only your public profile and verified totals remain.</p>
      </div>
      <button type="button" onClick={dismiss}>Got it</button>
    </aside>
  );
}
