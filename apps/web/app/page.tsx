import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  tokens,
} from "@stack/ui";
import { pageMetadata } from "@stack/seo";
import { SessionCard } from "./auth/SessionCard";

// This route's canonical metadata — one door (@stack/seo). Layout owns the site
// default + `%s` template; this pins the "/" canonical + OG for the home route.
export const metadata = pageMetadata({
  title: "Design system",
  description:
    "One design system, every surface — @stack/ui components and shared tokens rendered by both web and native, wired to a live Better Auth login.",
  path: "/",
});

// Proves the JS token layer is shared: these swatches are driven by @stack/ui's `tokens`
// object — the exact same values React Native consumes (see apps/mobile).
function TokenSwatches() {
  return (
    <div className="flex flex-wrap gap-3">
      {Object.entries(tokens.colors.light).map(([name, value]) => (
        <div key={name} className="flex flex-col items-center gap-1">
          <span
            className="h-12 w-12 rounded-md border border-border"
            style={{ backgroundColor: value }}
          />
          <span className="text-[10px] text-muted-foreground">{name}</span>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-3">
        <Badge>@stack/ui</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">One design system, every surface.</h1>
        <p className="max-w-2xl text-muted-foreground">
          Every component below is imported from <code>@stack/ui</code> — the same package{" "}
          <code>apps/mobile</code> pulls tokens from. Import by package name, never a deep path.
        </p>
      </section>

      {/* Live login demo — Better Auth against @stack/api */}
      <SessionCard />

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Badges</h2>
        <div className="flex flex-wrap gap-3">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Form</h2>
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Join the waitlist</CardTitle>
            <CardDescription>Inputs and labels, straight from the shared kit.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" />
            </div>
            <Button className="w-full">Notify me</Button>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Design tokens</h2>
        <p className="text-sm text-muted-foreground">
          Rendered from the <code>tokens</code> export — shared verbatim with native.
        </p>
        <TokenSwatches />
      </section>
    </div>
  );
}
