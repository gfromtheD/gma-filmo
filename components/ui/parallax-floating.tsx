"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import { useAnimationFrame } from "motion/react";

import { cn } from "@/lib/utils";
import { useMousePositionRef } from "@/hooks/use-mouse-position-ref";

// ─── Context ──────────────────────────────────────────────────────────────────

interface FloatingContextType {
  registerElement: (id: string, el: HTMLDivElement, depth: number) => void;
  unregisterElement: (id: string) => void;
}

const FloatingContext = createContext<FloatingContextType | null>(null);

// ─── Floating (container) ─────────────────────────────────────────────────────

interface FloatingProps {
  children: ReactNode;
  className?: string;
  sensitivity?: number;
  easingFactor?: number;
}

export function Floating({
  children,
  className,
  sensitivity = 1,
  easingFactor = 0.05,
}: FloatingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementsMap = useRef(
    new Map<
      string,
      { element: HTMLDivElement; depth: number; currentPosition: { x: number; y: number } }
    >()
  );
  const mousePositionRef = useMousePositionRef(containerRef);

  const registerElement = useCallback(
    (id: string, element: HTMLDivElement, depth: number) => {
      elementsMap.current.set(id, { element, depth, currentPosition: { x: 0, y: 0 } });
    },
    []
  );

  const unregisterElement = useCallback((id: string) => {
    elementsMap.current.delete(id);
  }, []);

  useAnimationFrame(() => {
    if (!containerRef.current) return;
    elementsMap.current.forEach((data) => {
      const strength = (data.depth * sensitivity) / 20;
      const targetX = mousePositionRef.current.x * strength;
      const targetY = mousePositionRef.current.y * strength;

      data.currentPosition.x += (targetX - data.currentPosition.x) * easingFactor;
      data.currentPosition.y += (targetY - data.currentPosition.y) * easingFactor;

      data.element.style.transform = `translate3d(${data.currentPosition.x}px, ${data.currentPosition.y}px, 0)`;
    });
  });

  return (
    <FloatingContext.Provider value={{ registerElement, unregisterElement }}>
      <div ref={containerRef} className={cn("absolute inset-0", className)}>
        {children}
      </div>
    </FloatingContext.Provider>
  );
}

// ─── FloatingElement ──────────────────────────────────────────────────────────

interface FloatingElementProps {
  children: ReactNode;
  className?: string;
  depth?: number;
}

export function FloatingElement({ children, className, depth = 1 }: FloatingElementProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(Math.random().toString(36).slice(2, 9));
  const context = useContext(FloatingContext);

  useEffect(() => {
    if (!elementRef.current || !context) return;
    const id = idRef.current;
    context.registerElement(id, elementRef.current, depth ?? 0.01);
    return () => context.unregisterElement(id);
  }, [depth, context]);

  return (
    <div ref={elementRef} className={cn("absolute will-change-transform", className)}>
      {children}
    </div>
  );
}
