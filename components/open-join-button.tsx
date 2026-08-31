"use client";

import { usePathname, useRouter } from "next/navigation";

export function OpenJoinButton() {
  const pathname = usePathname();
  const router = useRouter();

  function openJoin() {
    if (pathname !== "/") {
      router.push("/?join=1");
      return;
    }
    window.dispatchEvent(new Event("tokengod:open-join"));
  }

  return <button className="tg-header-cta" type="button" onClick={openJoin}>Add your build <span aria-hidden="true">↗</span></button>;
}
