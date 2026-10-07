import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, RefreshCw, UserRound } from "lucide-react";
import type { Build, GameClass } from "@dofus/shared";
import { APPEARANCE_SLOTS, characterLook, type CharacterGender, type CharacterManifest } from "./character-look";
import { GameImage } from "./ui";

let assets: Promise<CharacterManifest> | undefined;
function loadAssets() {
  return assets ??= fetch("/characters/manifest.json", { cache: "no-cache" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Les modèles du personnage ne sont pas disponibles.");
      const manifest: CharacterManifest = await response.json();
      const { configure } = await import("@dofus/renderer");
      configure({ strategy: "url", basePath: manifest.assetBase, ImageExtension: "webp" });
      return manifest;
    }).catch((error) => { assets = undefined; throw error; });
}

export function CharacterPreview({ gameClass, slots }: { gameClass?: GameClass; slots: Build["slots"] }) {
  const holder = useRef<HTMLDivElement>(null);
  const [gender, setGender] = useState<CharacterGender>(() => localStorage.getItem("dofus-character-gender") === "male" ? "male" : "female");
  const [direction, setDirection] = useState(1);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [equipped, setEquipped] = useState(false);
  const appearanceKey = APPEARANCE_SLOTS.map((slot) => `${slot}:${slots[slot] || 0}`).join(",");

  useEffect(() => {
    let cancelled = false;
    let usesContext = false;
    const canvas = document.createElement("canvas");
    const dispose = () => {
      // Release textures, buffers and the context when equipment changes or the view closes.
      if (usesContext) {
        const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
        context?.getExtension("WEBGL_lose_context")?.loseContext();
      }
      canvas.remove();
    };
    setStatus("loading");
    setMessage("");
    const selected = Object.fromEntries(appearanceKey.split(",").map((entry) => {
      const [slot, id] = entry.split(":");
      return [slot, Number(id) || undefined];
    })) as Build["slots"];
    void (async () => {
      try {
        const manifest = await loadAssets();
        if (cancelled) return;
        const resolved = characterLook(manifest, gameClass?.id || 9, gender, selected);
        const { DofusSprite, Look } = await import("@dofus/renderer");
        if (cancelled) return;
        const creation = DofusSprite.create(Look.fromDict(resolved.look), canvas);
        usesContext = true;
        const sprite = await creation;
        if (cancelled) { dispose(); return; }
        const [animation, flip] = sprite.getAnimName(direction);
        await sprite.prepareAnimation(animation, 1, true, flip, false, 600);
        if (cancelled) { dispose(); return; }
        sprite.renderFrame(0);
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `${gameClass?.name || "Personnage"} ${gender === "female" ? "féminin" : "masculin"} avec les équipements du stuff`);
        canvas.dataset.appearance = appearanceKey;
        holder.current?.replaceChildren(canvas);
        setEquipped(true);
        setStatus("ready");
        const labels = { hat: "coiffe", cape: "cape", shield: "bouclier", weapon: "arme", pet: "familier ou monture" };
        setMessage(resolved.missing.length ? `Apparence indisponible : ${resolved.missing.map((slot) => labels[slot as keyof typeof labels]).join(", ")}.` : "");
      } catch (error) {
        dispose();
        if (!cancelled) {
          setEquipped(false);
          setStatus("error");
          setMessage("L’aperçu de la tenue n’a pas pu être chargé.");
        }
      }
    })();
    return () => { cancelled = true; dispose(); };
  }, [appearanceKey, gameClass?.id, gameClass?.name, gender, direction, retry]);

  function changeGender(next: CharacterGender) {
    setGender(next);
    localStorage.setItem("dofus-character-gender", next);
  }

  return <div className="character-preview">
    <div className="character-gender" aria-label="Apparence du personnage">
      <button type="button" onClick={() => changeGender("female")} aria-pressed={gender === "female"}>Femme</button>
      <button type="button" onClick={() => changeGender("male")} aria-pressed={gender === "male"}>Homme</button>
    </div>
    <div className={`character-model ${status}`}>
      <div className="character-canvas" ref={holder} />
      {!equipped && (gameClass?.illustration || gameClass?.icon ? <GameImage src={gameClass.illustration || gameClass.icon} alt={gameClass.name} className="character-fallback" /> : <UserRound className="character-fallback" size={120} strokeWidth={1} />)}
      {status === "loading" && <span className="character-loading" role="status"><LoaderCircle size={14} />Habillage…</span>}
    </div>
    <div className="character-rotation">
      <button type="button" aria-label="Tourner le personnage vers la gauche" onClick={() => setDirection((value) => (value + 7) % 8)}><ChevronLeft size={15} /></button>
      <span>Tenue équipée</span>
      <button type="button" aria-label="Tourner le personnage vers la droite" onClick={() => setDirection((value) => (value + 1) % 8)}><ChevronRight size={15} /></button>
    </div>
    {message && <div className="character-message" role="status">{message}{status === "error" && <button type="button" onClick={() => setRetry((value) => value + 1)}><RefreshCw size={12} />Réessayer</button>}</div>}
  </div>;
}
