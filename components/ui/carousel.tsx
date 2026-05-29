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
    scrollRef.current?.scrollBy({ left: dir * 600, behavior: "smooth" });
  }

  return (
    <section className="mb-10">
      {/* Section header */}
      <div className="mb-4 flex items-baseline justify-between">
        <h3
          className="text-[24px] font-bold tracking-[-0.01em] text-white"
        >
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {action}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#B8C5D4] transition-colors hover:bg-[#1A1A1A] hover:text-white"
            onClick={() => scrollBy(-1)}
            aria-label="Anterior"
            type="button"
          >
            <GmaIcon name="chevronLeft" size={16} />
          </button>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#B8C5D4] transition-colors hover:bg-[#1A1A1A] hover:text-white"
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
        className="flex gap-[14px] overflow-x-auto pb-2"
        style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none" }}
      >
        {children}
      </div>
    </section>
  );
}
