import { type RefObject, useEffect, useRef } from "react";

export function useMousePositionRef(containerRef?: RefObject<HTMLElement>) {
  const positionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    function updatePosition(x: number, y: number) {
      if (containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect();
        positionRef.current = { x: x - rect.left, y: y - rect.top };
      } else {
        positionRef.current = { x, y };
      }
    }

    function onMouseMove(ev: MouseEvent) {
      updatePosition(ev.clientX, ev.clientY);
    }

    function onTouchMove(ev: TouchEvent) {
      const touch = ev.touches[0];
      if (touch) updatePosition(touch.clientX, touch.clientY);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [containerRef]);

  return positionRef;
}
