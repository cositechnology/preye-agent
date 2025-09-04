import { loadConfig } from "./config.js";
import {
  buildContext,
  discoverImportNeighbors,
  loadNeighborSources,
} from "./context.js";
import { reviewWithLLM } from "./llm.js";
import { anthropicProvider } from "./providers/anthropic.js";
import { openaiProvider } from "./providers/openai.js";
import {
  fetchPrFiles,
  postSummaryComment,
  fetchPrMeta,
  fetchFileAtRef,
} from "./github.js";
import { runStaticRules } from "./lint.js";
import { publishInlineComments, publishReviewSummary } from "./publish.js";
import { buildProject, findSlicesAroundRanges } from "./tsgraph.js";
import { parseUnifiedDiffPatch, buildDiffMapping } from "./diff.js";
import { decide, formatDecision } from "./decision.js";
import type { Finding } from "./types.js";

export async function runReview(opts: {
  owner?: string;
  repo?: string;
  prNumber?: number;
  publish?: boolean;
  cwd?: string;
}) {
  const cfg = await loadConfig(opts.cwd);
  const provider =
    cfg.provider === "anthropic" ? anthropicProvider() : openaiProvider();
  if (cfg.provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }
  if (cfg.provider === "openai" && !process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  let files: { filename: string; patch?: string }[] = [];
  if (!(opts.owner && opts.repo && opts.prNumber)) {
    throw new Error("Provide owner, repo, prNumber to fetch the PR diff");
  }
  files = await fetchPrFiles({
    owner: opts.owner!,
    repo: opts.repo!,
    prNumber: opts.prNumber!,
  });

  const ctx = buildContext(files, cfg.additional_context);

  // Optional: enrich context with PR metadata and head file slices
  let prMetaNote = "";
  const extraContextNotes: string[] = [];
  try {
    if (cfg.context?.include_pr_meta || cfg.context?.include_head_slices) {
      const meta = await fetchPrMeta({
        owner: opts.owner!,
        repo: opts.repo!,
        prNumber: opts.prNumber!,
      });
      if (cfg.context?.include_pr_meta) {
        prMetaNote = [
          `# PR Overview`,
          `Title: ${meta.title}`,
          `Author: ${meta.author ?? "unknown"}`,
          ``,
          meta.body || "",
        ].join("\n");
        extraContextNotes.push(prMetaNote);
      }
      if (cfg.context?.include_head_slices) {
        const radius = cfg.context.head_slice_radius ?? 20;
        const maxFiles = cfg.context.max_context_files ?? 12;
        const maxChars = cfg.context.max_chars_per_file ?? 3000;
        const selected = files.slice(0, maxFiles);
        for (const f of selected) {
          if (!f.patch) continue;
          const head = await fetchFileAtRef({
            owner: opts.owner!,
            repo: opts.repo!,
            ref: meta.headSha,
            path: f.filename,
          });
          if (!head) continue;
          const lines = head.split(/\r?\n/);
          const hunks = parseUnifiedDiffPatch(f.patch);
          for (const h of hunks) {
            const start = Math.max(1, h.newStart - radius);
            const end = Math.min(
              lines.length,
              h.newStart + h.newLines - 1 + radius
            );
            const snippet = lines
              .slice(start - 1, end)
              .map(
                (t, idx) => `${(start + idx).toString().padStart(5, " ")}: ${t}`
              )
              .join("\n");
            let content = snippet;
            if (content.length > maxChars) content = content.slice(0, maxChars);
            extraContextNotes.push(
              `### Context: ${f.filename}:${start}-${end}\n\n\`\`\`ts\n${content}\n\`\`\``
            );
          }
        }
      }
    }
  } catch {}

  // Run ESLint pack on changed TS/TSX files
  const changedLocalPaths = files
    .map((f) => f.filename)
    .filter((p) => p.endsWith(".ts") || p.endsWith(".tsx"));

  // Discover neighbors to extend context across the codebase
  const neighbors = discoverImportNeighbors(changedLocalPaths);
  const neighborList = Array.from(new Set(Object.values(neighbors).flat()));
  const neighborSources = loadNeighborSources(neighborList, {
    maxFiles: 12,
    maxCharsPerFile: 3000,
  });

  // Build TS graph context slices - analyze the full files, not just diff lines
  let graphNotes: string[] = [];
  try {
    if (cfg.graph?.enabled) {
      const project = await buildProject();
      // For TS analysis, we want to analyze around ALL changed areas in the files
      // The TS graph will give us actual file line numbers
      const changedRanges = files
        .filter((f) => f.patch)
        .flatMap((f) => {
          const hunks = parseUnifiedDiffPatch(f.patch!);
          return hunks.map((hunk) => ({
            file: f.filename,
            startLine: hunk.newStart,
            endLine: hunk.newStart + hunk.newLines - 1,
          }));
        });
      const slices = findSlicesAroundRanges(project, changedRanges, {
        depth: cfg.graph.depth,
        maxFiles: cfg.graph.maxFiles,
        maxSlicesPerFile: cfg.graph.maxSlicesPerFile,
        maxCharsPerSlice: cfg.graph.maxCharsPerSlice,
      });
      graphNotes = slices.map(
        (s) =>
          `# Symbol slice: ${s.path}:${s.startLine}-${s.endLine}\n\n\`\`\`ts\n${s.content}\n\`\`\``
      );
    }
  } catch {
    // fallback silently
  }
  let staticFindings: Finding[] = [];
  try {
    const lintFindings = await runStaticRules(changedLocalPaths);
    staticFindings = lintFindings.map((l) => ({
      category: "Quality",
      file: l.file.replace(process.cwd() + "/", ""),
      startLine: l.startLine,
      endLine: l.endLine,
      summary: `${l.ruleId}: ${l.message}`,
      rationale: l.message,
      recommendation: "Refactor to comply with rule.",
      severity: l.severity === 2 ? "major" : "minor",
    }));
  } catch {}

  // For now, ONLY use the diff to avoid line number confusion
  // TODO: Re-add context once line numbers are accurate
  const llmFindings: Finding[] = await reviewWithLLM({
    provider,
    model: cfg.model,
    categories: cfg.categories,
    diffText: ctx.diffText,
    extraNotes: [...ctx.extraNotes, ...extraContextNotes],
  });

  const findings: Finding[] = [...staticFindings, ...llmFindings];
  const decision = decide(findings);
  const summary = summarize(findings) + "\n\n" + formatDecision(decision);
  if (cfg.publish || opts.publish) {
    await postSummaryComment({
      owner: opts.owner!,
      repo: opts.repo!,
      prNumber: opts.prNumber!,
      body: summary,
    });
    await publishReviewSummary({
      owner: opts.owner!,
      repo: opts.repo!,
      prNumber: opts.prNumber!,
      decision,
      summary,
    });
    await publishInlineComments({
      owner: opts.owner!,
      repo: opts.repo!,
      prNumber: opts.prNumber!,
      findings,
    });
  }

  return { findings, summary };
}

function summarize(findings: Finding[]): string {
  if (!findings.length) return "✅ No issues found.";
  const lines = [
    `## PR Review Summary`,
    ``,
    `Total findings: ${findings.length}`,
    ``,
    ...findings.map(
      (f) =>
        `- [${f.category}] (${f.severity}) ${f.file}:${f.startLine}-${f.endLine} — ${f.summary}`
    ),
    ``,
    `> Generated by ts-pr-reviewer`,
  ];
  return lines.join("\n");
}
