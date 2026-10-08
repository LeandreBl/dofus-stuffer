import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Hover/focus preview card anchored next to its trigger; renders nothing without content. */
export function HoverCard({ label, content, interactive, children }: {
  label?: string; content?: ReactNode; interactive?: boolean; children: ReactElement<HTMLAttributes<HTMLElement>>;
}) {
  const id = useId();
  const anchor = useRef<HTMLElement | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const cancelHide = () => window.clearTimeout(hideTimer.current);
  const hide = () => { cancelHide(); setOpen(false); setPosition(null); };
  // Grace delay so the pointer can cross the gap and interact with the card's links.
  const hideSoon = () => { cancelHide(); hideTimer.current = window.setTimeout(hide, 150); };
  useEffect(() => cancelHide, []);
  const show = (element: HTMLElement) => {
    if (!content) return;
    cancelHide();
    if (!open) document.dispatchEvent(new Event("item-preview-open"));
    anchor.current = element; setOpen(true);
  };
  useLayoutEffect(() => {
    if (!open || !anchor.current || !card.current) return;
    const box = anchor.current.getBoundingClientRect(), popup = card.current.getBoundingClientRect();
    const gap = 10, margin = 12, width = document.documentElement.clientWidth, height = window.innerHeight;
    let left = box.right + gap, top = box.top;
    if (left + popup.width > width - margin) left = box.left - popup.width - gap;
    if (left < margin) {
      left = Math.max(margin, Math.min(box.left, width - popup.width - margin));
      top = box.bottom + gap;
      if (top + popup.height > height - margin) top = box.top - popup.height - gap;
    }
    setPosition({ left: Math.max(margin, Math.min(left, width - popup.width - margin)), top: Math.max(margin, Math.min(top, height - popup.height - margin)) });
  }, [open, label]); // content is a fresh element each render; label identifies it
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopImmediatePropagation(); event.preventDefault(); hide(); }
    };
    const closeOnScroll = (event: Event) => { if (!(event.target instanceof Node) || !card.current?.contains(event.target)) hide(); };
    document.addEventListener("keydown", closeOnEscape, true);
    document.addEventListener("item-preview-open", hide);
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => { document.removeEventListener("keydown", closeOnEscape, true); document.removeEventListener("item-preview-open", hide); window.removeEventListener("resize", hide); window.removeEventListener("scroll", closeOnScroll, true); };
  }, [open]);
  const trigger = cloneElement(children, {
    "aria-describedby": open ? [children.props["aria-describedby"], id].filter(Boolean).join(" ") : children.props["aria-describedby"],
    onPointerEnter: event => { children.props.onPointerEnter?.(event); if (event.pointerType !== "touch") show(event.currentTarget); },
    onPointerLeave: event => { children.props.onPointerLeave?.(event); if (interactive) hideSoon(); else hide(); },
    onFocus: event => { children.props.onFocus?.(event); if (event.target.matches(":focus-visible")) show(event.currentTarget); },
    onBlur: event => { children.props.onBlur?.(event); if (!(event.relatedTarget instanceof Node) || !(event.currentTarget.contains(event.relatedTarget) || card.current?.contains(event.relatedTarget))) hide(); },
    onClick: event => {
      if (event.target instanceof Element && event.target.closest("button,a,input,select")) hide();
      children.props.onClick?.(event);
    },
  });
  return <>{trigger}{open && content && createPortal(<div ref={card} id={id} role="tooltip" aria-label={label}
    className={`item-hover-card${interactive ? " interactive" : ""}`} style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}
    onPointerEnter={cancelHide} onPointerLeave={hideSoon}
    onBlur={event => { if (!(event.relatedTarget instanceof Node) || !(card.current?.contains(event.relatedTarget) || anchor.current?.contains(event.relatedTarget))) hide(); }}
    onClick={event => { if (event.target instanceof Element && event.target.closest("button,a")) hide(); }}>
    {content}
  </div>, document.body)}</>;
}
