"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { SubmitFlow } from "@/components/submit-flow";
import { trackDataFast } from "@/lib/datafast";
import type { Viewer } from "@/lib/types";

const focusableSelector =
  'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function subscribeToClient() {
  return () => undefined;
}

export function EntryModal({
  viewer,
  configurationReady,
  paymentsReady,
  initialBidCents = 300,
  defaultOpen = false,
  initialError,
  className,
  children,
}: {
  viewer: Viewer | null;
  configurationReady: boolean;
  paymentsReady: boolean;
  initialBidCents?: number;
  defaultOpen?: boolean;
  initialError?: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const mounted = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const [open, setOpen] = useState(defaultOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    trackDataFast("entry_modal_opened", {
      entry_cents: initialBidCents,
      opened_from_url: defaultOpen,
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);

    function onDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onDocumentKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [defaultOpen, initialBidCents, open]);

  function closeModal() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
    if (defaultOpen) router.replace("/", { scroll: false });
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

  const modal = open ? (
    <div
      className="entry-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <div
        ref={dialogRef}
        className="entry-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-dialog-title"
        onKeyDown={keepFocusInside}
      >
        <div className="entry-dialog-bar">
          <span>$3 ONE-TIME ENTRY</span>
          <strong id="entry-dialog-title">Create your founder profile</strong>
          <button ref={closeRef} type="button" onClick={closeModal} aria-label="Close entry form">
            <X size={18} />
          </button>
        </div>
        <div className="entry-dialog-scroll">
          <SubmitFlow
            viewer={viewer}
            configurationReady={configurationReady}
            paymentsReady={paymentsReady}
            initialBidCents={initialBidCents}
            initialError={initialError}
            variant="modal"
          />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        className={className}
        type="button"
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
