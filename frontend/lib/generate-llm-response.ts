export async function streamLLM(
    prompt: string,
    onChunk: (chunk: string) => void
): Promise<void> {
    const response = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
    });

    if (!response.ok || !response.body) {
        throw new Error(`LLM API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    // stream: true keeps the decoder's internal state between calls so multi-byte
    // UTF-8 characters split across chunk boundaries are reassembled correctly
    const decoder = new TextDecoder();
    let chunkCount = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunkCount++;
        if (chunkCount === 1) console.log("[LLM] First chunk received");
        onChunk(decoder.decode(value, { stream: true }));
    }

    console.log("[LLM] Stream complete", { totalChunks: chunkCount });
}
