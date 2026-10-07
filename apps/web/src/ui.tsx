import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { Coins, Sparkles, X } from "lucide-react";
import type { Spell, StatDefinition } from "@dofus/shared";

export const fmt = (value: number | undefined | null) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
        value,
      );
export const money = (value: number | undefined | null) =>
  value == null
    ? "Prix à renseigner"
    : value >= 1_000_000
      ? `${fmt(value / 1_000_000)} M kamas`
      : `${fmt(value)} kamas`;
// The game's legacy key is damagePercent, but Puissance is displayed in points.
export const statUnit = (stat?: StatDefinition) =>
  stat?.key === "damagePercent" ? "" : stat?.unit || "";
// randomUUID requires HTTPS outside localhost; criterion IDs also work on a LAN.
export const uid = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
export const plainText = (value: string) =>
  value
    .replace(/<[^>]*>/g, "")
    .replace(/\{[^}]*\}/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

export function GameImage({
  src,
  alt = "",
  className,
}: {
  src?: string;
  alt?: string;
  className?: string;
}) {
  return src ? (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.style.visibility = "hidden";
      }}
    />
  ) : (
    <span className={className || "spell-placeholder"} aria-hidden="true">
      <Sparkles size={19} />
    </span>
  );
}

export function StatIcon({
  stat,
  price = false,
  spell,
}: {
  stat?: StatDefinition;
  price?: boolean;
  spell?: Spell;
}) {
  if (price)
    return (
      <span className="stat-icon">
        <Coins size={19} color="#e3c582" />
      </span>
    );
  if (spell)
    return (
      <span className="stat-icon">
        <GameImage src={spell.icon} />
      </span>
    );
  if (stat?.icon)
    return (
      <span className="stat-icon">
        <GameImage src={stat.icon} />
      </span>
    );
  if (stat?.iconSpriteY !== undefined)
    return (
      <span
        className="stat-icon sprite"
        aria-hidden="true"
        style={
          {
            backgroundImage: "url('/game/stat-icons.png')",
            backgroundPosition: `-97px -${stat.iconSpriteY}px`,
          } as CSSProperties
        }
      />
    );
  return (
    <span className="stat-icon">
      <Sparkles size={16} />
    </span>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  icon,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  icon?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("button,input,select")?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const elements = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,a[href],[tabindex="0"]',
        ) || [],
      );
      const first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          {icon}
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

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
