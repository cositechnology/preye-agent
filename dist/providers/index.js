export function ensureFindings(obj) {
    if (!Array.isArray(obj))
        return [];
    return obj
        .map((x) => {
        const f = x;
        if (!f.file || !f.summary || !f.category)
            return undefined;
        return {
            category: f.category,
            file: f.file,
            startLine: f.startLine ?? 1,
            endLine: f.endLine ?? f.startLine ?? 1,
            summary: f.summary,
            rationale: f.rationale ?? "",
            recommendation: f.recommendation ?? "",
            severity: normalizeSeverity(f.severity) ?? "minor",
        };
    })
        .filter(Boolean);
}
function normalizeSeverity(sev) {
    if (typeof sev !== "string")
        return "minor";
    const lower = sev.toLowerCase();
    if (lower === "critical" || lower === "high")
        return "critical";
    if (lower === "major" || lower === "medium")
        return "major";
    if (lower === "minor" || lower === "low")
        return "minor";
    if (lower === "info")
        return "info";
    return "minor";
}
