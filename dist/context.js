import { extractNewFileLinesWithText } from "./diff.js";
import fs from "node:fs";
import path from "node:path";
export function buildContext(files, additionalContext) {
    const diffText = files
        .map((f) => {
        const patch = f.patch || "";
        const numbered = extractNewFileLinesWithText(patch)
            .map((l) => `${l.line.toString().padStart(5, " ")}: ${l.text}`)
            .join("\n");
        return [
            `=== FILE: ${f.filename} ===`,
            patch,
            "",
            `--- New-file line numbers for ${f.filename} ---`,
            numbered,
        ].join("\n");
    })
        .join("\n\n");
    const extraNotes = (additionalContext || []).map((x) => `# ${x.prompt}\n${x.context || ""}`);
    return { diffText, files, extraNotes };
}
// Discover import neighbors for codebase-wide context (shallow graph)
export function discoverImportNeighbors(filePaths, cwd = process.cwd()) {
    const result = {};
    for (const rel of filePaths) {
        const abs = path.join(cwd, rel);
        if (!fs.existsSync(abs))
            continue;
        const src = fs.readFileSync(abs, "utf8");
        const deps = new Set();
        const importRegex = /import\s+[^'"\n]*from\s+['"]([^'"\n]+)['"];?|require\(['"]([^'"]+)['"]\)/g;
        let m;
        while ((m = importRegex.exec(src))) {
            const spec = m[1] || m[2];
            if (!spec)
                continue;
            if (spec.startsWith(".")) {
                const resolvedTs = tryResolveTs(abs, spec);
                if (resolvedTs)
                    deps.add(path.relative(cwd, resolvedTs));
            }
        }
        result[rel] = Array.from(deps);
    }
    return result;
}
function tryResolveTs(fromAbs, spec) {
    const base = path.resolve(path.dirname(fromAbs), spec);
    const candidates = [
        base + ".ts",
        base + ".tsx",
        base + "/index.ts",
        base + "/index.tsx",
    ];
    for (const c of candidates)
        if (fs.existsSync(c))
            return c;
    return null;
}
export function loadNeighborSources(neighborPaths, opts) {
    const cwd = opts?.cwd || process.cwd();
    const maxFiles = opts?.maxFiles ?? 10;
    const maxChars = opts?.maxCharsPerFile ?? 4000;
    const picked = neighborPaths.slice(0, maxFiles);
    const out = [];
    for (const rel of picked) {
        try {
            const abs = path.join(cwd, rel);
            if (!fs.existsSync(abs))
                continue;
            let content = fs.readFileSync(abs, "utf8");
            if (content.length > maxChars)
                content = content.slice(0, maxChars);
            out.push({ path: rel, content });
        }
        catch {
            // ignore file read errors
        }
    }
    return out;
}
