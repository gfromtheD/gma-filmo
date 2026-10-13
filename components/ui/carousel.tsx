"use client";

import { useRef } from "react";
import { GmaIcon } from "@/components/ui/gma-icon";

interface CarouselProps {
  readonly title: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
}

export function Carousel({ title, action, children }: CarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollBy(dir: -1 | 1) {
    const row = scrollRef.current;
    if (row) row.scrollBy({
      left: dir * row.clientWidth * 0.9,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  return (
    <section className="mb-8 min-w-0 sm:mb-10">
      {/* Section header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:mb-4">
        <h3
          className="min-w-0 flex-1 basis-40 break-words text-xl sm:text-[24px] font-bold tracking-[-0.01em] text-white"
        >
          {title}
        </h3>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1 sm:gap-2">
          {action}
          <button
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#B8C5D4] transition-colors hover:bg-[#1A1A1A] hover:text-white"
            onClick={() => scrollBy(-1)}
            aria-label="Anterior"
            type="button"
          >
            <GmaIcon name="chevronLeft" size={16} />
          </button>
          <button
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#B8C5D4] transition-colors hover:bg-[#1A1A1A] hover:text-white"
            onClick={() => scrollBy(1)}
            aria-label="Siguiente"
            type="button"
          >
            <GmaIcon name="chevronRight" size={16} />
          </button>
        </div>
      </div>

      {/* Scroll row */}
      <div
        ref={scrollRef}
        role="region"
        aria-label={title}
        tabIndex={0}
        className="flex min-w-0 gap-3 overflow-x-auto overscroll-x-contain pb-2 pt-1 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-[#22B16B] sm:gap-[14px]"
        style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none" }}
      >
        {children}
      </div>
    </section>
  );
}
