import type { SpellScenario } from "@dofus/shared";

/** Previews and objectives use a generic target without a creature selection. */
export function withoutCreatureTarget(scenario: SpellScenario = {}): SpellScenario {
  const { targetMonsterId: _target, targetKind: _kind, targetClassId: _class, ...rest } = scenario;
  return rest;
}
