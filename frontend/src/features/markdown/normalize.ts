export function normalizeMarkdownText(input: string): string {
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

