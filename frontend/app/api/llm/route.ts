import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
});

export async function POST(req: NextRequest) {
    const { prompt } = await req.json();

    const stream = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2400,
        messages: [{ role: "user", content: prompt }],
        stream: true,
    });

    const readable = new ReadableStream({
        async start(controller) {
            for await (const event of stream) {
                if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                    controller.enqueue(new TextEncoder().encode(event.delta.text));
                }
            }
            controller.close();
        },
    });

    return new Response(readable, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
}
