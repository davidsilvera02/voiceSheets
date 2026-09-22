"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  ArchiveRestore,
  Copy,
  FileSpreadsheet,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreateSpreadsheetDialog } from "@/components/spreadsheets/create-spreadsheet-dialog";
import {
  useDeleteSpreadsheet,
  useDuplicateSpreadsheet,
  useSpreadsheets,
  useUpdateSpreadsheet,
} from "@/hooks/use-spreadsheets";

export default function SpreadsheetsPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const list = useSpreadsheets({ status: tab, q });
  const duplicate = useDuplicateSpreadsheet();
  const remove = useDeleteSpreadsheet();

  useEffect(() => {
    if (searchParams.get("new") === "1") setCreateOpen(true);
  }, [searchParams]);

  const items = list.data?.data ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Hojas de cálculo"
        description="Cada hoja de cálculo es un conjunto de datos activo creado a partir de una plantilla."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nueva hoja de cálculo
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
          placeholder="Buscar hojas de cálculo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>

      {list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title={tab === "ACTIVE" ? "Aún no hay hojas de cálculo" : "No hay hojas de cálculo archivadas"}
          description={
            tab === "ACTIVE"
              ? "Crea tu primera hoja de cálculo a partir de una plantilla."
              : "Las hojas de cálculo que archives aparecerán aquí."
          }
          action={
            tab === "ACTIVE" && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Nueva hoja de cálculo
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <SheetCard
              key={s.id}
              sheet={s}
              tab={tab}
              onDuplicate={async () => {
                await duplicate.mutateAsync({ id: s.id, withRows: true });
                toast.success("Hoja de cálculo duplicada");
              }}
              onDelete={() => setDeleteId(s.id)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="¿Eliminar hoja de cálculo?"
        description="Esto elimina permanentemente la hoja de cálculo, junto con todas sus filas e historial."
        confirmLabel="Eliminar"
        destructive
        onConfirm={async () => {
          if (deleteId) {
            await remove.mutateAsync(deleteId);
            toast.success("Hoja de cálculo eliminada");
            setDeleteId(null);
          }
        }}
      />

      <CreateSpreadsheetDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function SheetCard({
  sheet,
  tab,
  onDuplicate,
  onDelete,
}: {
  sheet: {
    id: string;
    name: string;
    templateName: string | null;
    rowCount: number;
    lastActivityAt: string;
    isFavorite: boolean;
  };
  tab: "ACTIVE" | "ARCHIVED";
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const update = useUpdateSpreadsheet(sheet.id);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(sheet.name);

  function saveRename() {
    if (renameValue.trim()) {
      update.mutate({ name: renameValue.trim() });
      setRenameOpen(false);
    }
  }

  return (
    <>
    <Card className="flex flex-col">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">
            <Link href={`/spreadsheets/${sheet.id}`} className="hover:underline">
              {sheet.name}
            </Link>
          </CardTitle>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => update.mutate({ isFavorite: !sheet.isFavorite })}
            >
              <Star
                className={`h-4 w-4 ${sheet.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
              />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/spreadsheets/${sheet.id}`}>
                    <FileSpreadsheet className="h-4 w-4" /> Abrir
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setRenameValue(sheet.name);
                    setRenameOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" /> Cambiar nombre
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="h-4 w-4" /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    update.mutate({ status: tab === "ACTIVE" ? "ARCHIVED" : "ACTIVE" })
                  }
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
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4" /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="mt-auto flex items-center gap-2 overflow-hidden p-4 pt-0 text-xs text-muted-foreground">
        {sheet.templateName && (
          <Badge variant="secondary" className="min-w-0 shrink truncate font-normal">
            {sheet.templateName}
          </Badge>
        )}
        <span className="shrink-0 whitespace-nowrap">{sheet.rowCount} filas</span>
        <span className="ml-auto shrink-0 whitespace-nowrap">
          {formatDistanceToNow(new Date(sheet.lastActivityAt), { addSuffix: true })}
        </span>
      </CardContent>
    </Card>

    <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar nombre de la hoja de cálculo</DialogTitle>
        </DialogHeader>
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && saveRename()}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setRenameOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={saveRename}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
