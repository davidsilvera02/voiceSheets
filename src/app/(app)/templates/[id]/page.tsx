"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FileSpreadsheet, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateSpreadsheetDialog } from "@/components/spreadsheets/create-spreadsheet-dialog";
import { TemplateIcon } from "@/components/templates/template-icon";
import { useTemplate } from "@/hooks/use-templates";
import { useSpreadsheets } from "@/hooks/use-spreadsheets";
import { COLUMN_TYPE_META } from "@/lib/columns";

export default function TemplateDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading } = useTemplate(params.id);
  const sheets = useSpreadsheets({ templateId: params.id });
  const [createOpen, setCreateOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Plantilla no encontrada.</div>;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
              <TemplateIcon name={data.icon} className="h-5 w-5" />
            </span>
            {data.name}
          </span>
        }
        description={data.description ?? undefined}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/templates/${data.id}/edit`}>
                <Pencil className="h-4 w-4" /> Editar
              </Link>
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <FileSpreadsheet className="h-4 w-4" /> Nueva hoja de cálculo
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Columna</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Obligatorio</TableHead>
                <TableHead>Sugerencia para la IA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.columns.map((c) => (
                <TableRow key={c.key}>
                  <TableCell className="font-medium">
                    {c.name}
                    {c.description && (
                      <p className="text-xs font-normal text-muted-foreground">{c.description}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {COLUMN_TYPE_META[c.type].label}
                    </Badge>
                  </TableCell>
                  <TableCell>{c.required ? "Sí" : "—"}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {c.aiHint ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Hojas de cálculo de esta plantilla
        </h2>
        {sheets.data && sheets.data.data.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sheets.data.data.map((s) => (
              <Link key={s.id} href={`/spreadsheets/${s.id}`}>
                <Card className="transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft-md">
                  <CardContent className="p-4">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.rowCount} filas</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aún no hay hojas de cálculo.</p>
        )}
      </section>

      <CreateSpreadsheetDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        templateId={data.id}
      />
    </div>
  );
}
