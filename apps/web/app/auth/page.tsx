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
import { signIn, signUp } from "./auth-client";

type Mode = "sign-in" | "sign-up";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
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
