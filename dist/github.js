import { Octokit } from "@octokit/rest";
export async function fetchPrFiles(params) {
    const token = params.token ||
        process.env.GITHUB_TOKEN ||
        process.env.LGTM_GITHUB_TOKEN ||
        "";
    const octokit = new Octokit({ auth: token || undefined });
    const files = await octokit.pulls.listFiles({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.prNumber,
        per_page: 100,
    });
    return files.data.map((f) => ({
        filename: f.filename,
        patch: f.patch || "",
    }));
}
export async function fetchPrMeta(params) {
    const token = params.token ||
        process.env.GITHUB_TOKEN ||
        process.env.LGTM_GITHUB_TOKEN ||
        "";
    const octokit = new Octokit({ auth: token || undefined });
    const pr = await octokit.pulls.get({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.prNumber,
    });
    return {
        title: pr.data.title || "",
        body: pr.data.body || "",
        headSha: pr.data.head.sha,
        baseSha: pr.data.base.sha,
        author: pr.data.user?.login,
    };
}
export async function fetchFileAtRef(params) {
    const token = params.token ||
        process.env.GITHUB_TOKEN ||
        process.env.LGTM_GITHUB_TOKEN ||
        "";
    const octokit = new Octokit({ auth: token || undefined });
    try {
        const res = await octokit.repos.getContent({
            owner: params.owner,
            repo: params.repo,
            ref: params.ref,
            path: params.path,
        });
        if (!Array.isArray(res.data) &&
            "content" in res.data &&
            typeof res.data.content === "string") {
            const buff = Buffer.from(res.data.content, res.data.encoding || "base64");
            return buff.toString("utf8");
        }
    }
    catch { }
    return null;
}
export async function postSummaryComment(params) {
    const token = params.token ||
        process.env.GITHUB_TOKEN ||
        process.env.LGTM_GITHUB_TOKEN ||
        "";
    const octokit = new Octokit({ auth: token || undefined });
    await octokit.issues.createComment({
        owner: params.owner,
        repo: params.repo,
        issue_number: params.prNumber,
        body: params.body,
    });
}
