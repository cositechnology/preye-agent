import { Octokit } from "@octokit/rest";
import { nearestCommentableLine, getCommentableNewFileLines, } from "./diff.js";
export async function publishInlineComments(params) {
    const token = params.token ||
        process.env.GITHUB_TOKEN ||
        process.env.LGTM_GITHUB_TOKEN ||
        "";
    const octokit = new Octokit({ auth: token || undefined });
    // Get PR head SHA for inline comments
    const pr = await octokit.pulls.get({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.prNumber,
    });
    const headSha = pr.data.head.sha;
    // Build per-file commentable lines from patches queried via files list
    const files = await octokit.pulls.listFiles({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.prNumber,
        per_page: 100,
    });
    const fileToAllowed = new Map();
    for (const file of files.data) {
        // Get lines in the NEW file that can have comments
        const commentableLines = getCommentableNewFileLines(file.patch || "");
        fileToAllowed.set(file.filename, commentableLines);
    }
    for (const f of params.findings) {
        try {
            const allowed = fileToAllowed.get(f.file) || new Set();
            const desired = f.endLine || f.startLine || 1;
            const line = nearestCommentableLine(desired, allowed);
            if (!line)
                continue;
            await octokit.pulls.createReviewComment({
                owner: params.owner,
                repo: params.repo,
                pull_number: params.prNumber,
                commit_id: headSha,
                path: f.file,
                side: "RIGHT",
                line,
                body: `${f.summary}\n\nSeverity: ${f.severity}\n\n${f.rationale}\n\nRecommendation: ${f.recommendation}`,
            });
        }
        catch (error) {
            console.error(`Failed to post comment for ${f.file}:${f.startLine}:`, error);
        }
    }
}
export async function publishReviewSummary(params) {
    const token = params.token ||
        process.env.GITHUB_TOKEN ||
        process.env.LGTM_GITHUB_TOKEN ||
        "";
    const octokit = new Octokit({ auth: token || undefined });
    const event = params.decision.verdict === "Approved"
        ? "APPROVE"
        : params.decision.verdict === "Rejected"
            ? "REQUEST_CHANGES"
            : params.decision.verdict === "Changes Requested"
                ? "REQUEST_CHANGES"
                : "COMMENT";
    try {
        await octokit.pulls.createReview({
            owner: params.owner,
            repo: params.repo,
            pull_number: params.prNumber,
            body: params.summary,
            event: event,
        });
    }
    catch (error) {
        console.error("Failed to create review:", error.response?.data || error.message);
        // Fallback: post as regular comment instead
        await octokit.issues.createComment({
            owner: params.owner,
            repo: params.repo,
            issue_number: params.prNumber,
            body: `**Review Summary**\n\n${params.summary}`,
        });
    }
}
