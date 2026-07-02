import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@stack/ui";
import { pageMetadata } from "@stack/seo";

// This page's canonical metadata — one door (@stack/seo). The layout sets the site
// default + `%s` template; this pins the "/" canonical + OG for the home route.
export const metadata = pageMetadata({
  description:
    "A real project structure your coding agent can navigate — apps · services · libs, a live app, a shared design system, and enforced module boundaries.",
  tagline: "an AI-native monorepo starter",
  path: "/",
});

// Where "Log in / Get started" sends people: the app (apps/web). Configurable — never
// hardcode the origin. Cross-app link, so a plain anchor (not next/link).
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// The blog lives on its own subdomain in prod (blog.<yourdomain>). Env-driven so it's
// never hardcoded; defaults to the local portless URL. Cross-app link → plain anchor.
const BLOG_URL = process.env.NEXT_PUBLIC_BLOG_URL ?? "http://blog.stack.localhost:1355";

const FEATURES = [
  {
    title: "apps · services · libs",
    body: "Three folders defined by exposure. Every role has a home, so you never restructure — you just add.",
  },
  {
    title: "One design system",
    body: "@stack/ui ships shadcn components + shared tokens. Web and native render the exact same brand.",
  },
  {
    title: "Batteries, env-gated",
    body: "Auth, payments, email, analytics — all wired, all silent no-ops until you add keys.",
  },
];

export default function Landing() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-24 px-6 py-16">
      {/* Nav */}
      <header className="flex items-center justify-between">
        <span className="font-semibold">Builder&apos;s Stack</span>
        <nav className="flex items-center gap-4">
          <a href={BLOG_URL} className="text-sm text-muted-foreground hover:text-foreground">
            Blog
          </a>
          <Button asChild variant="outline" size="sm">
            <a href={APP_URL}>Log in</a>
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center gap-6 text-center">
        <Badge variant="secondary">AI-native monorepo starter</Badge>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          A real project structure your agent can actually navigate.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Clone it, run one command, and you have apps, services, and shared libs — a live
          dashboard, a design system, and a repo that stays fast as it grows.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <a href={APP_URL}>Get started</a>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <a href="https://github.com/vercel-labs/portless">See the docs</a>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="flex flex-col gap-6">
        <h2 className="text-center text-2xl font-semibold">Structure that pays off</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <CardTitle className="text-lg">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="flex flex-col items-center gap-6 rounded-xl border border-border bg-muted/40 px-6 py-16 text-center">
        <Card className="w-full max-w-lg border-none bg-transparent shadow-none">
          <CardHeader>
            <CardTitle className="text-2xl">Ship faster</CardTitle>
            <CardDescription>
              Stop guessing where things live. Start inside the structure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="w-full sm:w-auto">
              <a href={APP_URL}>Get started</a>
            </Button>
          </CardContent>
        </Card>
      </section>

      <footer className="pb-8 text-center text-sm text-muted-foreground">
        <a href={BLOG_URL} className="hover:text-foreground">
          Blog
        </a>{" "}
        · MIT. Steal it, ship faster.
      </footer>
    </div>
  );
}
