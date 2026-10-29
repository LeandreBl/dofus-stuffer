import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PictureInPicture2 } from "lucide-react";

// Document Picture-in-Picture (Chromium only): an always-on-top window that can sit over the game.
type PipApi = { requestWindow: (options: { width: number; height: number }) => Promise<Window> };
const pip = () => (window as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture;

/** Button that opens a small always-on-top window showing `children`, to place over the game window. */
export function ForgeOverlay({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Window>();
  useEffect(() => () => target?.close(), [target]);
  if (!pip()) return null;

  async function open() {
    if (target) return target.close();
    const next = await pip()!.requestWindow({ width: 280, height: 76 });
    // The page's styles, so the overlay keeps the site's theme.
    for (const node of document.querySelectorAll('link[rel="stylesheet"], style')) next.document.head.append(node.cloneNode(true));
    next.document.body.className = "forge-overlay-body";
    next.addEventListener("pagehide", () => setTarget(undefined));
    setTarget(next);
  }
  return (
    <>
      <button className="button small ghost" onClick={() => void open()} title="Fenêtre toujours au premier plan, à poser sur le jeu">
        <PictureInPicture2 size={14} /> {target ? "Fermer l’overlay" : "Overlay"}
      </button>
      {target && createPortal(children, target.document.body)}
    </>
  );
}
