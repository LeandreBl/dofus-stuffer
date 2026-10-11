import { LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";

/** Loads the next page when the bottom of the list scrolls into view, plus the pagination summary. */
export function MoreButton({ shown, total, label, summary, onMore }: {
  shown: number;
  total: number;
  label: string;
  summary: string;
  onMore: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const more = useRef(onMore);
  more.current = onMore;
  const hasMore = total > shown;

  // Re-observing on each page fires again if the sentinel is still in view (short pages).
  useEffect(() => {
    if (!hasMore || !sentinel.current) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && more.current(), { rootMargin: "100px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, shown]);

  return (
    <>
      {hasMore && (
        <div ref={sentinel} className="more-button" role="status" aria-label={label}>
          <LoaderCircle className="spin" size={18} />
        </div>
      )}
      <p className="pagination-summary">
        {Math.min(shown, total)} sur {total} {summary}
      </p>
    </>
  );
}
