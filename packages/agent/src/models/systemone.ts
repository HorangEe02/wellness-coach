// Client for POST /v1/systemone: d1-2B and laya on local llama.cpp servers. No hosted API (docs/MODELS.md §1).
// Only noul/choice/score: llama.cpp does not answer the other d1 question types yet (docs/MODELS.md §4).

export type Question =
  | { type: 'noul'; instructions: string }
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'score'; instructions: string; criteria: string[] };

export type Answer = {
  noul?: number; // P(yes)
  choice?: string;
  score?: number;
  confidence?: number;
  probabilities?: Record<string, number>;
};

// state is the user's sentence only, never their records: routing and safety need nothing more (docs/MODELS.md §6).
export type Decider = (state: string, questions: Record<string, Question>) => Promise<Record<string, Answer>>;

export type SystemOneOptions = { baseUrl: string; timeoutMs?: number };

export function systemOne({ baseUrl, timeoutMs = 5000 }: SystemOneOptions): Decider {
  const url = baseUrl.replace(/\/+$/, '') + '/v1/systemone';
  return async (state, questions) => {
    if (typeof state !== 'string') throw new TypeError('state must be the user sentence (string)');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state, questions }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`systemone ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const out = await res.json();
    if (!out || typeof out.answers !== 'object') throw new Error('systemone: no answers in response');
    return out.answers;
  };
}
