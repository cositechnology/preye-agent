export const defaultPolicy = {
    weights: { info: 0.5, minor: 1, major: 3, critical: 6 },
    softThreshold: 2,
    hardThreshold: 8,
};
export function decide(findings, policy = defaultPolicy) {
    const counts = {
        info: 0,
        minor: 0,
        major: 0,
        critical: 0,
    };
    for (const f of findings)
        counts[f.severity] += 1;
    const score = counts.info * policy.weights.info +
        counts.minor * policy.weights.minor +
        counts.major * policy.weights.major +
        counts.critical * policy.weights.critical;
    let verdict = "Approved";
    if (score === 0)
        verdict = "Approved";
    else if (score <= policy.softThreshold &&
        counts.major === 0 &&
        counts.critical === 0)
        verdict = "Comment";
    else if (score > policy.hardThreshold || counts.critical >= 2)
        verdict = "Rejected";
    else
        verdict = "Changes Requested";
    return { verdict, score, counts };
}
export function formatDecision(decision) {
    const { verdict, score, counts } = decision;
    return [
        `Decision: ${verdict}`,
        `Score: ${score.toFixed(1)} (info:${counts.info}, minor:${counts.minor}, major:${counts.major}, critical:${counts.critical})`,
    ].join("\n");
}
