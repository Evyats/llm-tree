import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
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
        rehypePlugins={highlightPlugin ? [highlightPlugin] : []}
        components={{
          p: ({ children }) => <p className="my-0">{children}</p>,
          ul: ({ children }) => <ul className="my-0 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-0 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          code: ({ children }) => (
            <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.92em] text-stone-800">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="my-1 overflow-x-auto rounded-md bg-stone-100 p-2 font-mono text-[0.9em] text-stone-800">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline decoration-accent/60 underline-offset-2"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-1 border-l-2 border-stone-300 pl-3 text-stone-700">{children}</blockquote>
          ),
        }}
      >
        {normalizedText}
      </ReactMarkdown>
    </div>
  );
}
