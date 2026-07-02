"use client";

import { useEffect, useState } from "react";
import { ConsentBanner as UIConsentBanner } from "@stack/ui";
import { getConsent, grantConsent, denyConsent } from "./consent";

// The WIRED consent banner: drop it next to <Analytics/> in a root layout and consent is
// handled end-to-end. It renders the dumb @stack/ui banner ONLY while the user hasn't
// decided; Accept → grantConsent() (which boots the dormant trackers, no refresh), Reject →
// denyConsent() (trackers stay off, choice remembered). Glue lives here once, so no app
// re-implements it.
export function ConsentBanner({ policyHref }: { policyHref?: string }) {
  // Start "decided" so server + first client paint render nothing (no hydration mismatch);
  // the effect then reveals the banner only when there's genuinely no stored choice.
  const [decided, setDecided] = useState(true);

  useEffect(() => {
    setDecided(getConsent() !== null);
  }, []);

  if (decided) return null;

  return (
    <UIConsentBanner
      policyHref={policyHref}
      onAccept={() => {
        grantConsent();
        setDecided(true);
      }}
      onReject={() => {
        denyConsent();
        setDecided(true);
      }}
    />
  );
}
