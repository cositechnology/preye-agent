import { ensureFindings } from "./providers/index.js";
export async function reviewWithLLM(opts) {
    const system = [
        "You are a precise senior code reviewer.",
        'Return STRICT JSON with shape: { "findings": Finding[] }',
        "Finding: { category, file, startLine, endLine, summary, rationale, recommendation, severity }",
        'Only report concrete, actionable issues. If none, return {"findings":[]}',
    ].join(" ");
    const user = [
        `Categories to evaluate: ${opts.categories.join(", ")}.`,
        "Here are additional guidelines (if any):",
        ...opts.extraNotes,
        "Here is the unified diff of the PR:",
        "```diff",
        opts.diffText,
        "```",
        "CRITICAL INSTRUCTION FOR LINE NUMBERS:",
        "- Look at the diff hunk headers like '@@ -10,5 +20,8 @@'",
        "- The number after the + (e.g., 20) is where the NEW file lines start",
        "- Count line by line from that starting point",
        "- Added lines (starting with +) and context lines (starting with space) are in the NEW file",
        "- Removed lines (starting with -) are NOT in the new file",
        "- Report the EXACT line numbers as they would appear in the NEW file",
        "When unsure about line numbers, skip the finding. Accuracy is critical.",
    ].join("\n\n");
    const { json } = await opts.provider.completeJSON({
        system,
        messages: [{ role: "user", content: user }],
        model: opts.model,
    });
    const findings = ensureFindings(json?.findings ?? []);
    return findings;
}
