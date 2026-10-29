import { useState, type ReactNode } from "react";
import { ChevronDown, Filter } from "lucide-react";

/** Collapsible panel with the same header as « Passifs & boosts ». */
export function FoldPanel({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className={`panel compare-fold ${open ? "" : "folded"}`}>
      <div className="panel-head">
        <div>
          <h2><button className="panel-fold" aria-expanded={open} onClick={() => setOpen(!open)}><Filter size={20} /> {title} <ChevronDown size={16} /></button></h2>
          <p>{summary}</p>
        </div>
      </div>
      {open && children}
    </section>
  );
}
