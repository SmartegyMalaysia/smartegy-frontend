import Image from "next/image";
import Link from "next/link";

export function BrandLogo({ className = "", href = "/" }: { className?: string; href?: string }) {
  return (
    <Link className={className} href={href} aria-label="Smartegy home">
      <span className="logo-crop">
        <Image src="/icons/smartegy-logo.png" alt="Smartegy" width={756} height={595} priority />
      </span>
    </Link>
  );
}
