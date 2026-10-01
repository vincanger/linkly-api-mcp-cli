import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import { ALL_TOOLSETS, SCOPES, TOOLSETS, toggleScope, type Scope } from "../../shared/scopes";

/**
 * One checkbox per scope, grouped by toolset, so read and write are separate
 * choices. Shows only the `offered` scopes (what the app asked for).
 * Used by the consent screen and the connections page.
 */
export function ScopeChecklist({
  idPrefix,
  offered,
  selected,
  onChange,
}: {
  idPrefix: string;
  offered: readonly Scope[];
  selected: readonly Scope[];
  onChange: (next: Scope[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {ALL_TOOLSETS.map((t) => {
        const scopes = TOOLSETS[t].scopes.filter((s) => offered.includes(s));
        if (scopes.length === 0) return null;
        return (
          <div key={t} role="group" aria-label={TOOLSETS[t].label} className="flex flex-col gap-1.5">
            <div className="text-sm font-medium">{TOOLSETS[t].label}</div>
            {scopes.map((s) => (
              <div key={s} className="flex items-center gap-2">
                <Checkbox
                  id={`${idPrefix}-${s}`}
                  checked={selected.includes(s)}
                  onCheckedChange={(checked) => onChange(toggleScope(selected, s, checked === true))}
                />
                <Label htmlFor={`${idPrefix}-${s}`} className="font-normal">
                  {SCOPES[s]}
                </Label>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
