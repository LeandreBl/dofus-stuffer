import { Check, X } from "lucide-react";

export function Toast({ message, className = "", onClose }: { message: string; className?: string; onClose?: () => void }) {
  return (
    <div className={`toast ${className}`} role="status">
      <Check size={15} />
      {message}
      {onClose && (
        <button className="toast-close" aria-label="Fermer" onClick={onClose}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}
