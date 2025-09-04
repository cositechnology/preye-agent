import type { Finding } from "../types.js";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export interface LlmProvider {
  name: "anthropic" | "openai";
  completeJSON(input: {
    system: string;
    messages: ChatMessage[];
    model: string;
  }): Promise<{
    json: unknown;
    tokenUsage?: { input: number; output: number };
  }>;
}

export function ensureFindings(obj: unknown): Finding[] {
  if (!Array.isArray(obj)) return [];
  return obj
    .map((x) => {
      const f = x as Partial<Finding>;
      if (!f.file || !f.summary || !f.category) return undefined;
      return {
        category: f.category,
        file: f.file,
        startLine: f.startLine ?? 1,
        endLine: f.endLine ?? f.startLine ?? 1,
        summary: f.summary,
        rationale: f.rationale ?? "",
        recommendation: f.recommendation ?? "",
        severity: normalizeSeverity(f.severity) ?? "minor",
      } as Finding;
    })
    .filter(Boolean) as Finding[];
}

function normalizeSeverity(sev: any): Finding["severity"] {
  if (typeof sev !== "string") return "minor";
  const lower = sev.toLowerCase();
  if (lower === "critical" || lower === "high") return "critical";
  if (lower === "major" || lower === "medium") return "major";
  if (lower === "minor" || lower === "low") return "minor";
  if (lower === "info") return "info";
  return "minor";
}
