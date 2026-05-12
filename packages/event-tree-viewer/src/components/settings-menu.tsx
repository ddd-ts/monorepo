import { GearSixIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Settings, SettingsApi } from "@/application/use-settings";

interface Option {
  key: keyof Settings;
  label: string;
}

const OPTIONS: Option[] = [
  { key: "hideDomainPrefix", label: "Hide domain prefix in names" },
];

export function SettingsMenu({ settings }: { settings: SettingsApi }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Settings">
            <GearSixIcon />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-64 p-1">
        <ul className="flex flex-col">
          {OPTIONS.map((opt) => (
            <li key={opt.key}>
              <SettingOption
                label={opt.label}
                checked={settings.settings[opt.key]}
                onToggle={() => settings.toggle(opt.key)}
              />
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function SettingOption({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="hover:bg-muted hover:text-foreground flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm transition-colors">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <span>{label}</span>
    </label>
  );
}
