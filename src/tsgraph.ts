import { Project, Node, SyntaxKind } from "ts-morph";
import fs from "node:fs";
import path from "node:path";

export type Slice = {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
};

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

function findTsconfig(cwd: string): string {
  const candidates = [
    "tsconfig.json",
    "packages/tsconfig.json",
    "apps/tsconfig.json",
  ];
  for (const c of candidates) {
    const p = path.join(cwd, c);
    if (fs.existsSync(p)) return p;
  }
  return path.join(cwd, "tsconfig.json");
}

export function findSlicesAroundRanges(
  project: Project,
  changed: { file: string; startLine: number; endLine: number }[],
  opts: {
    depth: number;
    maxFiles: number;
    maxSlicesPerFile: number;
    maxCharsPerSlice: number;
  }
): Slice[] {
  const byFile = new Map<string, { startLine: number; endLine: number }[]>();
  for (const c of changed) {
    const list = byFile.get(c.file) || [];
    list.push(c);
    byFile.set(c.file, list);
  }

  const slices: Slice[] = [];
  for (const [relPath, ranges] of byFile.entries()) {
    const sf =
      project.getSourceFile(relPath) ||
      project.getSourceFile(
        path.resolve(project.getDirectoryOrThrow("./").getPath(), relPath)
      );
    if (!sf) continue;
    let perFileCount = 0;
    for (const r of ranges) {
      const node = findEnclosingDeclaration(sf, r.startLine, r.endLine);
      if (!node) continue;
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
      if (perFileCount >= opts.maxSlicesPerFile) break;
    }
    if (slices.length >= opts.maxFiles) break;
  }
  return slices.slice(0, opts.maxFiles);
}

function findEnclosingDeclaration(sf: any, startLine: number, endLine: number) {
  const pos = sf.getPositionOfLineAndCharacter(Math.max(0, startLine - 1), 0);
  const node = sf.getDescendantAtPos(pos);
  if (!node) return undefined;
  const decl =
    node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ||
    node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration) ||
    node.getFirstAncestorByKind(SyntaxKind.ClassDeclaration) ||
    node.getFirstAncestorByKind(SyntaxKind.InterfaceDeclaration) ||
    node.getFirstAncestorByKind(SyntaxKind.TypeAliasDeclaration) ||
    node;
  return decl;
}

function getNodeLineSpan(node: any) {
  const sf = node.getSourceFile();
  const start = sf.getLineAndColumnAtPos(node.getStart()).line + 1; // ts-morph is 0-based, GitHub is 1-based
  const end = sf.getLineAndColumnAtPos(node.getEnd()).line + 1;
  return { startLine: start, endLine: end, start, end } as any;
}

function trimTo(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit);
}
