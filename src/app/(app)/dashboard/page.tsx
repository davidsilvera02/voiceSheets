"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  FileSpreadsheet,
  LayoutTemplate,
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
import { useSpreadsheets } from "@/hooks/use-spreadsheets";
import { useTemplates } from "@/hooks/use-templates";

export default function DashboardPage() {
  const recent = useSpreadsheets();
  const favorites = useSpreadsheets({ favorite: true });
  const templates = useTemplates({ status: "ACTIVE" });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-6">
      <PageHeader
        title="Dashboard"
        description="Jump back into your work or start something new."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/templates/new">
                <LayoutTemplate className="h-4 w-4" /> New template
              </Link>
            </Button>
            <Button asChild>
              <Link href="/spreadsheets?new=1">
                <Plus className="h-4 w-4" /> New spreadsheet
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={FileSpreadsheet}
          label="Spreadsheets"
          value={recent.data?.meta.total}
          href="/spreadsheets"
        />
        <StatCard
          icon={LayoutTemplate}
          label="Templates"
          value={templates.data?.meta.total}
          href="/templates"
        />
        <Card className="vs-brand-gradient border-0 text-white shadow-soft-md">
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold">Voice entry</p>
              <p className="text-xs text-white/75">
                Open a spreadsheet and dictate rows hands-free.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-muted-foreground">Favorites</h2>
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
            Star a spreadsheet to pin it here for quick access.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Recently edited</h2>
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
            title="No spreadsheets yet"
            description="Create a template, then spin up your first spreadsheet from it."
            action={
              <Button asChild>
                <Link href="/templates/new">
                  <Plus className="h-4 w-4" /> Create a template
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
    <Link href={href}>
      <Card className="transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft-md">
        <CardContent className="flex items-center gap-3 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-2xl font-bold tracking-tight">{value ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
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
            <Badge variant="secondary" className="min-w-0 max-w-[50%] font-normal">
              {sheet.templateName}
            </Badge>
          )}
          <span className="shrink-0 whitespace-nowrap">{sheet.rowCount} rows</span>
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
