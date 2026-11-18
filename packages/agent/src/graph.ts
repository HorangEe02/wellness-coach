import { END, START, StateGraph } from '@langchain/langgraph';
import { coachNode } from './coach.ts';
import { guardNode } from './guard.ts';
import type { Models } from './models/config.ts';
import { activityNode } from './modules/activity.ts';
import { strengthNode } from './modules/strength.ts';
import { routerNode } from './router.ts';
import { State } from './state.ts';
import type { UserData } from './state.ts';

// guard → (flagged: safe reply, end) | router → (strength | activity, in parallel when both match) → coach.
export function buildGraph({ decider, chat = null }: Partial<Models> & Pick<Models, 'decider'> = { decider: null }) {
  return new StateGraph(State)
    .addNode('guard', guardNode(decider, chat))
    .addNode('router', routerNode)
    .addNode('strength', strengthNode)
    .addNode('activity', activityNode)
    .addNode('coach', coachNode)
    .addEdge(START, 'guard')
    .addConditionalEdges('guard', s => (s.safety.flag ? END : 'router'), ['router', END])
    .addConditionalEdges('router', s => (s.intents.length ? s.intents : ['coach']), ['strength', 'activity', 'coach'])
    .addEdge('strength', 'coach')
    .addEdge('activity', 'coach')
    .addEdge('coach', END)
    .compile();
}

// Rules-only graph: what tests and the default CLI use.
export const graph = buildGraph();

export const ask = (input: string, user: UserData, now = Date.now(), g = graph) => g.invoke({ input, user, now });
