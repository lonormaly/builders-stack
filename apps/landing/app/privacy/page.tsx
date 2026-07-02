import { pageMetadata } from "@stack/seo";

// TEMPLATE privacy policy — a server-rendered, indexable stub so the GDPR/consent story is
// complete out of the box (the consent banner links here). It is NOT legal advice: replace
// the bracketed placeholders and have counsel review before you ship. Public page, so it
// carries metadata via @stack/seo → passes `check:seo`.
export const metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How this project collects, uses, and protects personal data — a starter template to adapt with your own counsel.",
  path: "/privacy",
});

const UPDATED = "1 January 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <div className="rounded-md border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <strong>Template.</strong> This is a starting point, not legal advice. Replace every
        [bracketed] value and have a lawyer review it before launch. See <code>docs/gdpr.md</code>{" "}
        for the checklist a template can&apos;t cover.
      </div>

      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: {UPDATED}</p>

      <section className="flex flex-col gap-3 text-foreground/90 leading-7">
        <h2 className="mt-6 text-xl font-semibold">Who we are</h2>
        <p>
          [Company / Data Controller name], [address], contactable at [privacy@yourdomain]. We are
          the controller of the personal data described below.
        </p>

        <h2 className="mt-6 text-xl font-semibold">What we collect</h2>
        <p>
          Account data you give us (name, email) when you sign up; and, only after you accept the
          cookie banner, product analytics (pages viewed, interactions) via PostHog and Microsoft
          Clarity. Analytics stay <em>off</em> until you consent.
        </p>

        <h2 className="mt-6 text-xl font-semibold">Legal basis (GDPR)</h2>
        <p>
          Account data: performance of a contract. Analytics/cookies: your consent, which you can
          withdraw at any time by clearing the banner choice or contacting us.
        </p>

        <h2 className="mt-6 text-xl font-semibold">Your rights</h2>
        <p>
          You may access, export, correct, or delete your data. This project ships starter{" "}
          <code>export</code> and <code>delete</code> endpoints on the API for the access and
          erasure rights; contact [privacy@yourdomain] to exercise them.
        </p>

        <h2 className="mt-6 text-xl font-semibold">Retention &amp; sharing</h2>
        <p>
          We keep account data while your account is active. We share data only with the processors
          that run this stack (e.g. [hosting], [email], [analytics]); list them in your
          data-processing records.
        </p>

        <h2 className="mt-6 text-xl font-semibold">Contact</h2>
        <p>Questions or requests: [privacy@yourdomain].</p>
      </section>
    </main>
  );
}
