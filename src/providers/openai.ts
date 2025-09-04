import OpenAI from "openai";
import type { LlmProvider } from "./index.js";

export function openaiProvider(
  apiKey = process.env.OPENAI_API_KEY || ""
): LlmProvider {
  const client = new OpenAI({ apiKey });
  return {
    name: "openai",
    async completeJSON({ system, messages, model }) {
      const resp = await client.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      });
      const content = resp.choices?.[0]?.message?.content || "{}";
      let json: unknown;
      try {
        json = JSON.parse(content);
      } catch {
        json = [];
      }
      return {
        json,
        tokenUsage: {
          input: resp.usage?.prompt_tokens ?? 0,
          output: resp.usage?.completion_tokens ?? 0,
        },
      };
    },
  };
}
