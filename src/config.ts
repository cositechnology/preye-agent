import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import { ReviewerConfig } from "./types.js";

const schema = z.object({
  categories: z
    .array(z.enum(["Quality", "Correctness", "Security"]))
    .default(["Quality", "Correctness", "Security"]),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  provider: z.enum(["anthropic", "openai"]),
  model: z.string(),
  publish: z.boolean().default(false),
  context: z
    .object({
      include_pr_meta: z.boolean().default(true),
      include_head_slices: z.boolean().default(true),
      head_slice_radius: z.number().int().min(5).max(120).default(20),
      max_context_files: z.number().int().min(1).max(50).default(12),
      max_chars_per_file: z.number().int().min(500).max(20000).default(3000),
    })
    .default({
      include_pr_meta: true,
      include_head_slices: true,
      head_slice_radius: 20,
      max_context_files: 12,
      max_chars_per_file: 3000,
    }),
  graph: z
    .object({
      enabled: z.boolean().default(true),
      depth: z.number().int().min(0).max(5).default(2),
      maxFiles: z.number().int().min(1).max(100).default(20),
      maxSlicesPerFile: z.number().int().min(1).max(20).default(4),
      maxCharsPerSlice: z.number().int().min(200).max(5000).default(1500),
    })
    .default({
      enabled: true,
      depth: 2,
      maxFiles: 20,
      maxSlicesPerFile: 4,
      maxCharsPerSlice: 1500,
    }),
  additional_context: z
    .array(
      z.object({
        prompt: z.string(),
        path: z.string().optional(),
        context: z.string().optional(),
      })
    )
    .optional(),
  rules: z
    .object({
      packs: z.array(z.string()).optional(),
      settings: z.record(z.unknown()).optional(),
    })
    .optional(),
});

function tryLoad(file: string): unknown | undefined {
  if (!fs.existsSync(file)) return undefined;
  const raw = fs.readFileSync(file, "utf8");
  if (file.endsWith(".json")) return JSON.parse(raw);
  if (file.endsWith(".yaml") || file.endsWith(".yml")) return yaml.load(raw);
  if (file.endsWith(".toml")) {
    throw new Error("TOML not supported in MVP. Use YAML or JSON.");
  }
  return undefined;
}

export async function loadConfig(cwd = process.cwd()): Promise<ReviewerConfig> {
  const localCandidates = [
    "reviewer.config.yaml",
    "reviewer.config.yml",
    "reviewer.config.json",
  ].map((f) => path.join(cwd, f));
  // Fallback: when running as a reusable workflow, the reviewer code is often
  // checked out into ./reviewer. Use its default config if the caller doesn't
  // provide one in its root.
  const fallbackDir = path.join(cwd, "reviewer");
  const fallbackCandidates = [
    "reviewer.config.yaml",
    "reviewer.config.yml",
    "reviewer.config.json",
  ].map((f) => path.join(fallbackDir, f));
  const candidates = [...localCandidates, ...fallbackCandidates];
  let data: unknown | undefined;
  for (const file of candidates) {
    data = tryLoad(file);
    if (data) break;
  }
  if (!data) throw new Error("Missing config. Create reviewer.config.yaml");
  const parsed = schema.parse(data);
  const hydrated = await Promise.all(
    (parsed.additional_context ?? []).map(async (item) => {
      if (item.path) {
        const p = path.join(cwd, item.path);
        const content = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
        return { ...item, context: content };
      }
      return item;
    })
  );
  return { ...parsed, additional_context: hydrated } as ReviewerConfig;
}
