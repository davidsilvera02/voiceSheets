"use client";

import { useTheme } from "next-themes";
import { Check, Cpu, Mic, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMe, useSettings, useUpdateSettings } from "@/hooks/use-settings";

const CURRENCIES = ["USD", "EUR", "GBP", "MXN", "CAD", "AUD", "JPY", "BRL"];
const DATE_FORMATS = ["yyyy-MM-dd", "MM/dd/yyyy", "dd/MM/yyyy", "dd MMM yyyy"];

export default function SettingsPage() {
  const me = useMe();
  const settings = useSettings();
  const update = useUpdateSettings();
  const { setTheme } = useTheme();

  function save(patch: Record<string, unknown>) {
    update.mutate(patch, {
      onSuccess: () => toast.success("Settings saved"),
      onError: () => toast.error("Failed to save settings"),
    });
  }

  if (settings.isLoading || !settings.data) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const s = settings.data;
  const ai = s.aiPreferences as { autoSuggest?: boolean; cleanupOnImport?: boolean };
  const exp = s.exportDefaults as { format?: string; includeHidden?: boolean };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <PageHeader title="Settings" description="Personalize VoiceSheets to fit your workflow." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance & formats</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Theme">
            <Select
              value={s.theme}
              onValueChange={(v) => {
                setTheme(v);
                save({ theme: v });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Default currency">
            <Select value={s.currency} onValueChange={(v) => save({ currency: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date format">
            <Select value={s.dateFormat} onValueChange={(v) => save({ dateFormat: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Default export format">
            <Select
              value={exp.format ?? "xlsx"}
              onValueChange={(v) => save({ exportDefaults: { ...exp, format: v } })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV (.csv)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            label="Autocomplete suggestions"
            description="Suggest previously entered vendors and products while typing."
            checked={ai.autoSuggest ?? true}
            onChange={(v) => save({ aiPreferences: { ...ai, autoSuggest: v } })}
          />
          <ToggleRow
            label="Clean up on import"
            description="Standardize vendor names and formatting when importing rows."
            checked={ai.cleanupOnImport ?? false}
            onChange={(v) => save({ aiPreferences: { ...ai, cleanupOnImport: v } })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CapabilityRow
            icon={ShieldCheck}
            label="Clerk authentication"
            enabled={me.data?.capabilities.clerk}
            offNote="Running in single-user dev mode"
          />
          <CapabilityRow
            icon={Cpu}
            label="Anthropic Claude (AI extraction)"
            enabled={me.data?.capabilities.anthropic}
            offNote="Using built-in heuristic parser fallback"
          />
          <CapabilityRow
            icon={Mic}
            label="Whisper transcription"
            enabled={me.data?.capabilities.whisper}
            offNote="Using browser speech recognition fallback"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function CapabilityRow({
  icon: Icon,
  label,
  enabled,
  offNote,
}: {
  icon: typeof Cpu;
  label: string;
  enabled: boolean | undefined;
  offNote: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        {!enabled && <p className="text-xs text-muted-foreground">{offNote}</p>}
      </div>
      {enabled ? (
        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" /> Active
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <X className="h-3.5 w-3.5" /> Fallback
        </span>
      )}
    </div>
  );
}
