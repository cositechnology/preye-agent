import { Server } from "@modelcontextprotocol/sdk";
import { z } from "zod";
import { Octokit } from "@octokit/rest";
function getOctokit() {
    const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN || "";
    return new Octokit({ auth: token || undefined });
}
const server = new Server({ name: "ts-pr-reviewer-mcp", version: "0.1.0" });
const prInput = z.object({ owner: z.string(), repo: z.string(), number: z.number() });
server.tool("getPullRequest", {
    inputSchema: prInput,
    async handler({ input }) {
        const o = getOctokit();
        const pr = await o.pulls.get({ owner: input.owner, repo: input.repo, pull_number: input.number });
        return { ok: true, value: pr.data };
    }
});
server.tool("listChangedFiles", {
    inputSchema: prInput,
    async handler({ input }) {
        const o = getOctokit();
        const files = await o.pulls.listFiles({ owner: input.owner, repo: input.repo, pull_number: input.number, per_page: 100 });
        return { ok: true, value: files.data };
    }
});
server.tool("getFile", {
    inputSchema: prInput.extend({ path: z.string(), ref: z.string() }),
    async handler({ input }) {
        const o = getOctokit();
        const res = await o.repos.getContent({ owner: input.owner, repo: input.repo, path: input.path, ref: input.ref });
        if (!Array.isArray(res.data) && res.data.content) {
            const buff = Buffer.from(res.data.content, res.data.encoding || "base64");
            return { ok: true, value: buff.toString("utf8") };
        }
        return { ok: true, value: "" };
    }
});
server.tool("postReview", {
    inputSchema: prInput.extend({
        comments: z.array(z.object({ path: z.string(), body: z.string(), line: z.number().optional(), side: z.enum(["RIGHT", "LEFT"]).optional() })).default([]),
        summary: z.string().default("")
    }),
    async handler({ input }) {
        const o = getOctokit();
        if (input.comments.length) {
            const pr = await o.pulls.get({ owner: input.owner, repo: input.repo, pull_number: input.number });
            for (const c of input.comments) {
                try {
                    await o.pulls.createReviewComment({ owner: input.owner, repo: input.repo, pull_number: input.number, commit_id: pr.data.head.sha, path: c.path, side: c.side || "RIGHT", line: c.line || 1, body: c.body });
                }
                catch { }
            }
        }
        if (input.summary) {
            await o.issues.createComment({ owner: input.owner, repo: input.repo, issue_number: input.number, body: input.summary });
        }
        return { ok: true, value: "posted" };
    }
});
export function startMcpServer() {
    server.connectStdio();
}
if (process.argv[1] && process.argv[1].endsWith("server.js")) {
    startMcpServer();
}
