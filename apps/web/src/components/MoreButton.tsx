import { ChevronDown } from "lucide-react";

/** "Show more" button and the pagination summary under a list. */
export function MoreButton({ shown, total, label, summary, onMore }: {
  shown: number;
  total: number;
  label: string;
  summary: string;
  onMore: () => void;
}) {
  return (
    <>
      {total > shown && (
        <button className="button ghost more-button" onClick={onMore}>
          {label} <ChevronDown size={14} />
        </button>
      )}
      <p className="pagination-summary">
        {Math.min(shown, total)} sur {total} {summary}
      </p>
    </>
  );
}
