import { openAIChat } from './chat.ts';
import type { Chat } from './chat.ts';
import { llmChoice } from './llmchoice.ts';
import { systemOne } from './systemone.ts';
import type { Decider } from './systemone.ts';

export type Models = { decider: Decider | null; chat: Chat | null };

// Env → model clients (docs/MODELS.md §5). Defaults keep the step-2 behaviour: rules only, template replies.
export function modelsFromEnv(env: Record<string, string | undefined> = process.env): Models {
  const backend = env.DECISION_BACKEND ?? 'rules';
  let decider: Decider | null = null;
  if (backend === 'd1') decider = systemOne({ baseUrl: env.D1_URL ?? 'http://localhost:8081' });
  else if (backend === 'laya') decider = systemOne({ baseUrl: env.LAYA_URL ?? 'http://localhost:8082' });
  else if (backend === 'lfm3') decider = llmChoice({ baseUrl: env.LLM_BASE_URL ?? 'http://localhost:11434/v1', model: env.LLM_MODEL ?? 'wellness-lfm3' });
  else if (backend !== 'rules') throw new Error(`unknown DECISION_BACKEND: ${backend}`); // local models only: no d1.2-ultra
  const chat = env.LLM_MODEL
    ? openAIChat({ baseUrl: env.LLM_BASE_URL ?? 'http://localhost:11434/v1', model: env.LLM_MODEL })
    : null;
  return { decider, chat };
}
