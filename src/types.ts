export type Category = "Quality" | "Correctness" | "Security";

export type Finding = {
  category: Category;
  file: string;
  startLine: number;
  endLine: number;
  summary: string;
  rationale: string;
  recommendation: string;
  severity: "info" | "minor" | "major" | "critical";
};

export type ReviewerConfig = {
  categories: Category[];
  include?: string[];
  exclude?: string[];
  provider: "anthropic" | "openai";
  model: string;
  publish?: boolean;
  additional_context?: { prompt: string; path?: string; context?: string }[];
  rules?: {
    packs?: string[];
    settings?: Record<string, unknown>;
  };
  graph?: {
    enabled: boolean;
    depth: number;
    maxFiles: number;
    maxSlicesPerFile: number;
    maxCharsPerSlice: number;
  };
  context?: {
    include_pr_meta?: boolean;
    include_head_slices?: boolean;
    head_slice_radius?: number;
    max_context_files?: number;
    max_chars_per_file?: number;
  };
};
