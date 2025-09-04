import { ESLint } from "eslint";
import path from "node:path";

export type LintFinding = {
  file: string;
  startLine: number;
  endLine: number;
  ruleId: string;
  message: string;
  severity: 1 | 2;
};

export async function runStaticRules(
  filePaths: string[]
): Promise<LintFinding[]> {
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
  const findings: LintFinding[] = [];
  for (const r of results) {
    for (const m of r.messages) {
      findings.push({
        file: r.filePath,
        startLine: m.line || 1,
        endLine: m.endLine || m.line || 1,
        ruleId: m.ruleId || "unknown",
        message: m.message,
        severity: (m.severity as 1 | 2) || 1,
      });
    }
  }
  return findings;
}
