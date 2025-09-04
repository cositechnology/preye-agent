// Map new-file line numbers to GitHub diff positions
// removed position mapping (revert to line/side approach)
// Parses a unified diff patch and returns hunks with commentable new-file line numbers
export function parseUnifiedDiffPatch(patch) {
    const lines = (patch || "").split(/\r?\n/);
    const hunks = [];
    let current = null;
    let newLine = 0;
    let oldLine = 0;
    for (const line of lines) {
        const hunkHeader = /^@@ \-(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
        if (hunkHeader) {
            const oldStart = parseInt(hunkHeader[1], 10);
            const oldCount = hunkHeader[2] ? parseInt(hunkHeader[2], 10) : 1;
            const newStart = parseInt(hunkHeader[3], 10);
            const newCount = hunkHeader[4] ? parseInt(hunkHeader[4], 10) : 1;
            current = {
                oldStart,
                oldLines: oldCount,
                newStart,
                newLines: newCount,
                commentableNewLines: new Set(),
            };
            hunks.push(current);
            newLine = newStart;
            oldLine = oldStart;
            continue;
        }
        if (!current)
            continue;
        if (line.startsWith("+")) {
            current.commentableNewLines.add(newLine);
            newLine += 1;
        }
        else if (line.startsWith(" ")) {
            // context lines within hunk are also commentable on RIGHT side
            current.commentableNewLines.add(newLine);
            newLine += 1;
            oldLine += 1;
        }
        else if (line.startsWith("-")) {
            // deletion: advances old file, not new
            oldLine += 1;
        }
        else {
            // other lines do not affect counters
        }
    }
    return hunks;
}
// This function tells us which lines in the NEW file are commentable in GitHub
export function buildDiffMapping(patch) {
    const lines = (patch || "").split(/\r?\n/);
    const mapping = {
        newLineToOldLine: new Map(),
        oldLineToNewLine: new Map(),
        addedLines: new Set(),
        removedLines: new Set(),
    };
    let newFileLineNumber = 0;
    let oldFileLineNumber = 0;
    let inHunk = false;
    for (const line of lines) {
        const hunkHeader = /^@@ \-(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
        if (hunkHeader) {
            // These are actual file line numbers where this hunk starts
            oldFileLineNumber = parseInt(hunkHeader[1], 10);
            newFileLineNumber = parseInt(hunkHeader[3], 10);
            inHunk = true;
            continue;
        }
        if (!inHunk)
            continue;
        if (line.startsWith("+")) {
            // Added line - exists in new file, commentable
            mapping.addedLines.add(newFileLineNumber);
            newFileLineNumber += 1;
        }
        else if (line.startsWith(" ")) {
            // Context line - exists in both files, commentable
            mapping.newLineToOldLine.set(newFileLineNumber, oldFileLineNumber);
            mapping.oldLineToNewLine.set(oldFileLineNumber, newFileLineNumber);
            newFileLineNumber += 1;
            oldFileLineNumber += 1;
        }
        else if (line.startsWith("-")) {
            // Removed line - only in old file, not commentable on RIGHT side
            mapping.removedLines.add(oldFileLineNumber);
            oldFileLineNumber += 1;
        }
    }
    return mapping;
}
// Get all line numbers in the NEW file that can have comments
export function getCommentableNewFileLines(patch) {
    const mapping = buildDiffMapping(patch);
    const commentableLines = new Set();
    // Added lines are commentable
    for (const line of mapping.addedLines) {
        commentableLines.add(line);
    }
    // Context lines (unchanged) are commentable
    for (const [newLine] of mapping.newLineToOldLine) {
        commentableLines.add(newLine);
    }
    return commentableLines;
}
// Extract the text of lines that exist in the NEW file, with their new-file line numbers
export function extractNewFileLinesWithText(patch) {
    const lines = (patch || "").split(/\r?\n/);
    const out = [];
    let newFileLineNumber = 0;
    let inHunk = false;
    for (const raw of lines) {
        const hunkHeader = /^@@ \-(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(raw);
        if (hunkHeader) {
            newFileLineNumber = parseInt(hunkHeader[3], 10);
            inHunk = true;
            continue;
        }
        if (!inHunk)
            continue;
        if (raw.startsWith("+")) {
            out.push({ line: newFileLineNumber, text: raw.slice(1) });
            newFileLineNumber += 1;
        }
        else if (raw.startsWith(" ")) {
            out.push({ line: newFileLineNumber, text: raw.slice(1) });
            newFileLineNumber += 1;
        }
        else if (raw.startsWith("-")) {
            // old-file only; skip and do not increment new-file counter
        }
    }
    return out;
}
export function buildCommentableLineSet(patch) {
    const hunks = parseUnifiedDiffPatch(patch);
    const set = new Set();
    for (const h of hunks) {
        for (const ln of h.commentableNewLines)
            set.add(ln);
    }
    return set;
}
export function nearestCommentableLine(desired, allowed) {
    if (allowed.has(desired))
        return desired;
    let delta = 1;
    while (delta < 2000) {
        if (allowed.has(desired - delta))
            return desired - delta;
        if (allowed.has(desired + delta))
            return desired + delta;
        delta += 1;
    }
    return null;
}
