import Image from "next/image";
import Link from "next/link";

/**
 * Global IntelliHire brand/home control.
 *
 * RootLayout renders this once, so every App Router page gets the same
 * accessible home button without duplicating navigation markup in pages.
 */
export function HomeLogoButton() {
  return (
    <Link
      className="ih-home-logo"
      href="/"
      aria-label="IntelliHire home"
      title="Go to IntelliHire home"
    >
      <Image
        src="/intellihire-logo.svg"
        alt="IntelliHire v8 — Smarter Hiring, Better Teams, Brighter Futures"
        width={1200}
        height={420}
        sizes="(max-width: 640px) 150px, 210px"
        priority
        draggable={false}
      />
    </Link>
  );
}
