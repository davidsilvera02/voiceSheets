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
        title="Templates"
        description="Reusable column structures that power your spreadsheets."
        actions={
          <Button asChild>
            <Link href="/templates/new">
              <Plus className="h-4 w-4" /> New template
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="ACTIVE">Active</TabsTrigger>
            <TabsTrigger value="ARCHIVED">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          placeholder="Search templates…"
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
          title={tab === "ACTIVE" ? "No templates yet" : "No archived templates"}
          description={
            tab === "ACTIVE"
              ? "Create a template to define the columns your spreadsheets will use."
              : "Templates you archive will appear here."
          }
          action={
            tab === "ACTIVE" && (
              <Button asChild>
                <Link href="/templates/new">
                  <Plus className="h-4 w-4" /> New template
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
                          <Pencil className="h-4 w-4" /> Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSheetForTemplate(t.id)}>
                        <FileSpreadsheet className="h-4 w-4" /> New spreadsheet
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async () => {
                          await duplicate.mutateAsync(t.id);
                          toast.success("Template duplicated");
                        }}
                      >
                        <Copy className="h-4 w-4" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={async () => {
                          await setStatus.mutateAsync({
                            id: t.id,
                            status: tab === "ACTIVE" ? "ARCHIVED" : "ACTIVE",
                          });
                          toast.success(tab === "ACTIVE" ? "Template archived" : "Template restored");
                        }}
                      >
                        {tab === "ACTIVE" ? (
                          <>
                            <Archive className="h-4 w-4" /> Archive
                          </>
                        ) : (
                          <>
                            <ArchiveRestore className="h-4 w-4" /> Restore
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteId(t.id)}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
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
                  {t.columns.length} columns
                </Badge>
                <Badge variant="outline" className="font-normal">
                  {t.spreadsheetCount} spreadsheets
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete template?"
        description="This permanently deletes the template. Existing spreadsheets created from it keep their data."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleteId) {
            await remove.mutateAsync(deleteId);
            toast.success("Template deleted");
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
