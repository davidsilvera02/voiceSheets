"use client";

import { COLUMN_TYPE_META, type ColumnDefinition } from "@/lib/columns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function TemplatePreview({
  open,
  onOpenChange,
  name,
  columns,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  name: string;
  columns: Pick<ColumnDefinition, "key" | "name" | "type" | "required" | "example">[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Preview · {name}</DialogTitle>
          <DialogDescription>
            This is how a spreadsheet built from this template will look.
          </DialogDescription>
        </DialogHeader>
        {columns.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Add some columns to see a preview.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur">
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.key} className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{c.name}</span>
                        {c.required && <span className="text-destructive">*</span>}
                        <Badge variant="outline" className="ml-1 font-normal">
                          {COLUMN_TYPE_META[c.type].label}
                        </Badge>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[0, 1].map((r) => (
                  <TableRow key={r}>
                    {columns.map((c) => (
                      <TableCell key={c.key} className="whitespace-nowrap text-muted-foreground">
                        {c.example || <span className="italic opacity-50">empty</span>}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
