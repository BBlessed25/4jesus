import { useState, useEffect, useRef } from "react";

/**
 * Tracks when an element enters or leaves the viewport.
 * @param {Object} options - IntersectionObserver options
 * @param {number} [options.threshold=0] - Ratio of visibility (0–1)
 * @param {string} [options.rootMargin='0px'] - Root margin
 * @returns {[React.RefObject, boolean]}
 */
export function useIntersectionObserver(options = {}) {
  const { threshold = 0, rootMargin = "0px" } = options;
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry.isIntersecting),
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return [ref, isIntersecting];
}
