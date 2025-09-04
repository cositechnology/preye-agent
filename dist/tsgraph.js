import { Project, SyntaxKind } from "ts-morph";
import fs from "node:fs";
import path from "node:path";
export async function buildProject(cwd = process.cwd()) {
    const tsconfigPath = findTsconfig(cwd);
    const project = new Project({
        tsConfigFilePath: tsconfigPath,
        skipAddingFilesFromTsConfig: false,
    });
    // Load source files
    project.getSourceFiles();
    return project;
}
function findTsconfig(cwd) {
    const candidates = [
        "tsconfig.json",
        "packages/tsconfig.json",
        "apps/tsconfig.json",
    ];
    for (const c of candidates) {
        const p = path.join(cwd, c);
        if (fs.existsSync(p))
            return p;
    }
    return path.join(cwd, "tsconfig.json");
}
export function findSlicesAroundRanges(project, changed, opts) {
    const byFile = new Map();
    for (const c of changed) {
        const list = byFile.get(c.file) || [];
        list.push(c);
        byFile.set(c.file, list);
    }
    const slices = [];
    for (const [relPath, ranges] of byFile.entries()) {
        const sf = project.getSourceFile(relPath) ||
            project.getSourceFile(path.resolve(project.getDirectoryOrThrow("./").getPath(), relPath));
        if (!sf)
            continue;
        let perFileCount = 0;
        for (const r of ranges) {
            const node = findEnclosingDeclaration(sf, r.startLine, r.endLine);
            if (!node)
                continue;
            const { start, end } = getNodeLineSpan(node);
            const text = node
                .getSourceFile()
                .getFullText()
                .slice(node.getStart(), node.getEnd());
            slices.push({
                path: relPath,
                startLine: start,
                endLine: end,
                content: trimTo(text, opts.maxCharsPerSlice),
            });
            perFileCount += 1;
            if (perFileCount >= opts.maxSlicesPerFile)
                break;
        }
        if (slices.length >= opts.maxFiles)
            break;
    }
    return slices.slice(0, opts.maxFiles);
}
function findEnclosingDeclaration(sf, startLine, endLine) {
    const pos = sf.getPositionOfLineAndCharacter(Math.max(0, startLine - 1), 0);
    const node = sf.getDescendantAtPos(pos);
    if (!node)
        return undefined;
    const decl = node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ||
        node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration) ||
        node.getFirstAncestorByKind(SyntaxKind.ClassDeclaration) ||
        node.getFirstAncestorByKind(SyntaxKind.InterfaceDeclaration) ||
        node.getFirstAncestorByKind(SyntaxKind.TypeAliasDeclaration) ||
        node;
    return decl;
}
function getNodeLineSpan(node) {
    const sf = node.getSourceFile();
    const start = sf.getLineAndColumnAtPos(node.getStart()).line + 1; // ts-morph is 0-based, GitHub is 1-based
    const end = sf.getLineAndColumnAtPos(node.getEnd()).line + 1;
    return { startLine: start, endLine: end, start, end };
}
function trimTo(text, limit) {
    if (text.length <= limit)
        return text;
    return text.slice(0, limit);
}
