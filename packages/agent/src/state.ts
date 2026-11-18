import { Annotation } from '@langchain/langgraph';
import type { Safety } from './guard.ts';

export type Domain = 'strength' | 'activity';

// What a domain node hands to coach: ready-made sentences built from tool numbers, plus the raw numbers.
export type DomainResult = { domain: Domain; topic: string; facts: string[]; data: Record<string, unknown> };

export type Walk = { start: number; distM: number; activeSec: number };
export type UserData = {
  profile: { weightKg: number; heightCm: number };
  // Same shapes as egg-kim-coach's saved state (workouts, settings) plus the options genPlan takes.
  strength: {
    settings: { weeklyGoal: number };
    planOpts: { goal: string; exp: string; days: number; equip: string[]; pain: string[] };
    workouts: any[];
    planNext?: number; // which plan day comes next; moves on when a plan workout is saved
  };
  walks: Walk[]; // Pace-Coach records (analysis results only for now)
  steps?: Record<string, number>; // YYYY-MM-DD → step count from the phone's step sensor
};

export const State = Annotation.Root({
  input: Annotation<string>(),
  now: Annotation<number>(),
  user: Annotation<UserData>(),
  safety: Annotation<Safety>(),
  intents: Annotation<Domain[]>(),
  // Domain nodes run in parallel, so their results are appended instead of overwritten.
  results: Annotation<DomainResult[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  reply: Annotation<string>(),
});

export type GraphState = typeof State.State;
