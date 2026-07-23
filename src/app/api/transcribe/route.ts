import { type NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/server/auth";
import { AppError, ok, route } from "@/server/http";
import { env, isWhisperConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Server-side speech-to-text using OpenAI Whisper. Accepts multipart form-data
 * with an `audio` file. When Whisper is not configured, returns 503 so the
 * client can fall back to the browser Web Speech API or manual transcript entry.
 */
export const POST = route(async (req: NextRequest) => {
  await getAuthContext();

  if (!isWhisperConfigured()) {
    return NextResponse.json(
      {
        error: {
          message: "Server transcription is not configured",
          code: "whisper_unavailable",
        },
      },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob)) {
    throw new AppError("An `audio` file is required", 422, "validation_error");
  }

  const upstream = new FormData();
  upstream.append("file", audio, "recording.webm");
  upstream.append("model", env.WHISPER_MODEL);
  upstream.append("response_format", "json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: upstream,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AppError(`Transcription failed: ${detail || res.statusText}`, 502, "transcription_error");
  }

  const data = (await res.json()) as { text?: string };
  return ok({ text: data.text ?? "" });
});
