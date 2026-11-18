// Client for an OpenAI-compatible /chat/completions endpoint (LFM3-1.7B on Ollama).

export type Message = { role: 'system' | 'user' | 'assistant'; content: string };
// thinking: let LFM3 reason before answering. Off by default (0.3 s vs 1.7 s); the self-harm judge needs it on
// (0/28 recall without it on eval/selfharm-cases.ts dev, 20/28 with it).
export type Chat = (messages: Message[], opts?: { thinking?: boolean; timeoutMs?: number }) => Promise<string>;

export type ChatOptions = { baseUrl: string; model: string; timeoutMs?: number };

export function openAIChat({ baseUrl, model, timeoutMs = 30000 }: ChatOptions): Chat {
  const url = baseUrl.replace(/\/+$/, '') + '/chat/completions';
  return async (messages, opts = {}) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // LFM3 card: temperature 0.1 for chat/agents; 0 when judging, for repeatable labels.
      body: JSON.stringify(opts.thinking
        ? { model, messages, temperature: 0, stream: false }
        : { model, messages, temperature: 0.1, reasoning_effort: 'none', stream: false }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? timeoutMs),
    });
    if (!res.ok) throw new Error(`chat ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const out = await res.json();
    const text = out?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('chat: no message content');
    return text.trim();
  };
}
