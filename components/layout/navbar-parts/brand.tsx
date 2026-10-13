import Link from "next/link";

export function NavbarBrand() {
  return (
    <div className="flex items-center gap-3">
      <Link href="/" className="flex shrink-0 items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo-gma.png" alt="GMA" className="h-8 w-auto" />
        <span className="text-[18px] text-white">·</span>
        <span className="text-[14px] font-medium uppercase tracking-[0.04em] text-[#22B16B]">
          filmo
        </span>
      </Link>
      <span className="hidden h-[18px] w-px bg-[#2A2A2A] xl:block" />
      <span
        className="hidden whitespace-nowrap text-[13px] text-[#6D7D94] xl:block"
        style={{ fontFamily: '"Georgia", "Times New Roman", serif', fontStyle: "italic" }}
      >
        el cine es nuestro
      </span>
    </div>
  );
}
