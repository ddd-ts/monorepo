import { GearSixIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { FontSize, Settings, SettingsApi } from "@/application/use-settings";

interface BoolOption {
  key: keyof Settings;
  label: string;
}

const BOOL_OPTIONS: BoolOption[] = [
  { key: "hideDomainPrefix", label: "Hide domain prefix in names" },
];

const FONT_SIZES: { value: FontSize; preview: string }[] = [
  { value: "sm", preview: "text-xs" },
  { value: "md", preview: "text-sm" },
  { value: "lg", preview: "text-base" },
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
          {BOOL_OPTIONS.map((opt) => (
            <li key={opt.key}>
              <SettingOption
                label={opt.label}
                checked={settings.settings[opt.key] as boolean}
                onToggle={() => settings.toggle(opt.key as "hideDomainPrefix")}
              />
            </li>
          ))}
          <li>
            <FontSizeOption settings={settings} />
          </li>
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

function FontSizeOption({ settings }: { settings: SettingsApi }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
      <span>Row size</span>
      <ToggleGroup
        value={[settings.settings.fontSize]}
        onValueChange={(next) => {
          const picked = next[0] as FontSize | undefined;
          if (picked) settings.setFontSize(picked);
        }}
        variant="outline"
        size="sm"
      >
        {FONT_SIZES.map((size) => (
          <ToggleGroupItem key={size.value} value={size.value} className="size-7">
            <span className={size.preview}>A</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
