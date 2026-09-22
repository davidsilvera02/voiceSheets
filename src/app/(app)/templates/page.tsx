"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Copy,
  FileSpreadsheet,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateSpreadsheetDialog } from "@/components/spreadsheets/create-spreadsheet-dialog";
import { TemplateIcon } from "@/components/templates/template-icon";
import {
  useDeleteTemplate,
  useDuplicateTemplate,
  useSetTemplateStatus,
  useTemplates,
} from "@/hooks/use-templates";

export default function TemplatesPage() {
  const [tab, setTab] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
  const [q, setQ] = useState("");
  const templates = useTemplates({ status: tab, q });
  const duplicate = useDuplicateTemplate();
  const setStatus = useSetTemplateStatus();
  const remove = useDeleteTemplate();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sheetForTemplate, setSheetForTemplate] = useState<string | null>(null);

  const items = templates.data?.data ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Plantillas"
        description="Estructuras de columnas reutilizables que impulsan tus hojas de cálculo."
        actions={
          <Button asChild>
            <Link href="/templates/new">
              <Plus className="h-4 w-4" /> Nueva plantilla
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="ACTIVE">Activas</TabsTrigger>
            <TabsTrigger value="ARCHIVED">Archivadas</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          placeholder="Buscar plantillas…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>

      {templates.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title={tab === "ACTIVE" ? "Aún no hay plantillas" : "No hay plantillas archivadas"}
          description={
            tab === "ACTIVE"
              ? "Crea una plantilla para definir las columnas que usarán tus hojas de cálculo."
              : "Las plantillas que archives aparecerán aquí."
          }
          action={
            tab === "ACTIVE" && (
              <Button asChild>
                <Link href="/templates/new">
                  <Plus className="h-4 w-4" /> Nueva plantilla
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-primary">
                      <TemplateIcon name={t.icon} className="h-4 w-4" />
                    </span>
                    <Link href={`/templates/${t.id}`} className="hover:underline">
                      {t.name}
                    </Link>
                  </CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/templates/${t.id}/edit`}>
                          <Pencil className="h-4 w-4" /> Editar
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSheetForTemplate(t.id)}>
                        <FileSpreadsheet className="h-4 w-4" /> Nueva hoja de cálculo
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async () => {
                          await duplicate.mutateAsync(t.id);
                          toast.success("Plantilla duplicada");
                        }}
                      >
                        <Copy className="h-4 w-4" /> Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={async () => {
                          await setStatus.mutateAsync({
                            id: t.id,
                            status: tab === "ACTIVE" ? "ARCHIVED" : "ACTIVE",
                          });
                          toast.success(tab === "ACTIVE" ? "Plantilla archivada" : "Plantilla restaurada");
                        }}
                      >
                        {tab === "ACTIVE" ? (
                          <>
                            <Archive className="h-4 w-4" /> Archivar
                          </>
                        ) : (
                          <>
                            <ArchiveRestore className="h-4 w-4" /> Restaurar
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteId(t.id)}
                      >
                        <Trash2 className="h-4 w-4" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {t.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                )}
              </CardHeader>
              <CardContent className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="font-normal">
                  {t.columns.length} columnas
                </Badge>
                <Badge variant="outline" className="font-normal">
                  {t.spreadsheetCount} hojas de cálculo
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="¿Eliminar plantilla?"
        description="Esto elimina permanentemente la plantilla. Las hojas de cálculo ya creadas a partir de ella conservan sus datos."
        confirmLabel="Eliminar"
        destructive
        onConfirm={async () => {
          if (deleteId) {
            await remove.mutateAsync(deleteId);
            toast.success("Plantilla eliminada");
            setDeleteId(null);
          }
        }}
      />

      <CreateSpreadsheetDialog
        open={sheetForTemplate !== null}
        onOpenChange={(o) => !o && setSheetForTemplate(null)}
        templateId={sheetForTemplate ?? undefined}
      />
    </div>
  );
}
