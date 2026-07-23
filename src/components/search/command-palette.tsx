"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, LayoutTemplate, Rows3 } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { apiGet } from "@/lib/api-client";
import type { GlobalSearchResult } from "@/lib/types";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult>({
    templates: [],
    spreadsheets: [],
    rows: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 1) {
      setResults({ templates: [], spreadsheets: [], rows: [] });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await apiGet<GlobalSearchResult>(
          `/api/search?q=${encodeURIComponent(query)}`,
        );
        if (!controller.signal.aborted) setResults(data);
      } catch {
        /* ignore transient search errors */
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, open]);

  function go(path: string) {
    onOpenChange(false);
    setQuery("");
    router.push(path);
  }

  const hasResults =
    results.templates.length + results.spreadsheets.length + results.rows.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search templates, spreadsheets, rows…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? "Searching…" : query ? "No results found." : "Type to search your workspace."}
        </CommandEmpty>
        {results.spreadsheets.length > 0 && (
          <CommandGroup heading="Spreadsheets">
            {results.spreadsheets.map((s) => (
              <CommandItem key={s.id} value={`sheet-${s.id}-${s.name}`} onSelect={() => go(`/spreadsheets/${s.id}`)}>
                <FileSpreadsheet className="text-muted-foreground" />
                <span>{s.name}</span>
                {s.templateName && (
                  <span className="ml-auto text-xs text-muted-foreground">{s.templateName}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.templates.length > 0 && (
          <CommandGroup heading="Templates">
            {results.templates.map((t) => (
              <CommandItem key={t.id} value={`tpl-${t.id}-${t.name}`} onSelect={() => go(`/templates/${t.id}`)}>
                <LayoutTemplate className="text-muted-foreground" />
                <span>{t.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.rows.length > 0 && (
          <CommandGroup heading="Rows">
            {results.rows.map((r) => (
              <CommandItem
                key={r.id}
                value={`row-${r.id}-${r.snippet}`}
                onSelect={() => go(`/spreadsheets/${r.spreadsheetId}?row=${r.id}`)}
              >
                <Rows3 className="text-muted-foreground" />
                <span className="truncate">{r.snippet}</span>
                <span className="ml-auto text-xs text-muted-foreground">{r.spreadsheetName}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!hasResults && query && !loading && null}
      </CommandList>
    </CommandDialog>
  );
}
