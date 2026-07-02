"use client";

import * as React from "react";

import { cn } from "../../lib/cn";
import { Button } from "./button";

// Presentational cookie/analytics consent banner — DUMB by design: it renders and calls
// back, it holds no state and knows nothing about analytics. The wiring (persist the
// choice, start/stop trackers) lives in @stack/analytics' <ConsentBanner/>, which renders
// this with real handlers. Keeping this pure keeps @stack/ui free of any analytics dep.
export interface ConsentBannerProps extends React.ComponentProps<"section"> {
  /** Fired when the user accepts analytics. */
  onAccept: () => void;
  /** Fired when the user declines. */
  onReject: () => void;
  /** Href of the privacy policy (defaults to /privacy). */
  policyHref?: string;
  /** Body copy — override for your own wording / locale. */
  message?: React.ReactNode;
}

export function ConsentBanner({
  onAccept,
  onReject,
  policyHref = "/privacy",
  message,
  className,
  ...props
}: ConsentBannerProps) {
  return (
    <section
      aria-live="polite"
      aria-label="Cookie consent"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className,
      )}
      {...props}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {message ?? (
            <>
              We use cookies and analytics to understand usage. Nothing loads until you accept. See
              our{" "}
              <a href={policyHref} className="font-medium underline underline-offset-4">
                privacy policy
              </a>
              .
            </>
          )}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onReject}>
            Reject
          </Button>
          <Button size="sm" onClick={onAccept}>
            Accept
          </Button>
        </div>
      </div>
    </section>
  );
}
