import { useEffect, useState } from "react";
import type { SpellScenario } from "@dofus/shared";
import { withoutCreatureTarget } from "../../lib/spell-scenario";

const SCENARIOS_KEY = "dofus-spell-scenarios-v1";

/** Per-spell calculation situations, kept in this browser. */
export function useSpellScenarios() {
  const [scenarios, setScenarios] = useState<Record<string, SpellScenario>>(() => {
    try { return Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem(SCENARIOS_KEY) || "{}") as Record<string, SpellScenario>).map(([key, scenario]) => [key, withoutCreatureTarget(scenario)])); } catch { return {}; }
  });
  useEffect(() => { localStorage.setItem(SCENARIOS_KEY, JSON.stringify(scenarios)); }, [scenarios]);
  return [scenarios, setScenarios] as const;
}
