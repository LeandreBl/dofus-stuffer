import { Clock3 } from "lucide-react";
import { fmt } from "../../lib/format";
import { rangeLabel, type PreviewSpellDamage } from "./damage";

export function RecastTable({ damage, currentTurn }: { damage: PreviewSpellDamage; currentTurn: number }) {
  return (
    <div className="recast">
      <h3>
        <Clock3 size={15} /> Dégâts par tour de relance
      </h3>
      <table className="recast-table">
        <thead>
          <tr>
            <th>Lancer</th>
            <th>Normal</th>
            <th>Critique</th>
            <th>Chance CC</th>
          </tr>
        </thead>
        <tbody>
          {damage.turns.filter((turn) => turn.available).map((turn, index) => (
            <tr key={`${turn.turn}-${index}`}>
              <td>
                {turn.turn === 0 ? "Premier lancer" : `Relance à T+${turn.turn}`}
                <small> · tour {currentTurn + turn.turn}</small>
              </td>
              <td>{rangeLabel(turn.normal)}</td>
              <td>{rangeLabel(turn.critical)}</td>
              <td>{fmt(turn.critChance)} %</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="inline-notice">
        Le sort est relancé à chaque tour disponible : les bonus de
        dégâts des lancers précédents se cumulent. Les bonus activés expirent
        selon leur durée et le Nébuleux suit les tours pairs et impairs.
      </p>
    </div>
  );
}
