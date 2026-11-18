// A Decider on an OpenAI-compatible chat endpoint (LFM3 on Ollama), for machines that cannot run llama.cpp's
// /v1/systemone (Windows Smart App Control blocks the unsigned build). Only 'choice' questions: the options are
// numbered, the reply is prefilled with "답: ", and the probabilities come from the first token's logprobs.
import type { Answer, Decider } from './systemone.ts';

export type LlmChoiceOptions = { baseUrl: string; model: string; timeoutMs?: number };

export function llmChoice({ baseUrl, model, timeoutMs = 10000 }: LlmChoiceOptions): Decider {
  const url = baseUrl.replace(/\/+$/, '') + '/chat/completions';
  return async (state, questions) => {
    if (typeof state !== 'string') throw new TypeError('state must be the user sentence (string)');
    const answers: Record<string, Answer> = {};
    for (const [name, q] of Object.entries(questions)) {
      if (q.type !== 'choice') throw new Error(`llmChoice: only choice questions (${name} is ${q.type})`);
      const keys = Object.keys(q.criteria);
      const system = `${q.instructions}\n${keys.map((k, i) => `${i + 1}: ${q.criteria[k]}`).join('\n')}\n번호 하나만 답하세요.`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model, stream: false, temperature: 0, reasoning_effort: 'none', max_tokens: 1, logprobs: true, top_logprobs: 20,
          messages: [{ role: 'system', content: system }, { role: 'user', content: `메시지: "${state}"` }, { role: 'assistant', content: '답: ' }],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`llmChoice ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const top: { token: string; logprob: number }[] = (await res.json())?.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs ?? [];
      // Renormalise over the option numbers only; an option outside the top 20 gets 0.
      const p = keys.map((_, i) => Math.exp(top.find(t => t.token.trim() === String(i + 1))?.logprob ?? -Infinity));
      const sum = p.reduce((a, b) => a + b, 0);
      if (!sum) throw new Error('llmChoice: no option number among the top tokens');
      const probabilities = Object.fromEntries(keys.map((k, i) => [k, p[i] / sum]));
      const choice = keys[p.indexOf(Math.max(...p))];
      answers[name] = { choice, confidence: probabilities[choice], probabilities };
    }
    return answers;
  };
}
