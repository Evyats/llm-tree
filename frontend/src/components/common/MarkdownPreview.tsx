import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { normalizeMarkdownText } from "../../features/markdown/normalize";

interface MarkdownPreviewProps {
  text: string;
  highlights?: Array<string | { text: string; occurrence: number }>;
  className?: string;
}

export default function MarkdownPreview({ text, highlights, className }: MarkdownPreviewProps) {
  const normalizedText = normalizeMarkdownText(text);
  const highlightPlugin = useMemo(() => {
    const normalizedTargets = (highlights ?? [])
      .map((item) => (typeof item === "string" ? { text: item.trim() } : { text: item.text.trim(), occurrence: item.occurrence }))
      .filter((item) => item.text.length > 0);
    if (normalizedTargets.length === 0) return null;

    const targetLookup = new Map<string, { all: boolean; occurrences: Set<number> }>();
    for (const target of normalizedTargets) {
      const current = targetLookup.get(target.text) ?? { all: false, occurrences: new Set<number>() };
      if (typeof target.occurrence === "number") {
        current.occurrences.add(target.occurrence);
      } else {
        current.all = true;
      }
      targetLookup.set(target.text, current);
    }
    const targetEntries = Array.from(targetLookup.entries()).sort((a, b) => b[0].length - a[0].length);
    const toHighlightedChildren = (value: string, counters: Map<string, number>) => {
      const candidates: Array<{ start: number; end: number; text: string }> = [];
      for (const [targetText, rule] of targetEntries) {
        let cursor = 0;
        while (cursor <= value.length - targetText.length) {
          const found = value.indexOf(targetText, cursor);
          if (found < 0) break;
          const seen = counters.get(targetText) ?? 0;
          counters.set(targetText, seen + 1);
          if (rule.all || rule.occurrences.has(seen)) {
            candidates.push({ start: found, end: found + targetText.length, text: targetText });
          }
          cursor = found + targetText.length;
        }
      }
      const result: Array<{ type: string; value?: string; tagName?: string; properties?: object; children?: unknown[] }> = [];
      if (candidates.length === 0) {
        return [{ type: "text", value }];
      }

      const boundaries = new Set<number>([0, value.length]);
      for (const candidate of candidates) {
        boundaries.add(candidate.start);
        boundaries.add(candidate.end);
      }
      const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);

      for (let i = 0; i < sortedBoundaries.length - 1; i += 1) {
        const start = sortedBoundaries[i];
        const end = sortedBoundaries[i + 1];
        if (end <= start) continue;
        const slice = value.slice(start, end);
        if (!slice) continue;

        const overlapDepth = candidates.reduce((count, candidate) => {
          return candidate.start <= start && candidate.end >= end ? count + 1 : count;
        }, 0);

        if (overlapDepth === 0) {
          result.push({ type: "text", value: slice });
          continue;
        }

        const highlightClassName =
          overlapDepth >= 3
            ? ["rounded", "bg-amber-400", "px-0.5"]
            : overlapDepth === 2
              ? ["rounded", "bg-amber-300/90", "px-0.5"]
              : ["rounded", "bg-amber-200/75", "px-0.5"];

        result.push({
          type: "element",
          tagName: "mark",
          properties: { className: highlightClassName },
          children: [{ type: "text", value: slice }],
        });
      }

      return result;
    };

    const walk = (node: any, inCode: boolean, counters: Map<string, number>) => {
      if (!node || !Array.isArray(node.children)) return;
      const nextChildren: any[] = [];
      for (const child of node.children) {
        if (child?.type === "text" && !inCode && typeof child.value === "string") {
          nextChildren.push(...toHighlightedChildren(child.value, counters));
          continue;
        }
        if (child?.type === "element") {
          const tag = String(child.tagName ?? "");
          walk(child, inCode || tag === "code" || tag === "pre", counters);
        }
        nextChildren.push(child);
      }
      node.children = nextChildren;
    };

    return () => (tree: any) => {
      const counters = new Map<string, number>();
      walk(tree, false, counters);
    };
  }, [highlights]);

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={highlightPlugin ? [highlightPlugin] : []}
        components={{
          h1: ({ children }) => <h1 className="my-1 text-lg font-semibold leading-snug text-inherit">{children}</h1>,
          h2: ({ children }) => <h2 className="my-1 text-base font-semibold leading-snug text-inherit">{children}</h2>,
          h3: ({ children }) => <h3 className="my-1 text-sm font-semibold leading-snug text-inherit">{children}</h3>,
          h4: ({ children }) => <h4 className="my-1 text-sm font-medium leading-snug text-inherit">{children}</h4>,
          h5: ({ children }) => <h5 className="my-1 text-xs font-medium uppercase tracking-wide text-inherit">{children}</h5>,
          h6: ({ children }) => <h6 className="my-1 text-xs font-medium uppercase tracking-wide text-inherit">{children}</h6>,
          p: ({ children }) => <p className="my-0">{children}</p>,
          ul: ({ children }) => <ul className="my-0 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-0 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          table: ({ children }) => (
            <div className="my-1 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-stone-100">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-stone-200 last:border-b-0">{children}</tr>,
          th: ({ children }) => <th className="border border-stone-200 px-2 py-1 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-stone-200 px-2 py-1 align-top">{children}</td>,
          code: ({ children }) => (
            <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.92em] text-inherit">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="my-1 overflow-x-auto rounded-md bg-stone-100 p-2 font-mono text-[0.9em] text-inherit">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-inherit underline underline-offset-2"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-1 border-l-2 border-stone-300 pl-3 text-inherit">{children}</blockquote>
          ),
        }}
      >
        {normalizedText}
      </ReactMarkdown>
    </div>
  );
}
