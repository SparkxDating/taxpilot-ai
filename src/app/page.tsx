import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button, Card, Disclaimer } from "@/components/ui";

export default function Landing() {
  return (
    <div className="min-w-0">
      <SiteHeader />
      <section className="mx-auto w-full min-w-0 max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-20">
        <p className="sans text-[0.65rem] uppercase tracking-[0.14em] text-[#c4a574] sm:text-xs sm:tracking-[0.25em]">
          AY 2026–27 · ITR-4 & ITR-3
        </p>
        <h1 className="mt-4 max-w-3xl break-words text-[1.85rem] leading-[1.15] text-[#102033] sm:text-5xl sm:leading-tight md:text-6xl">
          File Your ITR Without the Confusion.
        </h1>
        <p className="mt-4 max-w-2xl break-words text-base text-[#5c6773] sm:mt-6 sm:text-lg">
          Upload your tax documents, answer simple questions, review your return and generate a validated ITR JSON.
        </p>
        <div className="mt-6 flex w-full min-w-0 flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
          <Link href="/signup" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">Start my return</Button>
          </Link>
          <Link href="/how-it-works" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">
              See the workflow
            </Button>
          </Link>
        </div>
        <div className="mt-10 grid min-w-0 grid-cols-1 gap-4 sm:mt-16 md:grid-cols-3">
          {[
            ["Deterministic tax engine", "Eligibility, calculations and JSON mapping never come from an LLM."],
            ["Document review", "Extracted figures stay in review until you confirm them."],
            ["Official JSON", "Download a schema-checked ITR JSON and file on the Income Tax portal yourself."],
          ].map(([t, b]) => (
            <Card key={t} className="min-w-0">
              <h2 className="break-words text-xl">{t}</h2>
              <p className="sans mt-2 break-words text-sm text-[#5c6773]">{b}</p>
            </Card>
          ))}
        </div>
        <div className="mt-12 min-w-0">
          <Disclaimer />
        </div>
      </section>
    </div>
  );
}
