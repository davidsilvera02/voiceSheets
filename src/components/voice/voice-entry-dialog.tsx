"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, RefreshCw, Send, Square, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { type CellValue, type ColumnDefinition, coerceValue } from "@/lib/columns";
import { CONFIDENCE_META, confidenceLevel } from "@/lib/confidence";
import type { AIExtractionResult } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMe } from "@/hooks/use-settings";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { useExtractRow } from "@/hooks/use-ai";
import { useCreateRow } from "@/hooks/use-rows";
import { ApiClientError } from "@/lib/api-client";

export function VoiceEntryDialog({
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
  const me = useMe();
  const extract = useExtractRow(spreadsheetId);
  const createRow = useCreateRow(spreadsheetId);

  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<AIExtractionResult | null>(null);
  const [values, setValues] = useState<Record<string, CellValue>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // Track open state in a ref so a late transcription can't repopulate a
  // dialog the user already closed.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const recorder = useVoiceRecorder({
    whisperEnabled: me.data?.capabilities.whisper ?? false,
    onTranscript: (text) => {
      if (!text || !openRef.current) return;
      // Once a row is drafted, further recordings are treated as corrections.
      // Otherwise: set the transcript and immediately draft the row so the
      // transcript and the generated row appear together (single commit).
      if (result) {
        void runCorrection(text);
      } else {
        setTranscript(text.trim());
        void generate(text.trim());
      }
    },
  });

  function discardRecording() {
    recorder.cancel();
    if (!result) setTranscript(""); // clear the live preview from this take
  }

  function reset() {
    setTranscript("");
    setResult(null);
    setValues({});
    setTouched(new Set());
  }

  function handleOpenChange(o: boolean) {
    if (!o) {
      reset();
      if (recorder.status === "recording") recorder.stop();
    }
    onOpenChange(o);
  }

  function applyResult(r: AIExtractionResult) {
    setResult(r);
    const next: Record<string, CellValue> = {};
    for (const c of columns) next[c.key] = r.fields[c.key]?.value ?? null;
    setValues(next);
    setTouched(new Set());
  }

  async function generate(text?: string) {
    const source = (text ?? transcript).trim();
    if (!source) return toast.error("Record or type something first");
    try {
      const r = await extract.mutateAsync({ transcript: source });
      applyResult(r);
      if (r.usedFallback) {
        toast.info("Used the built-in parser (no AI key configured). Review carefully.");
      }
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Extraction failed");
    }
  }

  async function runCorrection(correction: string) {
    try {
      const r = await extract.mutateAsync({ transcript: correction, current: values });
      applyResult(r);
      toast.success("Applied your correction");
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Correction failed");
    }
  }

  function setField(key: string, value: CellValue) {
    setValues((v) => ({ ...v, [key]: value }));
    setTouched((t) => new Set(t).add(key));
  }

  async function commit() {
    // Client-side required-field guard before committing.
    const missingRequired = columns.filter(
      (c) => c.required && (values[c.key] === null || values[c.key] === "" || values[c.key] === undefined),
    );
    if (missingRequired.length > 0) {
      return toast.error(`Please fill: ${missingRequired.map((c) => c.name).join(", ")}`);
    }
    const meta: Record<string, { aiGenerated: boolean; confidence: number | null }> = {};
    for (const c of columns) {
      const isTouched = touched.has(c.key);
      meta[c.key] = {
        aiGenerated: !isTouched && result != null,
        confidence: isTouched ? 1 : result?.fields[c.key]?.confidence ?? null,
      };
    }
    try {
      await createRow.mutateAsync({ values, source: "VOICE", meta });
      toast.success("Row added from voice");
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to add row");
    }
  }

  const isRecording = recorder.status === "recording";
  const isTranscribing = recorder.status === "transcribing";
  const generating = extract.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Voice entry
          </DialogTitle>
          <DialogDescription>
            Dictate a record — the AI drafts a row from your transcript. Review it below and add it in one step.
          </DialogDescription>
        </DialogHeader>

        {/* Recorder */}
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 py-5">
          <div className="flex items-center gap-3">
            {/* Spacer to keep the mic centered when the discard button shows. */}
            {isRecording && <div className="h-9 w-9" />}
            <button
              type="button"
              onClick={() => {
                if (isRecording) {
                  recorder.stop();
                } else {
                  if (!result) setTranscript(""); // clear before a fresh dictation
                  recorder.start();
                }
              }}
              disabled={isTranscribing || recorder.mode === "unsupported"}
              className={cn(
                "relative flex h-16 w-16 items-center justify-center rounded-full text-white transition-colors disabled:opacity-50",
                isRecording ? "bg-red-500" : "bg-primary hover:bg-primary/90",
              )}
            >
              {isRecording && (
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-red-500/60" />
              )}
              {isTranscribing ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : isRecording ? (
                <Square className="h-6 w-6" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </button>
            {isRecording && (
              <button
                type="button"
                onClick={discardRecording}
                title="Discard recording"
                className="flex h-9 w-9 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {recorder.mode === "unsupported"
              ? "Voice capture unavailable — type the transcript below."
              : isRecording
                ? "Listening… click to stop."
                : isTranscribing
                  ? "Transcribing…"
                  : result
                    ? "Record a correction, e.g. “No, the quantity is thirty.”"
                    : "Click to start dictating."}
          </p>
          {recorder.error && <p className="text-xs text-destructive">{recorder.error}</p>}
        </div>

        {/* Transcript */}
        <div className="space-y-1.5">
          <Label className="text-xs">Transcript</Label>
          {isRecording || isTranscribing ? (
            <div className="flex min-h-[76px] items-center justify-center rounded-md border bg-muted/20">
              <span className="shimmer-text text-sm font-semibold">Transcribing…</span>
            </div>
          ) : (
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="e.g. Order 30 boxes of A4 paper from Office Depot at 4.50 each, needed by next Friday."
              rows={3}
            />
          )}
        </div>

        {/* Drafting indicator (first generation) */}
        {generating && !result && (
          <div className="flex items-center justify-center gap-2 rounded-lg border p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Drafting the row from your transcript…
          </div>
        )}

        {/* Review — transcript + drafted row shown together */}
        {result && (
          <ScrollArea className="max-h-[38vh] rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> High
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Medium
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Low
              </span>
            </div>
            <div className="space-y-3">
              {columns.map((column) => (
                <ReviewField
                  key={column.key}
                  column={column}
                  value={values[column.key] ?? null}
                  confidence={result.fields[column.key]?.confidence ?? null}
                  reasoning={result.fields[column.key]?.reasoning}
                  touched={touched.has(column.key)}
                  onChange={(v) => setField(column.key, v)}
                />
              ))}
            </div>
            {result.notes && (
              <p className="mt-3 rounded bg-muted p-2 text-xs text-muted-foreground">
                <span className="font-medium">AI notes:</span> {result.notes}
              </p>
            )}
          </ScrollArea>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {result ? (
              <Button variant="outline" onClick={() => generate()} disabled={generating}>
                <RefreshCw className={cn("h-4 w-4", generating && "animate-spin")} /> Regenerate
              </Button>
            ) : (
              transcript.trim() && (
                <Button variant="outline" onClick={() => generate()} disabled={generating}>
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}{" "}
                  Draft row
                </Button>
              )
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={commit} disabled={!result || generating || createRow.isPending}>
              <Send className="h-4 w-4" /> {createRow.isPending ? "Adding…" : "Add row"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewField({
  column,
  value,
  confidence,
  reasoning,
  touched,
  onChange,
}: {
  column: ColumnDefinition;
  value: CellValue;
  confidence: number | null;
  reasoning?: string;
  touched: boolean;
  onChange: (v: CellValue) => void;
}) {
  const level = touched ? null : confidenceLevel(confidence);
  const raw = value == null ? "" : String(value);

  return (
    <div
      className={cn(
        "rounded-md border-l-2 pl-3",
        level ? CONFIDENCE_META[level].border : touched ? "border-l-emerald-500" : "border-l-transparent",
      )}
    >
      <div className="flex items-center justify-between">
        <Label className="text-xs">
          {column.name}
          {column.required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        {touched ? (
          <Badge variant="success" className="text-[10px]">
            edited
          </Badge>
        ) : (
          level && (
            <span className="flex items-center gap-1 text-[10px]" title={reasoning}>
              <span className={cn("h-1.5 w-1.5 rounded-full", CONFIDENCE_META[level].dot)} />
              <span className={CONFIDENCE_META[level].text}>
                {Math.round((confidence ?? 0) * 100)}%
              </span>
            </span>
          )
        )}
      </div>
      <div className="mt-1">
        {column.type === "BOOLEAN" ? (
          <div className="flex h-9 items-center">
            <Checkbox checked={value === true} onCheckedChange={(c) => onChange(Boolean(c))} />
          </div>
        ) : column.type === "DROPDOWN" ? (
          <Select value={typeof value === "string" ? value : ""} onValueChange={onChange}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {(column.options ?? []).map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : column.type === "LONG_TEXT" ? (
          <Textarea
            value={raw}
            onChange={(e) => onChange(coerceValue(column, e.target.value))}
            rows={2}
          />
        ) : (
          <Input
            className="h-8"
            type={column.type === "DATE" ? "date" : "text"}
            value={raw}
            onChange={(e) => onChange(coerceValue(column, e.target.value))}
          />
        )}
      </div>
    </div>
  );
}
