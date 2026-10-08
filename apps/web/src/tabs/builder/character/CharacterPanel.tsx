import { ShieldCheck } from "lucide-react";
import type { Build, Catalog, OptimizationRequest } from "@dofus/shared";
import { CharacterEditor } from "./CharacterEditor";
import { ClassPicker } from "./ClassPicker";
import { ProfileFields } from "./ProfileFields";

export function CharacterPanel({ catalog, request, build, onChange, onServer }: {
  catalog: Catalog;
  request: OptimizationRequest;
  build: Build;
  onChange: (update: (previous: OptimizationRequest) => OptimizationRequest) => void;
  onServer: (server: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Mon personnage</h2>
        <span className="mode-badge">
          <ShieldCheck size={11} /> PvM
        </span>
      </div>
      <div className="profile-layout">
        <ClassPicker
          catalog={catalog}
          classId={request.character.classId}
          onChange={(classId) => onChange((previous) => ({ ...previous, character: { ...previous.character, classId } }))}
        />
        <ProfileFields
          catalog={catalog}
          level={request.character.level}
          server={request.prices.server}
          onLevel={(level) => onChange((previous) => ({ ...previous, character: { ...previous.character, level } }))}
          onServer={onServer}
        />
      </div>
      <CharacterEditor
        catalog={catalog}
        character={request.character}
        proposedStats={build.baseStats}
        onChange={(character) => onChange((previous) => ({ ...previous, character }))}
      />
    </section>
  );
}
