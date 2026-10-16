import Link from "next/link";

export function NavbarBrand() {
  return (
    <Link href="/" className="flex shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logo-gma.png" alt="GMA" className="h-7 w-auto" />
    </Link>
  );
}
