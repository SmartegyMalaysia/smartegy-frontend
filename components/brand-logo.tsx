import Image from "next/image";
import Link from "next/link";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <Link className={className} href="/" aria-label="Smartegy home">
      <span className="logo-crop">
        <Image src="/icons/smartegy-logo.png" alt="Smartegy" width={220} height={220} priority />
      </span>
    </Link>
  );
}
