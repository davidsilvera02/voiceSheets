import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { ok, route } from "@/server/http";
import { aiExtractSchema } from "@/lib/validations";
import { requireSpreadsheet } from "@/server/services/spreadsheet-service";
import { extractRow } from "@/server/services/ai-service";
import { recordAudit } from "@/server/services/audit-service";
import type { CellValue } from "@/lib/columns";

export const dynamic = "force-dynamic";
// AI calls can take a few seconds; allow generous execution time.
export const maxDuration = 60;

export const POST = route(async (req: NextRequest) => {
  const ctx = await getAuthContext();
  const body = aiExtractSchema.parse(await req.json());
  const { columns } = await requireSpreadsheet(ctx.workspace.id, body.spreadsheetId);

  const result = await extractRow({
    columns,
    transcript: body.transcript,
    current: body.current as Record<string, CellValue> | undefined,
  });

  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "ai.extract",
    entityType: "spreadsheet",
    entityId: body.spreadsheetId,
    metadata: { usedFallback: result.usedFallback, missing: result.missing.length },
  });

  return ok(result);
});
