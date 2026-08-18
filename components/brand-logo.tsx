import Image from "next/image";
import Link from "next/link";

const logos = {
  "horizontal-tagline": {
    src: "/icons/smartegy-logo-horizontal-tagline-transparent.png",
    width: 2443,
    height: 820,
  },
  horizontal: {
    src: "/icons/smartegy-logo-horizontal-transparent.png",
    width: 2162,
    height: 680,
  },
  icon: {
    src: "/icons/smartegy-logo-icon-only-transparent.png",
    width: 719,
    height: 840,
  },
  stacked: {
    src: "/icons/smartegy-logo-stacked-transparent.png",
    width: 1600,
    height: 1178,
  },
} as const;

type LogoVariant = keyof typeof logos;

function LogoImage({ variant, compact = false }: { variant: LogoVariant; compact?: boolean }) {
  const logo = logos[variant];
  return (
    <span className={`logo-crop logo-crop-${variant}${compact ? " logo-compact" : " logo-full"}`}>
      <Image src={logo.src} alt={compact ? "" : "Smartegy"} width={logo.width} height={logo.height} priority={!compact} />
    </span>
  );
}

export function BrandLogo({ className = "", href = "/", variant = "stacked", compactVariant }: { className?: string; href?: string; variant?: LogoVariant; compactVariant?: LogoVariant }) {
  return (
    <Link className={className} href={href} aria-label="Smartegy home">
      <LogoImage variant={variant} />
      {compactVariant && <LogoImage variant={compactVariant} compact />}
    </Link>
  );
}
