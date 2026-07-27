import { type NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/server/auth";
import { AppError, ok, route } from "@/server/http";
import { env, isWhisperConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Map an audio MIME type to a file extension the transcription API accepts. */
function audioExt(mime: string): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "mp4";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("wav")) return "wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  return "webm";
}

/**
 * Server-side speech-to-text using OpenAI (WHISPER_MODEL, default
 * gpt-4o-mini-transcribe). Accepts multipart form-data with an `audio` file.
 * When OpenAI is not configured, returns 503 so the client can fall back to the
 * browser Web Speech API or manual transcript entry.
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

  // Name the upload with an extension matching the actual audio format — the
  // transcription API sniffs the format from the filename. Browsers differ:
  // Chrome/Firefox record webm, Safari/iOS records mp4. A fixed ".webm" name
  // would make Safari recordings fail as "corrupted or unsupported".
  const upstream = new FormData();
  upstream.append("file", audio, `recording.${audioExt(audio.type)}`);
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
