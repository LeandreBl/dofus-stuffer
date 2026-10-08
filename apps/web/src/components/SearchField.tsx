import { X } from "lucide-react";

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="picker-search">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden="true"
      >
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </svg>
      <input
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button
          type="button"
          className="icon-button"
          aria-label="Effacer la recherche"
          onClick={() => onChange("")}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
