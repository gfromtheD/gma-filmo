import Link from "next/link";

export function NavbarBrand() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-1.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white lg:mr-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logo-gma.png" alt="GMA" className="h-7 w-auto" />
      <span className="text-[18px] text-white">·</span>
      <span className="text-[14px] font-medium uppercase tracking-[0.04em] text-[#22B16B]">filmo</span>
    </Link>
  );
}
