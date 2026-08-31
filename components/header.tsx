import { LogOut } from "lucide-react";

import { Logo } from "@/components/logo";
import { OpenJoinButton } from "@/components/open-join-button";
import { PublicTrafficBadge } from "@/components/public-traffic-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { getViewer } from "@/lib/data";

function InitialAvatar({ name }: { name: string }) {
  return <span className="tg-mini-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>;
}

export async function Header() {
  const viewer = await getViewer();

  return (
    <header className="tg-header">
      <div className="tg-header-inner">
        <Logo />
        <nav className="tg-nav" aria-label="Live analytics"><PublicTrafficBadge /></nav>
        <div className="tg-header-actions">
          {viewer ? (
            <>
              <span className="tg-viewer-chip"><InitialAvatar name={viewer.name} /><span>@{viewer.xHandle}</span></span>
              <form action="/auth/signout" method="post"><button className="tg-icon-button" type="submit" aria-label="Sign out"><LogOut size={15} /></button></form>
            </>
          ) : null}
          <ThemeToggle />
          <OpenJoinButton />
        </div>
      </div>
    </header>
  );
}
