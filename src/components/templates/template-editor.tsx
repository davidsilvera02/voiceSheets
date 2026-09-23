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
import { Copy, Eye, Lock, Plus, Save } from "lucide-react";
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
import { useCreateTemplate, useDuplicateTemplate, useUpdateTemplate } from "@/hooks/use-templates";
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
  const [voiceExample, setVoiceExample] = useState(template?.voiceExample ?? "");
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
        voiceExample: voiceExample.trim(),
        icon,
        columns: columns.map(({ id: _id, ...rest }) => rest),
      }),
    [name, description, voiceExample, icon, columns],
  );
  const initialSnapshot = useRef<string | null>(null);
  if (initialSnapshot.current === null) initialSnapshot.current = snapshot;
  const dirty = initialSnapshot.current !== snapshot;
  const guard = useNavigationGuard(dirty);

  // Once a template has spreadsheets, its structure is locked: columns can't be
  // added, removed, or retyped (that would diverge from the immutable snapshot
  // each spreadsheet already holds). Names, examples, and AI hints stay
  // editable; changing the structure means duplicating into a new template.
  const structureLocked = !!template && template.spreadsheetCount > 0;
  const duplicate = useDuplicateTemplate();

  async function handleDuplicate() {
    if (!template) return;
    try {
      const copy = await duplicate.mutateAsync(template.id);
      toast.success("Plantilla duplicada — edita la copia libremente");
      initialSnapshot.current = snapshot; // avoid the unsaved-changes prompt
      router.push(`/templates/${copy.id}/edit`);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "No se pudo duplicar");
    }
  }

  // Editing a column's label or AI guidance on an in-use template propagates to
  // its spreadsheets (a safe relabel) — so warn before saving those changes.
  const [showUpdateSheets, setShowUpdateSheets] = useState(false);
  const metadataChanged = useMemo(() => {
    if (!template) return false;
    const orig = new Map(template.columns.map((c) => [c.key, c]));
    return columns.some((c) => {
      if (!c.key) return false;
      const o = orig.get(c.key);
      if (!o) return false;
      return (
        c.aiHint.trim() !== (o.aiHint ?? "") ||
        c.description.trim() !== (o.description ?? "")
      );
    });
  }, [template, columns]);
  const willUpdateSheets = structureLocked && metadataChanged;

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
          aiHint: c.aiHint,
          options: c.options,
          config: { currency: c.currency } as ColumnConfig,
        })),
    [columns],
  );

  function buildPayload(): CreateTemplateInput | null {
    if (!name.trim()) {
      toast.error("Ponle un nombre a tu plantilla");
      return null;
    }
    const named = columns.filter((c) => c.name.trim());
    if (named.length === 0) {
      toast.error("Añade al menos una columna");
      return null;
    }
    for (const c of named) {
      if (c.type === "DROPDOWN" && c.options.filter((o) => o.trim()).length === 0) {
        toast.error(`La columna de lista desplegable "${c.name}" necesita al menos una opción`);
        return null;
      }
    }
    return {
      name: name.trim(),
      description: description.trim() || null,
      voiceExample: voiceExample.trim() || null,
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
        toast.success("Plantilla guardada");
        return { ok: true, id: template.id };
      }
      const created = await create.mutateAsync(payload);
      toast.success("Plantilla creada");
      return { ok: true, id: created.id };
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "No se pudo guardar la plantilla");
      return { ok: false };
    }
  }

  async function doSave() {
    const res = await persist();
    if (res.ok && res.id) {
      initialSnapshot.current = snapshot; // mark clean before navigating
      router.push(`/templates/${res.id}`);
    }
  }

  async function handleSave() {
    // Confirm before relabeling spreadsheets that use this template.
    if (willUpdateSheets) {
      setShowUpdateSheets(true);
      return;
    }
    await doSave();
  }

  const saving = create.isPending || update.isPending;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <PageHeader
        title={template ? "Editar plantilla" : "Nueva plantilla"}
        description="Define las columnas que usarán tus hojas de cálculo."
        actions={
          <>
            <Button variant="outline" onClick={() => setShowPreview(true)}>
              <Eye className="h-4 w-4" /> Vista previa
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar plantilla"}
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="space-y-1.5">
              <Label className="text-xs">Icono</Label>
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
                Nombre
              </Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="p. ej. Solicitudes de compra"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc" className="text-xs">
              Descripción
            </Label>
            <Textarea
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿Para qué se usa esta plantilla?"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-voice" className="text-xs">
              Ejemplo de voz
            </Label>
            <Textarea
              id="tpl-voice"
              value={voiceExample}
              onChange={(e) => setVoiceExample(e.target.value)}
              placeholder="p. ej. Pide 30 cajas de papel A4 a Office Depot a 4.50 cada una, necesarias para el próximo viernes."
              rows={2}
            />
            <p className="text-[11px] text-muted-foreground">
              Se muestra como guía en el cuadro de entrada por voz antes de grabar. Déjalo en blanco para usar el valor predeterminado.
            </p>
          </div>
        </CardContent>
      </Card>

      {structureLocked && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium">
                Estructura bloqueada — {template?.spreadsheetCount} hoja
                {template?.spreadsheetCount === 1 ? "" : "s"} de cálculo usa
                {template?.spreadsheetCount === 1 ? "" : "n"} esta plantilla
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Puedes refinar las descripciones y las sugerencias para la IA. Para cambiar
                nombres, orden, tipos o añadir/eliminar columnas, duplica esta plantilla.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={handleDuplicate}
            disabled={duplicate.isPending}
          >
            <Copy className="h-4 w-4" />
            {duplicate.isPending ? "Duplicando…" : "Duplicar para editar la estructura"}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Columnas ({columns.length})</h2>
          {!structureLocked && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setColumns((c) => [...c, blankColumn()])}
            >
              <Plus className="h-4 w-4" /> Añadir columna
            </Button>
          )}
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {columns.map((column) => (
                <ColumnRow
                  key={column.id}
                  column={column}
                  locked={structureLocked}
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
            Aún no hay columnas. Añade tu primera columna para empezar.
          </p>
        )}
      </div>

      <TemplatePreview
        open={showPreview}
        onOpenChange={setShowPreview}
        name={name || "Plantilla sin título"}
        columns={previewColumns}
      />

      {/* Unsaved-changes prompt when navigating away */}
      <Dialog open={guard.pendingHref !== null} onOpenChange={(o) => !o && guard.cancel()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Guardar los cambios?</DialogTitle>
            <DialogDescription>
              Tienes cambios sin guardar en esta plantilla. ¿Quieres guardarlos antes de salir?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={guard.cancel}>
              Cancelar
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  initialSnapshot.current = snapshot; // discard: treat as clean
                  guard.proceed();
                }}
              >
                Descartar
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
                {saving ? "Guardando…" : "Guardar y salir"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm relabeling spreadsheets when metadata changes on an in-use template */}
      <Dialog open={showUpdateSheets} onOpenChange={setShowUpdateSheets}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Actualizar las hojas de cálculo?</DialogTitle>
            <DialogDescription>
              Se aplicarán a las hojas de cálculo que usan esta plantilla. Tus datos no cambian.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setShowUpdateSheets(false)}>
              Cancelar
            </Button>
            <Button
              disabled={saving}
              onClick={async () => {
                setShowUpdateSheets(false);
                await doSave();
              }}
            >
              {saving ? "Guardando…" : "Guardar y actualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
