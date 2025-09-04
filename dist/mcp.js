// Minimal MCP client placeholders.
// Wire to github-mcp-server later. For now, these throw so runner can fallback to Octokit.
function notConfigured() {
    throw new Error("MCP not configured or unsupported in this environment");
}
export async function mcpListPrFiles(params) {
    return notConfigured();
}
export async function mcpGetPrMeta(params) {
    return notConfigured();
}
export async function mcpGetFileAtRef(params) {
    return notConfigured();
}
export async function mcpCreateReview(params) {
    return notConfigured();
}
export async function mcpCreateReviewComment(params) {
    return notConfigured();
}
