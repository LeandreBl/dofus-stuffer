import { Minus, Plus } from "lucide-react";

export function Stepper({ label, value, min = 1, max, step = 1, shortcuts = [], onChange }: {
  label: string; value: number; min?: number; max: number; step?: number; shortcuts?: number[]; onChange: (value: number) => void;
}) {
  return <div className="combat-stepper-row"><span>{label}</span><div className="combat-stepper">
    <button className="icon-button" aria-label={`Réduire ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}><Minus size={13} /></button>
    <output aria-label={label}>{value}</output>
    <button className="icon-button" aria-label={`Augmenter ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}><Plus size={13} /></button>
  </div>{shortcuts.map(number => <button key={number} className={`combat-shortcut ${value === number ? "active" : ""}`}
    aria-label={`${label} : ${number}`} onClick={() => onChange(number)}>{number}</button>)}</div>;
}
