import { ESLint } from "eslint";
export async function runStaticRules(filePaths) {
    const eslint = new ESLint({
        overrideConfig: {
            languageOptions: {
                parser: require("@typescript-eslint/parser"),
                ecmaVersion: 2022,
                sourceType: "module",
                parserOptions: { ecmaFeatures: { jsx: true } },
            },
            plugins: {},
            rules: {},
        },
    });
    const results = await eslint.lintFiles(filePaths);
    const findings = [];
    for (const r of results) {
        for (const m of r.messages) {
            findings.push({
                file: r.filePath,
                startLine: m.line || 1,
                endLine: m.endLine || m.line || 1,
                ruleId: m.ruleId || "unknown",
                message: m.message,
                severity: m.severity || 1,
            });
        }
    }
    return findings;
}
