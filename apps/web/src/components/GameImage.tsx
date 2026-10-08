import type { HTMLAttributes } from "react";
import { Sparkles } from "lucide-react";

export function GameImage({
  src,
  alt = "",
  className,
  ...props
}: {
  src?: string;
  alt?: string;
  className?: string;
} & HTMLAttributes<HTMLElement>) {
  return src ? (
    <img
      {...props}
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.style.visibility = "hidden";
      }}
    />
  ) : (
    <span {...props} className={className || "spell-placeholder"} aria-hidden="true">
      <Sparkles size={19} />
    </span>
  );
}
