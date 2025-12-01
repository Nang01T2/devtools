// src/lib/diff-worker.ts
import { compareTexts, stats } from "./diff";

export type DiffWorkerInput = {
  input1: string;
  input2: string;
  mode: "characters" | "words" | "lines";
};

export type DiffWorkerOutput = {
  resultDiff: ReturnType<typeof compareTexts>;
  diffStats: ReturnType<typeof stats>;
  unifiedDiff: string;
};


const generateUnifiedDiff = (input1: string, input2: string): string => {
  const diffs = compareTexts(input1, input2, "lines");

  let result = "";
  let lineNum1 = 0;
  let lineNum2 = 0;
  let hunk: string[] = [];
  let hunkStart1 = 0;
  let hunkStart2 = 0;
  const context = 3;

  const flush = () => {
    if (hunk.length === 0) return;
    const del = hunk.filter((l) => l[0] === "-").length;
    const add = hunk.filter((l) => l[0] === "+").length;
    const ctx = hunk.length - del - add;
    result += `@@ -${hunkStart1 + 1},${ctx + del || 1} +${hunkStart2 + 1},${
      ctx + add || 1
    } @@\n`;
    result += hunk.join("\n") + "\n\n";
    hunk = [];
  };

  for (const d of diffs) {
    const lines = d.text.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();

    for (const line of lines) {
      if (d.operation === "equal") {
        if (hunk.length > context * 2 + 20) {
          while (hunk.length > context + 5 && hunk[0][0] === " ") {
            hunk.shift();
            hunkStart1++;
            hunkStart2++;
          }
          flush();
        }
        if (hunk.length === 0) {
          hunkStart1 = lineNum1;
          hunkStart2 = lineNum2;
        }
        hunk.push(" " + line);
        lineNum1++;
        lineNum2++;
      } else if (d.operation === "delete") {
        if (hunk.length === 0) {
          hunkStart1 = lineNum1;
          hunkStart2 = lineNum2;
        }
        hunk.push("-" + line);
        lineNum1++;
      } else if (d.operation === "insert") {
        if (hunk.length === 0) {
          hunkStart1 = lineNum1;
          hunkStart2 = lineNum2;
        }
        hunk.push("+" + line);
        lineNum2++;
      }
    }
  }
  if (hunk.length > 0) flush();
  return result.trim() || "No changes\n";
};

self.onmessage = (e: MessageEvent<DiffWorkerInput>) => {
  const { input1, input2, mode } = e.data;

  try {
    const resultDiff = compareTexts(input1, input2, mode);
    const diffStats = stats(resultDiff, mode);
    const unifiedDiff = generateUnifiedDiff(input1, input2);

    self.postMessage({
      resultDiff,
      diffStats,
      unifiedDiff,
    } satisfies DiffWorkerOutput);
  } catch (err) {
    self.postMessage({ error: (err as Error).message });
  }
};