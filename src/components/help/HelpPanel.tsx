"use client";

import * as React from "react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  AlertCircleIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  BookOpenIcon,
  CheckIcon,
  CopyIcon,
  InfoIcon,
  MicIcon,
  RotateCcwIcon,
  SparklesIcon,
  SquareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  WifiOffIcon,
  XIcon,
} from "lucide-react";

import { cn } from "@/components/ui/_utils";
import { toPlainText } from "./markdown";
import { RichAnswer } from "./RichAnswer";
import { sourceHref } from "./paths";
import { strings } from "./strings";
import { useSpeech } from "./use-speech";
import {
  MAX_QUERY,
  type AskResponse,
  type HelpLocale,
  type HelpMode,
  type HelpLink,
  type HelpRelated,
  type HelpRole,
  type HelpSource,
  type Suggestions,
} from "./types";

type Msg =
  | { id: number; kind: "user"; text: string }
  | {
      id: number;
      kind: "bot";
      text: string;
      sources: HelpSource[];
      links: HelpLink[];
      related: HelpRelated[];
      mode: HelpMode;
      fb?: "up" | "down";
    }
  | { id: number; kind: "error"; why: "error" | "rate"; query: string };

type NewMsg = Msg extends infer M ? (M extends Msg ? Omit<M, "id"> : never) : never;

export interface HelpPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (e: Event) => void;
  role: HelpRole;
  hindi: boolean;
  suggestions: Suggestions;
}

const LOCALE_KEY = "ck_help_locale";

function isAnswer(v: unknown): v is AskResponse {
  return !!v && typeof v === "object" && typeof (v as AskResponse).answer === "string";
}

function Waveform({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("flex h-4 items-center gap-[3px]", className)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{ animationDelay: `${i * 110}ms` }}
          className="h-full w-[3px] origin-center rounded-full bg-current motion-safe:animate-[ck-help-wave_900ms_ease-in-out_infinite] motion-reduce:scale-y-75"
        />
      ))}
    </span>
  );
}

function TypingDots({ label }: { label: string }) {
  return (
    <div className="flex items-end gap-2.5" data-testid="help-typing">
      <Avatar />
      <div
        role="status"
        className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-elevated px-3.5 py-2.5 text-caption text-fg-muted"
      >
        <span aria-hidden className="flex gap-1">
          {[0, 150, 300].map((d) => (
            <span
              key={d}
              style={{ animationDelay: `${d}ms` }}
              className="size-1.5 rounded-full bg-accent-text motion-safe:animate-bounce"
            />
          ))}
        </span>
        {label}
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-fg shadow-1"
    >
      <SparklesIcon className="size-3.5" />
    </span>
  );
}

function IconAction({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className="grid size-8 place-items-center rounded-md text-fg-muted transition-colors hover:bg-elevated hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-accent-soft aria-pressed:text-accent-text"
    >
      {children}
    </button>
  );
}

function BotMessage({
  m,
  role,
  t,
  onFeedback,
  onAsk,
  onNavigate,
}: {
  m: Extract<Msg, { kind: "bot" }>;
  role: HelpRole;
  t: ReturnType<typeof strings>;
  onFeedback: (id: number, fb: "up" | "down") => void;
  onAsk: (q: string) => void;
  onNavigate: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toPlainText(m.text));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };
  return (
    <div className="flex items-start gap-2.5" data-testid="help-answer">
      <Avatar />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md border border-border bg-elevated px-3.5 py-3">
          {m.text.trim() ? (
            <RichAnswer
              text={m.text}
              mode={m.mode}
              title={m.mode === "guide" ? m.sources[0]?.title : undefined}
              links={m.links}
              t={t}
              onNavigate={onNavigate}
            />
          ) : (
            <p className="text-body-sm">{t.noAnswer}</p>
          )}
          {m.mode === "search" ? (
            <p className="mt-2.5 flex items-start gap-1.5 rounded-md bg-warning-soft px-2 py-1.5 text-caption text-warning-fg">
              <InfoIcon aria-hidden className="mt-px size-3.5 shrink-0" />
              {t.searchOnly}
            </p>
          ) : null}
        </div>
        {m.related.length ? (
          <div className="mt-2" aria-label={t.related} role="group" data-testid="help-related">
            <p className="mb-1.5 text-overline text-fg-subtle uppercase">{t.related}</p>
            <ul className="flex flex-wrap gap-1.5">
              {m.related.slice(0, 3).map((r) => (
                <li key={r.id} className="max-w-full">
                  <button
                    type="button"
                    onClick={() => onAsk(r.title)}
                    className="inline-flex min-h-8 max-w-full items-center rounded-full border border-border bg-surface px-3 py-1 text-caption text-fg-muted transition-colors hover:border-accent hover:text-accent-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
                  >
                    <span className="truncate">{r.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {m.sources.length && m.mode !== "search" ? (
          <div className="mt-2" aria-label={t.sources} role="group">
            <p className="mb-1.5 text-overline text-fg-subtle uppercase">{t.sources}</p>
            <ul className="flex flex-wrap gap-1.5">
              {m.sources.slice(0, 4).map((s) => {
                const href = sourceHref(s, role);
                const cls =
                  "inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-caption text-fg-muted";
                return (
                  <li key={s.id} className="max-w-full">
                    {href ? (
                      <Link
                        href={href}
                        className={cn(
                          cls,
                          "transition-colors hover:border-accent hover:text-accent-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        )}
                      >
                        <span className="truncate">{s.title}</span>
                        <ArrowUpRightIcon aria-hidden className="size-3 shrink-0" />
                      </Link>
                    ) : (
                      <span className={cls}>
                        <BookOpenIcon aria-hidden className="size-3 shrink-0" />
                        <span className="truncate">{s.title}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        <div className="mt-1.5 -ml-1.5 flex items-center gap-0.5">
          <IconAction label={copied ? t.copied : t.copy} onClick={copy}>
            {copied ? (
              <CheckIcon aria-hidden className="size-4 text-success" />
            ) : (
              <CopyIcon aria-hidden className="size-4" />
            )}
          </IconAction>
          <IconAction label={t.good} pressed={m.fb === "up"} onClick={() => onFeedback(m.id, "up")}>
            <ThumbsUpIcon aria-hidden className="size-4" />
          </IconAction>
          <IconAction
            label={t.bad}
            pressed={m.fb === "down"}
            onClick={() => onFeedback(m.id, "down")}
          >
            <ThumbsDownIcon aria-hidden className="size-4" />
          </IconAction>
          {m.fb ? <span className="ml-1 text-caption text-fg-muted">{t.thanks}</span> : null}
        </div>
      </div>
    </div>
  );
}

export default function HelpPanel({
  open,
  onOpenChange,
  onCloseAutoFocus,
  role,
  hindi,
  suggestions,
}: HelpPanelProps) {
  const [locale, setLocale] = React.useState<HelpLocale>("en");
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [online, setOnline] = React.useState(true);
  const [off, setOff] = React.useState(false);
  const [searchOnly, setSearchOnly] = React.useState(false);
  const nextId = React.useRef(1);
  const scroller = React.useRef<HTMLDivElement>(null);
  const field = React.useRef<HTMLTextAreaElement>(null);
  const abort = React.useRef<AbortController | null>(null);

  const activeLocale: HelpLocale = hindi ? locale : "en";
  const t = strings(activeLocale);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCALE_KEY);
      if (saved === "hi" || saved === "en") setLocale(saved);
    } catch {
      /* storage blocked */
    }
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const offl = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", offl);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", offl);
      abort.current?.abort();
    };
  }, []);

  const baseRef = React.useRef("");
  const speech = useSpeech(activeLocale === "hi" ? "hi-IN" : "en-IN", (transcript) => {
    const joined = `${baseRef.current}${baseRef.current && transcript ? " " : ""}${transcript}`;
    setText(joined.slice(0, MAX_QUERY));
  });

  React.useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy]);

  React.useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [text]);

  const pickLocale = (l: HelpLocale) => {
    if (speech.listening) speech.stop();
    setLocale(l);
    try {
      localStorage.setItem(LOCALE_KEY, l);
    } catch {
      /* storage blocked */
    }
  };

  const push = (m: NewMsg) => setMsgs((cur) => [...cur, { ...m, id: nextId.current++ } as Msg]);

  async function ask(raw: string, isRetry = false) {
    const query = raw.trim().slice(0, MAX_QUERY);
    if (!query || busy || off || !online) return;
    if (speech.listening) speech.stop();
    if (isRetry) setMsgs((cur) => cur.filter((m) => m.kind !== "error"));
    else push({ kind: "user", text: query });
    setText("");
    setBusy(true);
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      const res = await fetch("/api/help/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, locale: activeLocale }),
        signal: ctl.signal,
      });
      const body: unknown = await res.json().catch(() => null);
      if (isAnswer(body)) {
        const mode: HelpMode = body.mode ?? "guide";
        if (mode === "search") setSearchOnly(true);
        if (mode === "off") setOff(true);
        else
          push({
            kind: "bot",
            text: body.answer,
            sources: Array.isArray(body.sources) ? body.sources : [],
            links: Array.isArray(body.links) ? body.links.slice(0, 3) : [],
            related: Array.isArray(body.related) ? body.related.slice(0, 3) : [],
            mode,
          });
      } else push({ kind: "error", why: res.status === 429 ? "rate" : "error", query });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        push({ kind: "error", why: "error", query });
    } finally {
      setBusy(false);
    }
  }

  const toggleMic = () => {
    if (speech.listening) return speech.stop();
    baseRef.current = text.trim();
    speech.start();
  };

  const onFeedback = (id: number, fb: "up" | "down") =>
    setMsgs((cur) =>
      cur.map((m) =>
        m.id === id && m.kind === "bot" ? { ...m, fb: m.fb === fb ? undefined : fb } : m,
      ),
    );

  const canSend = text.trim().length > 0 && !busy && !off && online;
  const left = MAX_QUERY - text.length;
  const showChips = msgs.length === 0 && !off;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-(--ck-z-overlay) bg-overlay data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 sm:bg-transparent sm:backdrop-blur-0" />
        <DialogPrimitive.Content
          data-testid="help-panel"
          lang={activeLocale}
          onCloseAutoFocus={onCloseAutoFocus}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            field.current?.focus({ preventScroll: true });
          }}
          className={cn(
            "fixed z-(--ck-z-modal) flex flex-col overflow-hidden border border-border bg-surface text-fg shadow-4 outline-none print:hidden",
            "inset-x-0 bottom-0 h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] rounded-t-2xl border-b-0",
            "sm:inset-x-auto sm:right-5 sm:bottom-5 sm:h-[min(600px,calc(100dvh-2.5rem))] sm:w-[400px] sm:rounded-2xl sm:border-b",
            "duration-(--ck-motion-duration-md) ease-emphasized data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-6 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-10 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95",
          )}
        >
          {/* Header */}
          <header className="relative flex items-center gap-3 border-b border-border bg-linear-to-b from-accent-soft to-surface px-4 py-3">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg shadow-glow-soft"
            >
              <SparklesIcon className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="font-display text-h4 leading-tight">
                {t.title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="truncate text-caption text-fg-muted">
                {t.subtitle}
              </DialogPrimitive.Description>
            </div>
            {hindi ? (
              <div
                role="group"
                aria-label={t.language}
                className="flex shrink-0 rounded-full border border-border bg-surface p-0.5 text-caption"
              >
                {(["en", "hi"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    lang={l}
                    aria-pressed={activeLocale === l}
                    onClick={() => pickLocale(l)}
                    className="rounded-full px-2.5 py-1 font-medium text-fg-muted transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-accent aria-pressed:text-accent-fg"
                  >
                    {l === "en" ? "EN" : "हिं"}
                    <span className="sr-only">{l === "en" ? t.english : t.hindi}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <DialogPrimitive.Close
              aria-label={t.close}
              className="grid size-9 shrink-0 place-items-center rounded-full text-fg-muted transition-colors hover:bg-elevated hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <XIcon aria-hidden className="size-5" />
            </DialogPrimitive.Close>
          </header>

          {/* Thread */}
          <div
            ref={scroller}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label={t.title}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- keyboard-scrollable region
            tabIndex={0}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain scroll-smooth px-4 py-4 motion-reduce:scroll-auto focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
          >
            <div className="flex items-start gap-2.5">
              <Avatar />
              <p className="rounded-2xl rounded-tl-md border border-border bg-elevated px-3.5 py-2.5 text-body-sm">
                {t.greet[role]}
              </p>
            </div>

            {showChips ? (
              <div>
                <p className="mb-2 pl-9 text-overline text-fg-subtle uppercase">{t.suggested}</p>
                <ul className="flex flex-wrap gap-2 pl-9">
                  {suggestions[activeLocale].map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => void ask(s)}
                        disabled={!online}
                        className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-caption text-fg transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {msgs.map((m) =>
              m.kind === "user" ? (
                <div key={m.id} className="flex justify-end" data-testid="help-user-msg">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-body-sm break-words text-accent-fg">
                    <span className="sr-only">{t.you}: </span>
                    {m.text}
                  </p>
                </div>
              ) : m.kind === "bot" ? (
                <BotMessage
                  key={m.id}
                  m={m}
                  role={role}
                  t={t}
                  onFeedback={onFeedback}
                  onAsk={(q) => void ask(q)}
                  onNavigate={() => onOpenChange(false)}
                />
              ) : (
                <div
                  key={m.id}
                  role="alert"
                  className="flex items-start gap-2.5"
                  data-testid="help-error"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
                    <AlertCircleIcon aria-hidden className="size-4" />
                  </span>
                  <div className="rounded-2xl rounded-tl-md border border-danger/40 bg-danger-soft px-3.5 py-2.5 text-body-sm text-danger-fg">
                    <p>{m.why === "rate" ? t.rate : t.error}</p>
                    <button
                      type="button"
                      onClick={() => void ask(m.query, true)}
                      disabled={!online || busy}
                      className="mt-1.5 inline-flex items-center gap-1.5 text-caption font-semibold underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
                    >
                      <RotateCcwIcon aria-hidden className="size-3.5" />
                      {t.retry}
                    </button>
                  </div>
                </div>
              ),
            )}

            {busy ? <TypingDots label={t.typing} /> : null}
          </div>

          {/* Status banners */}
          {!online ? (
            <p
              role="status"
              data-testid="help-offline"
              className="flex items-center gap-2 border-t border-border bg-warning-soft px-4 py-2 text-caption text-warning-fg"
            >
              <WifiOffIcon aria-hidden className="size-4 shrink-0" />
              {t.offline}
            </p>
          ) : null}
          {searchOnly && !off ? (
            <p
              role="status"
              data-testid="help-search-only"
              className="flex items-start gap-2 border-t border-border bg-warning-soft px-4 py-2 text-caption text-warning-fg"
            >
              <InfoIcon aria-hidden className="mt-px size-4 shrink-0" />
              {t.searchOnly}
            </p>
          ) : null}
          {off ? (
            <p
              role="status"
              data-testid="help-off"
              className="flex items-center gap-2 border-t border-border bg-elevated px-4 py-2 text-caption text-fg-muted"
            >
              <InfoIcon aria-hidden className="size-4 shrink-0" />
              {t.off}
            </p>
          ) : null}
          {speech.error ? (
            <p
              role="alert"
              data-testid="help-mic-error"
              className="flex items-center gap-2 border-t border-border bg-danger-soft px-4 py-2 text-caption text-danger-fg"
            >
              <AlertCircleIcon aria-hidden className="size-4 shrink-0" />
              {speech.error === "denied" ? t.micDenied : t.micFail}
            </p>
          ) : null}

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(text);
            }}
            className="border-t border-border bg-surface px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            {speech.listening ? (
              <p
                role="status"
                data-testid="help-listening"
                className="mb-2 flex items-center gap-2.5 rounded-full bg-accent-soft px-3 py-1.5 text-caption font-medium text-accent-text"
              >
                <Waveform />
                {t.listening}
              </p>
            ) : null}
            <div
              className={cn(
                "flex items-end gap-1.5 rounded-2xl border bg-canvas p-1.5 transition-shadow focus-within:ring-2 focus-within:ring-ring",
                speech.listening ? "border-accent" : "border-border-strong",
              )}
            >
              <textarea
                ref={field}
                value={text}
                rows={1}
                maxLength={MAX_QUERY}
                disabled={off}
                onChange={(e) => setText(e.target.value.slice(0, MAX_QUERY))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void ask(text);
                  }
                }}
                aria-label={t.placeholder}
                aria-describedby="help-counter"
                placeholder={t.placeholder}
                enterKeyHint="send"
                className="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-2 text-body-sm text-fg placeholder:text-fg-muted focus:outline-none disabled:opacity-60"
              />
              {speech.supported ? (
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={off}
                  aria-pressed={speech.listening}
                  aria-label={speech.listening ? t.micStop : t.mic}
                  title={speech.listening ? t.micStop : t.mic}
                  data-testid="help-mic"
                  className={cn(
                    "relative grid size-9 shrink-0 place-items-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50",
                    speech.listening
                      ? "bg-accent text-accent-fg"
                      : "text-fg-muted hover:bg-elevated hover:text-fg",
                  )}
                >
                  {speech.listening ? (
                    <>
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-xl bg-accent motion-safe:animate-ping motion-safe:opacity-40"
                      />
                      <SquareIcon aria-hidden className="relative size-3.5 fill-current" />
                    </>
                  ) : (
                    <MicIcon aria-hidden className="size-[18px]" />
                  )}
                </button>
              ) : null}
              <button
                type="submit"
                disabled={!canSend}
                aria-label={t.send}
                title={t.send}
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg transition-[opacity,transform] hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none enabled:active:scale-95 disabled:opacity-40"
              >
                <ArrowUpIcon aria-hidden className="size-[18px]" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1 text-caption text-fg-muted">
              <span className="hidden sm:inline">{t.hint}</span>
              <span
                id="help-counter"
                data-testid="help-counter"
                className={cn(
                  "ml-auto tabular-nums",
                  left <= 30 && "font-semibold text-warning-fg",
                )}
              >
                {text.length}/{MAX_QUERY}
              </span>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
