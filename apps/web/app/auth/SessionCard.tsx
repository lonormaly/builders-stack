"use client";

import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@stack/ui";
import { signOut, useSession } from "./auth-client";

// The protected area. Signed out → a prompt. Signed in → the user + a sign-out button.
// This is the end-to-end proof that Better Auth (client) ↔ @stack/api (server) works.
export function SessionCard() {
  const { data: session, isPending, error } = useSession();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Your session</CardTitle>
          <CardDescription>Live, via Better Auth + @stack/api</CardDescription>
        </div>
        {session ? <Badge>signed in</Badge> : <Badge variant="outline">signed out</Badge>}
      </CardHeader>
      <CardContent>
        {isPending ? (
          <p className="text-sm text-muted-foreground">Checking session…</p>
        ) : error ? (
          <p className="text-sm text-destructive">
            Auth API unreachable — start it with ./tilt_up.sh. ({error.message})
          </p>
        ) : session ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-border p-4">
              <p className="text-sm font-medium">{session.user.name || session.user.email}</p>
              <p className="text-sm text-muted-foreground">{session.user.email}</p>
            </div>
            <Button variant="outline" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              You&apos;re a guest. This area is only visible to signed-in users.
            </p>
            <Button asChild>
              <Link href="/auth">Sign in or create an account</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
