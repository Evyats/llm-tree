import { useMemo } from "react";
import ReactMarkdown from "react-markdown";

interface MarkdownPreviewProps {
  text: string;
  highlights?: string[];
  className?: string;
}

function normalizeMarkdownText(input: string): string {
  const normalizedLines = input.replace(/\r\n/g, "\n").split("\n").map((line) => {
    const matches = line.match(/\*\*/g) ?? [];
    if (matches.length % 2 === 1) {
      const last = line.lastIndexOf("**");
      if (last >= 0) {
        return `${line.slice(0, last)}${line.slice(last + 2)}`;
      }
    }
    return line;
  });
  const compacted = normalizedLines.join("\n").replace(/\n{3,}/g, "\n\n");
  // Avoid exaggerated vertical gaps around markdown lists.
  const lines = compacted.split("\n");
  const isListLine = (value: string) => /^(\s*[-*+]\s+|\s*\d+\.\s+)/.test(value);
  const nextNonEmpty = (start: number) => {
    for (let i = start; i < lines.length; i += 1) {
      if (lines[i].trim().length > 0) return lines[i];
    }
    return "";
  };
  const output: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i];
    if (current.trim().length !== 0) {
      output.push(current);
      continue;
    }
    const prev = output.length > 0 ? output[output.length - 1] : "";
    const next = nextNonEmpty(i + 1);
    if (isListLine(prev) || isListLine(next)) {
      continue;
    }
    if (output.length > 0 && output[output.length - 1].trim().length === 0) {
      continue;
    }
    output.push("");
  }
  return output.join("\n");
}

export default function MarkdownPreview({ text, highlights, className }: MarkdownPreviewProps) {
  const normalizedText = normalizeMarkdownText(text);
  const highlightPlugin = useMemo(() => {
    const targets = (highlights ?? [])
      .map((item) => item.trim())
      .filter((item, index, arr) => item.length > 0 && arr.indexOf(item) === index)
      .sort((a, b) => b.length - a.length);
    if (targets.length === 0) return null;

    const toHighlightedChildren = (value: string) => {
      const result: Array<{ type: string; value?: string; tagName?: string; properties?: object; children?: unknown[] }> = [];
      let cursor = 0;
      while (cursor < value.length) {
        let bestIndex = -1;
        let bestTarget = "";
        for (const target of targets) {
          const found = value.indexOf(target, cursor);
          if (found === -1) continue;
          if (bestIndex === -1 || found < bestIndex || (found === bestIndex && target.length > bestTarget.length)) {
            bestIndex = found;
            bestTarget = target;
          }
        }
        if (bestIndex === -1) {
          result.push({ type: "text", value: value.slice(cursor) });
          break;
        }
        if (bestIndex > cursor) {
          result.push({ type: "text", value: value.slice(cursor, bestIndex) });
        }
        result.push({
          type: "element",
          tagName: "mark",
          properties: { className: ["rounded", "bg-amber-200/75", "px-0.5"] },
          children: [{ type: "text", value: bestTarget }],
        });
        cursor = bestIndex + bestTarget.length;
      }
      return result;
    };

    const walk = (node: any, inCode: boolean) => {
      if (!node || !Array.isArray(node.children)) return;
      const nextChildren: any[] = [];
      for (const child of node.children) {
        if (child?.type === "text" && !inCode && typeof child.value === "string") {
          nextChildren.push(...toHighlightedChildren(child.value));
          continue;
        }
        if (child?.type === "element") {
          const tag = String(child.tagName ?? "");
          walk(child, inCode || tag === "code" || tag === "pre");
        }
        nextChildren.push(child);
      }
      node.children = nextChildren;
    };

    return () => (tree: any) => {
      walk(tree, false);
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
