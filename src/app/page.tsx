import type { Metadata } from "next";
import { GoogleSignInCard } from "@/components/GoogleSignInCard";
import { ModuleConsole } from "@/components/ModuleConsole";
import "./entry.css";

export const metadata: Metadata = {
  title: "Sign in — IntelliHire",
};

export default async function EntryPage({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string; returnTo?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="ih-entry">
      <section className="ih-entry__brand" aria-label="About IntelliHire">
        <div className="ih-entry__brand-inner">
          <p className="ih-wordmark">
            Intelli<span className="ih-wordmark__accent">Hire</span>
          </p>
          <p className="ih-eyebrow">AI-Based Placement Trainer</p>
          <h1 className="ih-headline">
            Train smart.
            <br />
            Perform better.
            <br />
            <span className="ih-headline__accent">Get placed.</span>
          </h1>
          <p className="ih-lede">
            IntelliHire runs you through the same gauntlet real hiring pipelines use — resume
            screening, adaptive tests, technical and HR interviews — and tells you exactly where
            you stand before the real thing does.
          </p>
          <ModuleConsole />
        </div>
      </section>

      <section className="ih-entry__auth" aria-label="Sign in to IntelliHire">
        <GoogleSignInCard
          initialErrorCode={params.auth_error ?? null}
          returnTo={params.returnTo ?? null}
        />
      </section>
    </main>
  );
}
