"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronRight,
  FileSpreadsheet,
  LayoutTemplate,
  Mic,
  Plus,
  Sparkles,
  Star,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSpreadsheets } from "@/hooks/use-spreadsheets";
import { useTemplates } from "@/hooks/use-templates";

export default function DashboardPage() {
  const router = useRouter();
  const recent = useSpreadsheets();
  const favorites = useSpreadsheets({ favorite: true });
  const templates = useTemplates({ status: "ACTIVE" });
  const sheets = recent.data?.data ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-6">
      <PageHeader
        title="Dashboard"
        description="Retoma tu trabajo o empieza algo nuevo."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/templates/new">
                <LayoutTemplate className="h-4 w-4" /> Nueva plantilla
              </Link>
            </Button>
            <Button asChild>
              <Link href="/spreadsheets?new=1">
                <Plus className="h-4 w-4" /> Nueva hoja de cálculo
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={FileSpreadsheet}
          label="Hojas de cálculo"
          value={recent.data?.meta.total}
          href="/spreadsheets"
        />
        <StatCard
          icon={LayoutTemplate}
          label="Plantillas"
          value={templates.data?.meta.total}
          href="/templates"
        />
        {sheets.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="block h-full w-full text-left">
                <Card className="h-full bg-gradient-to-br from-primary/10 to-transparent transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft-md">
                  <CardContent className="flex h-full items-center gap-3 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Entrada por voz</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Elige una hoja de cálculo para dictar
                      </p>
                    </div>
                    <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Dicta una fila en…</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sheets.slice(0, 8).map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  onSelect={() => router.push(`/spreadsheets/${s.id}?voice=1`)}
                >
                  <Mic className="h-4 w-4 text-primary" />
                  <span className="truncate">{s.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link href="/spreadsheets?new=1" className="block h-full">
            <Card className="h-full bg-gradient-to-br from-primary/10 to-transparent transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft-md">
              <CardContent className="flex h-full items-center gap-3 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Entrada por voz</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Crea una hoja de cálculo para empezar a dictar
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-muted-foreground">Favoritos</h2>
        </div>
        {favorites.isLoading ? (
          <CardGridSkeleton />
        ) : favorites.data && favorites.data.data.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.data.data.map((s) => (
              <SheetCard key={s.id} sheet={s} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Marca una hoja de cálculo como favorita para fijarla aquí.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Editado recientemente</h2>
        {recent.isLoading ? (
          <CardGridSkeleton />
        ) : recent.data && recent.data.data.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.data.data.slice(0, 6).map((s) => (
              <SheetCard key={s.id} sheet={s} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FileSpreadsheet}
            title="Aún no hay hojas de cálculo"
            description="Crea una plantilla y luego genera tu primera hoja de cálculo a partir de ella."
            action={
              <Button asChild>
                <Link href="/templates/new">
                  <Plus className="h-4 w-4" /> Crear plantilla
                </Link>
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof FileSpreadsheet;
  label: string;
  value: number | undefined;
  href: string;
}) {
  return (
    <Link href={href} className="block h-full">
      <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft-md">
        <CardContent className="flex h-full items-center gap-3 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-2xl font-bold tracking-tight">{value ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SheetCard({
  sheet,
}: {
  sheet: {
    id: string;
    name: string;
    templateName: string | null;
    rowCount: number;
    lastActivityAt: string;
    isFavorite: boolean;
  };
}) {
  return (
    <Link href={`/spreadsheets/${sheet.id}`}>
      <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft-md">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span className="truncate">{sheet.name}</span>
            {sheet.isFavorite && <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 overflow-hidden p-4 pt-0 text-xs text-muted-foreground">
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
    </Link>
  );
}

function CardGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}
