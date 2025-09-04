import Anthropic from "@anthropic-ai/sdk";
export function anthropicProvider(apiKey = process.env.ANTHROPIC_API_KEY || "") {
    const client = new Anthropic({ apiKey });
    return {
        name: "anthropic",
        async completeJSON({ system, messages, model }) {
            const resp = await client.messages.create({
                model,
                system,
                max_tokens: 2000,
                // Anthropic expects roles only "user" or "assistant"
                messages: messages.map((m) => ({ role: m.role, content: m.content })),
            });
            const content = resp.content?.[0]?.type === "text" ? resp.content[0].text : "{}";
            let json;
            try {
                json = JSON.parse(content);
            }
            catch {
                json = [];
            }
            return {
                json,
                tokenUsage: {
                    input: resp.usage?.input_tokens ?? 0,
                    output: resp.usage?.output_tokens ?? 0,
                },
            };
        },
    };
}
