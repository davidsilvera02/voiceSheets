"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  buildRowSchema,
  defaultValueForColumn,
  type CellValue,
  type ColumnDefinition,
} from "@/lib/columns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FieldInput } from "@/components/spreadsheet/field-input";
import { useCreateRow } from "@/hooks/use-rows";
import { ApiClientError } from "@/lib/api-client";

export function ManualEntryDialog({
  open,
  onOpenChange,
  spreadsheetId,
  columns,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  spreadsheetId: string;
  columns: ColumnDefinition[];
}) {
  const createRow = useCreateRow(spreadsheetId);
  const schema = buildRowSchema(columns);

  const defaults = Object.fromEntries(
    columns.map((c) => [c.key, defaultValueForColumn(c) ?? (c.type === "BOOLEAN" ? false : "")]),
  );

  const form = useForm({ resolver: zodResolver(schema), defaultValues: defaults });

  useEffect(() => {
    if (open) form.reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: Record<string, unknown>) {
    try {
      await createRow.mutateAsync({ values: values as Record<string, CellValue>, source: "MANUAL" });
      toast.success("Row added");
      form.reset(defaults);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to add row");
    }
  }

  async function onSubmitAndAdd(values: Record<string, unknown>) {
    try {
      await createRow.mutateAsync({ values: values as Record<string, CellValue>, source: "MANUAL" });
      toast.success("Row added — add another");
      form.reset(defaults);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to add row");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add row</DialogTitle>
          <DialogDescription>Fill in the fields for this record.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {/* Horizontal padding keeps focus rings from being clipped by the ScrollArea's overflow. */}
          <form className="space-y-4 px-1 pr-3" onSubmit={form.handleSubmit(onSubmit)}>
            {columns.map((column, i) => (
              <FieldInput
                key={column.key}
                column={column}
                control={form.control}
                spreadsheetId={spreadsheetId}
                autoFocus={i === 0}
                error={form.formState.errors[column.key]?.message as string | undefined}
              />
            ))}
          </form>
        </ScrollArea>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={form.handleSubmit(onSubmitAndAdd)}
            disabled={createRow.isPending}
          >
            Save & add another
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={createRow.isPending}>
            {createRow.isPending ? "Saving…" : "Add row"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
