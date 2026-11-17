"use client";

import * as React from "react";

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type Ctor = new () => RecognitionLike;

function getCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechError = "denied" | "failed" | null;

/** Browser Web Speech API wrapper. `supported` stays false (mic hidden) when the API is missing. */
export function useSpeech(lang: string, onText: (transcript: string) => void) {
  const [supported, setSupported] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [error, setError] = React.useState<SpeechError>(null);
  const rec = React.useRef<RecognitionLike | null>(null);
  const onTextRef = React.useRef(onText);
  React.useEffect(() => {
    onTextRef.current = onText;
  });

  React.useEffect(() => {
    setSupported(getCtor() !== null);
    return () => rec.current?.abort();
  }, []);

  const stop = React.useCallback(() => rec.current?.stop(), []);

  const start = React.useCallback(() => {
    const C = getCtor();
    if (!C) return;
    rec.current?.abort();
    const r = new C();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i]?.[0]?.transcript ?? "";
      onTextRef.current(t);
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") setError(null);
      else
        setError(
          e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied" : "failed",
        );
    };
    r.onend = () => {
      setListening(false);
      if (rec.current === r) rec.current = null;
    };
    setError(null);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
      setError("failed");
    }
  }, [lang]);

  return { supported, listening, error, start, stop };
}
