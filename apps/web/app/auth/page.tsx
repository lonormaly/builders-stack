"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@stack/ui";
import { signIn, signUp, getSession, API_URL } from "./auth-client";

// The social provider the @stack/api server configures (libs/auth: socialProviders).
// The template ships GitHub; a clone swaps this + the server provider together.
const SOCIAL_PROVIDER = "github";

type Mode = "sign-in" | "sign-up";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [socialPending, setSocialPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const handlers = {
      onError: (ctx: { error: { message?: string } }) =>
        setError(ctx.error.message ?? "Something went wrong."),
      onSuccess: () => router.push("/"),
    };

    if (mode === "sign-up") {
      await signUp.email({ name, email, password }, handlers);
    } else {
      await signIn.email({ email, password }, handlers);
    }
    setPending(false);
  }

  // Social sign-in via the house popup pattern (kept textually in sync with krispy's
  // apps/web/app/_components/AuthForm.tsx onGoogle — divergences: provider name +
  // @stack/ui primitives + the "stack-oauth-done" channel).
  async function onSocial() {
    setError(null);
    setSocialPending(true);

    // Open a blank popup synchronously inside the click gesture — desktop keeps the
    // user on the sign-in page while the provider loads in the popup. Mobile browsers
    // block popups, so window.open returns null and we fall back to a full-page redirect.
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      "",
      "stack-social-auth",
      `width=${width},height=${height},left=${left},top=${top},popup=yes`,
    );

    // Ask Better Auth for the OAuth URL WITHOUT redirecting this page. Cross-origin
    // (web → api) with credentials so the eventual session cookie sticks; callbackURL
    // is a WEB-origin page (trustedOrigins allows it) that closes the popup.
    const callbackURL = `${window.location.origin}/auth/popup-complete`;
    let url: string | undefined;
    try {
      const res = await fetch(`${API_URL}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ provider: SOCIAL_PROVIDER, callbackURL, disableRedirect: true }),
      });
      url = res.ok ? (await res.json().catch(() => null))?.url : undefined;
    } catch {
      /* network / offline — handled by the !url guard below */
    }

    if (!url) {
      popup?.close();
      // Popup path failed to get a URL: fall back to the redirect flow, which surfaces
      // any real error through onError on this page.
      await signIn.social(
        { provider: SOCIAL_PROVIDER, callbackURL: "/" },
        {
          onError: (ctx: { error: { message?: string } }) =>
            setError(ctx.error.message ?? "Something went wrong."),
        },
      );
      setSocialPending(false);
      return;
    }

    if (popup) {
      // Desktop popup flow. Two ways we learn OAuth finished, whichever fires first:
      // (1) the callback page broadcasts "done"; (2) we poll popup.closed as a backstop
      // for a missed broadcast. Either way we refetch the session (no full reload) so
      // the useSession gate swaps in the signed-in view. socialPending keeps the button
      // in "Signing you in…" until the session lands.
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        bc.close();
        clearInterval(poll);
        void getSession();
        router.push("/");
      };
      const bc = new BroadcastChannel("stack-oauth-done");
      bc.onmessage = finish;
      const poll = setInterval(() => {
        if (popup.closed) finish();
      }, 500);
      popup.location.href = url;
    } else {
      // Popup blocked (mobile): full-page redirect. The callback page has no opener,
      // so it navigates itself home.
      window.location.href = url;
    }
  }

  const isSignUp = mode === "sign-up";

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <form onSubmit={onSubmit}>
          <CardHeader>
            <CardTitle>{isSignUp ? "Create an account" : "Sign in"}</CardTitle>
            <CardDescription>
              Email + password, handled by Better Auth on @stack/api.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onSocial}
              disabled={socialPending}
            >
              {socialPending ? "Signing you in…" : "Continue with GitHub"}
            </Button>
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            {isSignUp && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  required
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Working…" : isSignUp ? "Create account" : "Sign in"}
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                setError(null);
                setMode(isSignUp ? "sign-in" : "sign-up");
              }}
            >
              {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
