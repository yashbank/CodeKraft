import { cn } from "@/components/ui/_utils";

/**
 * Renders sanitised Tiptap HTML (docs/08 §6.18 "Rich text"): body-lg on the site, links accent,
 * blockquote with a 3 px accent rule, code on canvas, tables with hairlines. The HTML is
 * sanitised server-side before it reaches this component (docs/07 §4.7) — never user input.
 */
export function RichText({
  html,
  className,
  size = "lg",
}: {
  html: string;
  className?: string;
  size?: "lg" | "md";
}) {
  return (
    <div
      className={cn(
        "text-fg-muted [&_a]:text-accent-text [&_a]:underline-offset-2 [&_a:hover]:underline",
        size === "lg" ? "text-body-lg" : "text-body",
        "[&>*+*]:mt-5 [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-h2 [&_h2]:text-fg [&_h2]:scroll-mt-24 [&_h3]:mt-8 [&_h3]:font-display [&_h3]:text-h3 [&_h3]:text-fg [&_h3]:scroll-mt-24",
        "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li+li]:mt-2 [&_strong]:text-fg",
        "[&_blockquote]:border-l-[3px] [&_blockquote]:border-accent [&_blockquote]:pl-5 [&_blockquote]:text-pullquote [&_blockquote]:text-fg [&_blockquote]:italic",
        "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-canvas [&_pre]:p-4 [&_pre]:text-mono [&_pre]:text-fg [&_code]:font-mono [&_:not(pre)>code]:rounded-xs [&_:not(pre)>code]:bg-elevated [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:text-body-sm",
        "[&_table]:w-full [&_table]:border-collapse [&_table]:text-body [&_th]:border-b [&_th]:border-border-strong [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-overline [&_th]:text-fg-muted [&_th]:uppercase [&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
        "[&_img]:rounded-md [&_figcaption]:text-caption [&_figcaption]:text-fg-subtle",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
