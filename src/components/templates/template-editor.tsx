"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Eye, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { ColumnRow, type EditableColumn } from "@/components/templates/column-row";
import { TemplatePreview } from "@/components/templates/template-preview";
import { useCreateTemplate, useUpdateTemplate } from "@/hooks/use-templates";
import { ApiClientError } from "@/lib/api-client";
import type { CreateTemplateInput } from "@/lib/validations";
import type { ColumnConfig } from "@/lib/columns";
import type { TemplateDTO } from "@/lib/types";
import { TEMPLATE_ICONS } from "@/components/templates/template-icon";

function blankColumn(): EditableColumn {
  return {
    id: crypto.randomUUID(),
    name: "",
    type: "TEXT",
    required: false,
    defaultValue: "",
    description: "",
    example: "",
    aiHint: "",
    options: [],
    currency: "USD",
  };
}

function fromTemplate(template: TemplateDTO): EditableColumn[] {
  return template.columns.map((c) => ({
    id: crypto.randomUUID(),
    key: c.key,
    name: c.name,
    type: c.type,
    required: c.required,
    defaultValue: c.defaultValue ?? "",
    description: c.description ?? "",
    example: c.example ?? "",
    aiHint: c.aiHint ?? "",
    options: c.options ?? [],
    currency: c.config?.currency ?? "USD",
  }));
}

export function TemplateEditor({ template }: { template?: TemplateDTO }) {
  const router = useRouter();
  const create = useCreateTemplate();
  const update = useUpdateTemplate(template?.id ?? "");

  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [icon, setIcon] = useState(template?.icon ?? "ShoppingCart");
  const [columns, setColumns] = useState<EditableColumn[]>(
    template ? fromTemplate(template) : [{ ...blankColumn(), name: "Name" }],
  );
  const [showPreview, setShowPreview] = useState(false);

  // Track unsaved changes by comparing a serialized snapshot to the initial one.
  const snapshot = useMemo(
    () =>
      JSON.stringify({
        name: name.trim(),
        description: description.trim(),
        icon,
        columns: columns.map(({ id: _id, ...rest }) => rest),
      }),
    [name, description, icon, columns],
  );
  const initialSnapshot = useRef<string | null>(null);
  if (initialSnapshot.current === null) initialSnapshot.current = snapshot;
  const dirty = initialSnapshot.current !== snapshot;
  const guard = useNavigationGuard(dirty);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumns((cols) => {
        const oldIndex = cols.findIndex((c) => c.id === active.id);
        const newIndex = cols.findIndex((c) => c.id === over.id);
        return arrayMove(cols, oldIndex, newIndex);
      });
    }
  }

  const previewColumns = useMemo(
    () =>
      columns
        .filter((c) => c.name.trim())
        .map((c, index) => ({
          key: c.key ?? c.name.toLowerCase().replace(/\s+/g, "_"),
          name: c.name,
          type: c.type,
          position: index,
          required: c.required,
          example: c.example,
          options: c.options,
          config: { currency: c.currency } as ColumnConfig,
        })),
    [columns],
  );

  function buildPayload(): CreateTemplateInput | null {
    if (!name.trim()) {
      toast.error("Give your template a name");
      return null;
    }
    const named = columns.filter((c) => c.name.trim());
    if (named.length === 0) {
      toast.error("Add at least one column");
      return null;
    }
    for (const c of named) {
      if (c.type === "DROPDOWN" && c.options.filter((o) => o.trim()).length === 0) {
        toast.error(`Dropdown column "${c.name}" needs at least one option`);
        return null;
      }
    }
    return {
      name: name.trim(),
      description: description.trim() || null,
      icon,
      columns: named.map((c, index) => ({
        key: c.key,
        name: c.name.trim(),
        type: c.type,
        required: c.required,
        position: index,
        defaultValue: c.defaultValue.trim() || null,
        description: c.description.trim() || null,
        example: c.example.trim() || null,
        aiHint: c.aiHint.trim() || null,
        options:
          c.type === "DROPDOWN" ? c.options.map((o) => o.trim()).filter(Boolean) : undefined,
        config: c.type === "CURRENCY" ? { currency: c.currency || "USD" } : undefined,
      })),
    };
  }

  async function persist(): Promise<{ ok: boolean; id?: string }> {
    const payload = buildPayload();
    if (!payload) return { ok: false };
    try {
      if (template) {
        await update.mutateAsync(payload);
        toast.success("Template saved");
        return { ok: true, id: template.id };
      }
      const created = await create.mutateAsync(payload);
      toast.success("Template created");
      return { ok: true, id: created.id };
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to save template");
      return { ok: false };
    }
  }

  async function handleSave() {
    const res = await persist();
    if (res.ok && res.id) {
      initialSnapshot.current = snapshot; // mark clean before navigating
      router.push(`/templates/${res.id}`);
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <PageHeader
        title={template ? "Edit template" : "New template"}
        description="Define the columns your spreadsheets will use."
        actions={
          <>
            <Button variant="outline" onClick={() => setShowPreview(true)}>
              <Eye className="h-4 w-4" /> Preview
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save template"}
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Icon</Label>
              <div className="flex max-w-[17rem] flex-wrap gap-1.5">
                {TEMPLATE_ICONS.map(({ name, Icon }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setIcon(name)}
                    title={name}
                    className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                      icon === name
                        ? "border-primary bg-accent text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="tpl-name" className="text-xs">
                Name
              </Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Purchase Requests"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc" className="text-xs">
              Description
            </Label>
            <Textarea
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this template used for?"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Columns ({columns.length})</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setColumns((c) => [...c, blankColumn()])}
          >
            <Plus className="h-4 w-4" /> Add column
          </Button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {columns.map((column) => (
                <ColumnRow
                  key={column.id}
                  column={column}
                  onChange={(next) =>
                    setColumns((cols) => cols.map((c) => (c.id === next.id ? next : c)))
                  }
                  onRemove={() => setColumns((cols) => cols.filter((c) => c.id !== column.id))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {columns.length === 0 && (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No columns yet. Add your first column to get started.
          </p>
        )}
      </div>

      <TemplatePreview
        open={showPreview}
        onOpenChange={setShowPreview}
        name={name || "Untitled template"}
        columns={previewColumns}
      />

      {/* Unsaved-changes prompt when navigating away */}
      <Dialog open={guard.pendingHref !== null} onOpenChange={(o) => !o && guard.cancel()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save your changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes to this template. Do you want to save them before leaving?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={guard.cancel}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  initialSnapshot.current = snapshot; // discard: treat as clean
                  guard.proceed();
                }}
              >
                Discard
              </Button>
              <Button
                disabled={saving}
                onClick={async () => {
                  const res = await persist();
                  if (res.ok) {
                    initialSnapshot.current = snapshot;
                    guard.proceed();
                  }
                }}
              >
                {saving ? "Saving…" : "Save & leave"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
