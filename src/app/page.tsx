import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button, Card, Disclaimer } from "@/components/ui";

export default function Landing() {
  return (
    <div>
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="sans text-xs uppercase tracking-[0.25em] text-[#c4a574]">AY 2026–27 · ITR-4 & ITR-3</p>
        <h1 className="mt-4 max-w-3xl text-5xl leading-tight text-[#102033] md:text-6xl">File Your ITR Without the Confusion.</h1>
        <p className="mt-6 max-w-2xl text-lg text-[#5c6773]">
          Upload your tax documents, answer simple questions, review your return and generate a validated ITR JSON.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/signup">
            <Button>Start my return</Button>
          </Link>
          <Link href="/how-it-works">
            <Button variant="outline">See the workflow</Button>
          </Link>
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            ["Deterministic tax engine", "Eligibility, calculations and JSON mapping never come from an LLM."],
            ["Document review", "Extracted figures stay in review until you confirm them."],
            ["Official JSON", "Download a schema-checked ITR JSON and file on the Income Tax portal yourself."],
          ].map(([t, b]) => (
            <Card key={t}>
              <h2 className="text-xl">{t}</h2>
              <p className="sans mt-2 text-sm text-[#5c6773]">{b}</p>
            </Card>
          ))}
        </div>
        <div className="mt-12">
          <Disclaimer />
        </div>
      </section>
    </div>
  );
}
