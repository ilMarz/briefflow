import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { DEFAULT_PROFILE } from '../../src/shared/contracts';
import type { DecisionClient } from '../../src/server/jev';
import type { MailMessage, MailTransport } from '../../src/server/mail';

const complete: DecisionClient = {
  async classify() { return { category: 'Portale web' }; },
  async compatibility() { return { compatibility: 'in_scope', constraints: [], ambiguities: [] }; },
  async completeness() { return { missing: [] }; },
};
const outOfScope: DecisionClient = { ...complete, async compatibility() { return { compatibility: 'out_of_scope', constraints: [], ambiguities: [] }; } };
const needsAnswers: DecisionClient = { ...complete, async completeness(s) { return { missing: s.answers.budget ? [] : ['budget'] }; } };

const sent: MailMessage[] = [];
const ok: MailTransport = { async send(m) { sent.push(m); } };
const broken: MailTransport = { async send() { throw new Error('smtp down'); } };

describe.skipIf(!process.env.TEST_DATABASE_URL)('email service (Postgres)', () => {
  const ids: string[] = [];
  let mod: typeof import('../../src/server/mailer');
  let runs: typeof import('../../src/server/runs');
  let dbm: typeof import('../../src/server/db');

  async function newRun(client: DecisionClient, email?: string) {
    const { id } = await runs.startRun('Un brief sintetico sufficientemente lungo per il test', DEFAULT_PROFILE, randomUUID(), email);
    ids.push(id);
    const lock = await runs.reserve(id);
    await runs.execute(id, undefined, () => {}, lock, client);
    return id;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    dbm = await import('../../src/server/db');
    runs = await import('../../src/server/runs');
    mod = await import('../../src/server/mailer');
    for (const file of ['001_initial.sql', '002_mail.sql']) await dbm.db().query(await readFile(`migrations/${file}`, 'utf8'));
    const cp = dbm.saver(); await cp.setup(); await cp.end();
  });

  afterAll(async () => {
    const cp = dbm.saver();
    for (const id of ids) {
      await cp.deleteThread(id);
      for (const table of ['bf_decisions', 'bf_events', 'bf_requests']) await dbm.db().query(`DELETE FROM ${table} WHERE run_id=$1`, [id]);
      await dbm.db().query('DELETE FROM bf_runs WHERE id=$1', [id]); // bf_mail rows cascade
    }
    await cp.end();
    await dbm.db().end();
  });

  it('sends the summary and the contact message only to the email stored with the request', async () => {
    sent.length = 0;
    const id = await newRun(complete, 'cliente@azienda.it');
    const a = await mod.sendRunMail(id, 'summary', '', ok);
    const b = await mod.sendRunMail(id, 'contact', 'Possiamo sentirci domani?', ok);
    expect(a.to).toBe('cliente@azienda.it');
    expect(sent.map((m) => m.to)).toEqual(['cliente@azienda.it', 'cliente@azienda.it']);
    expect(sent[0].subject).toContain(DEFAULT_PROFILE.name);
    expect(sent[0].text).toContain('Esito:');
    expect(sent[1].text).toContain('Possiamo sentirci domani?');
    expect(b.to).toBe('cliente@azienda.it');
  });

  it('refuses unknown requests and requests without an email', async () => {
    const id = await newRun(complete);
    await expect(mod.sendRunMail(id, 'summary', '', ok)).rejects.toMatchObject({ code: 'NO_EMAIL' });
    await expect(mod.sendRunMail(randomUUID(), 'summary', '', ok)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('caps the messages per request and logs failures', async () => {
    sent.length = 0;
    const id = await newRun(complete, `limite-${randomUUID()}@azienda.it`);
    await expect(mod.sendRunMail(id, 'summary', '', broken)).rejects.toMatchObject({ code: 'SEND_FAILED' });
    for (let i = 1; i < mod.MAX_PER_RUN; i++) await mod.sendRunMail(id, 'summary', '', ok);
    await expect(mod.sendRunMail(id, 'summary', '', ok)).rejects.toMatchObject({ code: 'RATE_LIMIT' });
    expect(sent).toHaveLength(mod.MAX_PER_RUN - 1);
    const log = await dbm.db().query('SELECT status,count(*)::int AS n FROM bf_mail WHERE run_id=$1 GROUP BY status ORDER BY status', [id]);
    expect(log.rows).toEqual([{ status: 'failed', n: 1 }, { status: 'sent', n: mod.MAX_PER_RUN - 1 }]);
  });

  it('tells the company once per request, when a request is done or needs a person', async () => {
    process.env.MAIL_NOTIFY_TO = 'backoffice@acme-it.example';
    try {
      sent.length = 0;
      const done = await newRun(complete, 'a@b.it');
      await mod.notifyCompany(done, ok);
      await mod.notifyCompany(done, ok);
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe('backoffice@acme-it.example');
      expect(sent[0].text).toContain(`/backoffice?run=${done}`);

      sent.length = 0;
      await mod.notifyCompany(await newRun(outOfScope, 'a@b.it'), ok);
      expect(sent).toHaveLength(1);
      expect(sent[0].text).toContain('revisione manuale');

      sent.length = 0;
      await mod.notifyCompany(await newRun(needsAnswers, 'a@b.it'), ok); // waits for the customer, nothing to do yet
      expect(sent).toHaveLength(0);

      await expect(mod.notifyCompany(await newRun(complete, 'a@b.it'), broken)).resolves.toBeUndefined();
    } finally {
      delete process.env.MAIL_NOTIFY_TO;
    }
  });
});
