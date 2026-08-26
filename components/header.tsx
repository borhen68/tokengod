import { LogOut } from "lucide-react";
import Link from "next/link";

import { EntryModal } from "@/components/entry-modal";
import { Logo } from "@/components/logo";
import { isApplicationConfigured, isPaymentConfigured } from "@/lib/config";
import { getViewer } from "@/lib/data";

function InitialAvatar({ name }: { name: string }) {
  return (
    <span className="mini-avatar" aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export async function Header() {
  const viewer = await getViewer();

  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo />
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link href="/#leaderboard">Leaderboard</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/?enter=1">Get ranked</Link>
        </nav>
        <div className="header-actions">
          {viewer ? (
            <>
              <span className="viewer-chip">
                <InitialAvatar name={viewer.name} />
                <span>@{viewer.xHandle}</span>
              </span>
              <form action="/auth/signout" method="post">
                <button className="icon-button" type="submit" aria-label="Sign out">
                  <LogOut size={17} />
                </button>
              </form>
            </>
          ) : null}
          <EntryModal
            viewer={viewer}
            configurationReady={isApplicationConfigured()}
            paymentsReady={isPaymentConfigured()}
            className="button button-primary header-cta"
          >
            Enter for $3
            <span aria-hidden="true">↗</span>
          </EntryModal>
        </div>
      </div>
    </header>
  );
}
