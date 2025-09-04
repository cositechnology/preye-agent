#!/usr/bin/env node
import { runReview } from "./runner.js";

async function main() {
  const [, , ownerRepo, pr] = process.argv;
  if (!ownerRepo || !pr) {
    console.error("Usage: ts-pr-reviewer <owner/repo> <prNumber>");
    process.exit(2);
  }
  const [owner, repo] = ownerRepo.split("/");
  const prNumber = Number(pr);
  const { findings, summary } = await runReview({
    owner,
    repo,
    prNumber,
    publish: true, // Force publish for testing
  });
  console.log(JSON.stringify({ findings, summary }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
