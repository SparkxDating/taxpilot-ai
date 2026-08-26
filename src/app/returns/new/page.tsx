"use client";

import { useState } from "react";
import { createReturnAction } from "@/app/actions";
import { Button, Card } from "@/components/ui";

const SOURCES = ["Salary", "Business", "Profession", "Freelancing", "FNO", "Capital gains", "House property", "Interest", "Dividend", "Other income"];

export default function NewReturn() {
  const [step, setStep] = useState(0);
  const [sources, setSources] = useState<string[]>([]);
  const toggle = (s: string) => setSources((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="sans text-xs uppercase tracking-widest text-[#c4a574]">New return · step {step + 1} of 4</p>
      <form action={createReturnAction}>
        <div className={step === 0 ? "block" : "hidden"}>
          <h1 className="mt-2 text-3xl">Assessment year</h1>
          <Card className="mt-6">
            <label className="flex items-center gap-3">
              <input type="radio" name="assessmentYear" value="2026-27" defaultChecked />
              AY 2026–27 (FY 2025–26)
            </label>
          </Card>
        </div>
        <div className={step === 1 ? "block" : "hidden"}>
          <h1 className="mt-2 text-3xl">Taxpayer type</h1>
          <Card className="mt-6 space-y-2">
            {["INDIVIDUAL", "HUF", "FIRM"].map((t) => (
              <label key={t} className="flex gap-2">
                <input type="radio" name="taxpayerType" value={t} defaultChecked={t === "INDIVIDUAL"} /> {t}
              </label>
            ))}
          </Card>
        </div>
        <div className={step === 2 ? "block" : "hidden"}>
          <h1 className="mt-2 text-3xl">Income sources</h1>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {SOURCES.map((s) => (
              <label key={s} className={`cursor-pointer rounded-xl border p-4 ${sources.includes(s) ? "border-[#1f4e46] bg-[#eef5f3]" : "border-[#e4ddd0] bg-white"}`}>
                <input className="mr-2" type="checkbox" name="sources" value={s.toUpperCase().replace(" ", "_")} checked={sources.includes(s)} onChange={() => toggle(s)} />
                {s}
              </label>
            ))}
          </div>
        </div>
        <div className={step === 3 ? "block" : "hidden"}>
          <h1 className="mt-2 text-3xl">Confirm</h1>
          <p className="mt-3 text-[#5c6773]">Eligibility is decided by published ITR-4 rules, not by the assistant. ITR-3 is used when ITR-4 does not apply.</p>
          <Button className="mt-6" type="submit">
            Create return
          </Button>
        </div>
      </form>
      <div className="mt-6 flex gap-2">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        ) : null}
        {step < 3 ? (
          <Button type="button" onClick={() => setStep((s) => s + 1)}>
            Continue
          </Button>
        ) : null}
      </div>
    </div>
  );
}
