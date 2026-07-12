"use client";

import { useEffect } from "react";

// Where Better Auth lands the browser after social OAuth completes (passed as
// `callbackURL` from the auth page — a WEB-origin page, so the session cookie for the
// api origin is already set by the time we get here).
//
// Popup flow: signal the opener that OAuth is done, then close ourselves. We use
// BroadcastChannel (not postMessage / popup.closed polling) because COOP isolates
// the opener from the popup — same-origin BroadcastChannel is the reliable channel.
// Redirect flow (popup was blocked): we ARE the main window, so just go home; the
// gate revalidates the session on mount.
export default function PopupComplete() {
  useEffect(() => {
    if (window.opener) {
      const bc = new BroadcastChannel("stack-oauth-done");
      bc.postMessage("done");
      bc.close();
      window.close();
    } else {
      window.location.href = "/";
    }
  }, []);

  return (
    <div className="mx-auto max-w-md">
      <p className="text-sm text-muted-foreground">One moment…</p>
    </div>
  );
}
