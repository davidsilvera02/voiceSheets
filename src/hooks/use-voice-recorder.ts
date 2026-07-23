"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "recording" | "transcribing" | "error";
export type RecorderMode = "whisper" | "speech" | "unsupported";

// Minimal typing for the browser Web Speech API (not in lib.dom for all TS libs).
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult:
    | ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Keep only English/Spanish letters, digits, whitespace and common punctuation.
const DISALLOWED =
  /[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.,;:¿?¡!'"“”‘’()[\]{}\-–—_/\\|@#$%&*+=<>°ºª€£¢~^…]/g;

export function sanitizeTranscript(text: string): string {
  return text.replace(DISALLOWED, "").replace(/[ \t]{2,}/g, " ");
}

/**
 * Captures microphone audio and produces a transcript.
 * - `onInterim` streams a live (best-effort) transcript while recording, using
 *   the browser Web Speech API — even when Whisper is the final transcriber.
 * - `onTranscript` fires once with the final transcript (Whisper when
 *   configured, otherwise the Web Speech result).
 * - `cancel()` aborts a recording without transcribing anything.
 */
export function useVoiceRecorder({
  whisperEnabled,
  onTranscript,
  onInterim,
}: {
  whisperEnabled: boolean;
  onTranscript: (text: string) => void;
  onInterim?: (text: string) => void;
}) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null); // speech-mode primary
  const liveRecognitionRef = useRef<SpeechRecognitionLike | null>(null); // whisper-mode live preview
  const speechFinalRef = useRef<string>("");
  const cancelledRef = useRef(false);

  const SpeechRecognitionCtor = getSpeechRecognition();
  const canRecordAudio =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const mode: RecorderMode =
    whisperEnabled && canRecordAudio
      ? "whisper"
      : SpeechRecognitionCtor
        ? "speech"
        : canRecordAudio
          ? "whisper"
          : "unsupported";

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopLiveRecognition = useCallback(() => {
    try {
      liveRecognitionRef.current?.abort();
    } catch {
      /* ignore */
    }
    liveRecognitionRef.current = null;
  }, []);

  useEffect(
    () => () => {
      cleanupStream();
      stopLiveRecognition();
    },
    [cleanupStream, stopLiveRecognition],
  );

  const lang = () => (typeof navigator !== "undefined" && navigator.language) || "en-US";

  // Best-effort live transcript for the Whisper path (Whisper stays authoritative).
  const startLiveRecognition = useCallback(() => {
    if (!SpeechRecognitionCtor || !onInterim) return;
    try {
      const rec = new SpeechRecognitionCtor();
      rec.lang = lang();
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event) => {
        let final = "";
        let interim = "";
        for (let i = 0; i < event.results.length; i++) {
          const r = event.results[i];
          if (!r) continue;
          if (r.isFinal) final += `${r[0].transcript} `;
          else interim += r[0].transcript;
        }
        onInterim(sanitizeTranscript(`${final}${interim}`.trimStart()));
      };
      rec.onerror = () => {};
      rec.onend = () => {};
      liveRecognitionRef.current = rec;
      rec.start();
    } catch {
      /* live preview is optional */
    }
  }, [SpeechRecognitionCtor, onInterim]);

  const startWhisper = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    chunksRef.current = [];
    cancelledRef.current = false;
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      cleanupStream();
      stopLiveRecognition();
      if (cancelledRef.current) {
        setStatus("idle");
        return;
      }
      setStatus("transcribing");
      try {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "recording.webm");
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error?.message ?? "Transcription failed");
        }
        const { data } = (await res.json()) as { data: { text: string } };
        onTranscript(sanitizeTranscript(data.text.trim()));
        setStatus("idle");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transcription failed");
        setStatus("error");
      }
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    startLiveRecognition(); // parallel live preview
    setStatus("recording");
  }, [cleanupStream, stopLiveRecognition, startLiveRecognition, onTranscript]);

  const startSpeech = useCallback(() => {
    if (!SpeechRecognitionCtor) throw new Error("Speech recognition unavailable");
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang();
    recognition.continuous = true;
    recognition.interimResults = true;
    speechFinalRef.current = "";
    cancelledRef.current = false;
    recognition.onresult = (event) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (!r) continue;
        if (r.isFinal) final += `${r[0].transcript} `;
        else interim += r[0].transcript;
      }
      speechFinalRef.current = final;
      onInterim?.(sanitizeTranscript(`${final}${interim}`.trimStart()));
    };
    recognition.onerror = (event) => {
      setError(event.error === "not-allowed" ? "Microphone permission denied" : event.error);
      setStatus("error");
    };
    recognition.onend = () => {
      if (cancelledRef.current) {
        setStatus("idle");
        return;
      }
      const text = sanitizeTranscript(speechFinalRef.current.trim());
      if (text) onTranscript(text);
      setStatus("idle");
    };
    recognitionRef.current = recognition;
    recognition.start();
    setStatus("recording");
  }, [SpeechRecognitionCtor, onTranscript, onInterim]);

  const start = useCallback(async () => {
    setError(null);
    try {
      if (mode === "whisper") await startWhisper();
      else if (mode === "speech") startSpeech();
      else setError("Voice capture is not supported in this browser.");
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied. Please allow access and try again."
          : err instanceof Error
            ? err.message
            : "Could not start recording";
      setError(message);
      setStatus("error");
    }
  }, [mode, startWhisper, startSpeech]);

  const stop = useCallback(() => {
    if (mode === "whisper") mediaRecorderRef.current?.stop();
    else recognitionRef.current?.stop();
  }, [mode]);

  /** Abort a recording without transcribing (discard). */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stopLiveRecognition();
    try {
      if (mode === "whisper") mediaRecorderRef.current?.stop();
      else recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }
    cleanupStream();
    setStatus("idle");
  }, [mode, stopLiveRecognition, cleanupStream]);

  return { status, error, mode, start, stop, cancel, reset: () => setStatus("idle") };
}
