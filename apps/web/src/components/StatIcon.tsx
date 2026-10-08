import type { CSSProperties } from "react";
import { Coins, Shield, Sparkles } from "lucide-react";
import type { Spell, StatDefinition } from "@dofus/shared";
import { GameImage } from "./GameImage";

// The game ships no icon for these resistances: reuse the matching damage icon with a shield badge.
const resistanceIcons: Record<string, string> = {
  receivedDamageMultiplierDistance: "/game/stats/tx_distanceDamage.png",
  receivedDamageMultiplierMelee: "/game/stats/tx_meleeDamage.png",
  receivedDamageMultiplierSpells: "/game/stats/tx_spellDamage.png",
  receivedDamageMultiplierWeapon: "/game/stats/tx_weaponDamage.png",
};

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
  if (stat && !stat.icon && resistanceIcons[stat.key])
    return (
      <span className="stat-icon resistance">
        <GameImage src={resistanceIcons[stat.key]} />
        <Shield aria-hidden="true" />
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
