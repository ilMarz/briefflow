import { describe, expect, it } from 'vitest';
import { MemorySaver } from '@langchain/langgraph';
import { createRunGraph, initialState } from '../../src/server/graph';
import type { DecisionClient } from '../../src/server/jev';
import { DEFAULT_PROFILE } from '../../src/shared/contracts';

const fake: DecisionClient = {
  async classify() { return { category: 'Portale web', model: 'fake' }; },
  async compatibility() { return { compatibility: 'in_scope', constraints: [], ambiguities: [] }; },
  async completeness() { return { missing: [] }; },
};

describe('contact email', () => {
  it('stays in the run state but never reaches the stored events or the decision client', async () => {
    const seen: string[] = [];
    const spy: DecisionClient = {
      classify: (s) => { seen.push(JSON.stringify(s.brief + JSON.stringify(s.answers))); return fake.classify(s); },
      compatibility: fake.compatibility,
      completeness: fake.completeness,
    };
    const events: unknown[] = [];
    const graph = createRunGraph(spy, new MemorySaver(), async (type, payload, node) => { events.push({ type, payload, node }); });
    const result = await graph.invoke(
      { data: initialState('Un portale web per i clienti con area riservata.', DEFAULT_PROFILE, 'cliente@azienda.it') },
      { configurable: { thread_id: 'privacy' } },
    );
    expect(result.data.contactEmail).toBe('cliente@azienda.it');
    expect(events.length).toBeGreaterThan(0);
    expect(JSON.stringify(events)).not.toContain('cliente@azienda.it');
    expect(seen.join('')).not.toContain('cliente@azienda.it');
  });
});
