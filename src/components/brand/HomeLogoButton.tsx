import Image from "next/image";
import Link from "next/link";

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
        alt="IntelliHire v8"
        width={260}
        height={91}
        priority
      />
    </Link>
  );
}
