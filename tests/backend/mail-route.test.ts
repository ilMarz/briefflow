import { describe, it, expect, afterEach } from 'vitest';
import { POST } from '../../src/app/api/runs/[id]/mail/route';
import { mailConfigured } from '../../src/server/mail';
import { GET as config } from '../../src/app/api/config/route';

const ID = '12345678-1234-1234-1234-123456789012';
const call = (id: string, body: unknown) =>
  POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe('mail endpoint guards (no database or SMTP needed)', () => {
  it('is only configured when both the SMTP server and the sender are set', () => {
    delete process.env.SMTP_URL; delete process.env.MAIL_FROM;
    expect(mailConfigured()).toBe(false);
    process.env.SMTP_URL = 'smtp://127.0.0.1:1025';
    expect(mailConfigured()).toBe(false);
    process.env.MAIL_FROM = 'ACME IT <richieste@acme-it.example>';
    expect(mailConfigured()).toBe(true);
  });

  it('says so when the email service is not configured', async () => {
    process.env.DATABASE_URL = 'postgres://unused';
    delete process.env.SMTP_URL; delete process.env.MAIL_FROM;
    const r = await call(ID, { kind: 'summary' });
    expect(r.status).toBe(503);
    expect((await r.json()).error.code).toBe('MAIL_NOT_CONFIGURED');
    expect(await (await config()).json()).toMatchObject({ mailAvailable: false });
  });

  it('validates the id and the body before touching the database', async () => {
    process.env.DATABASE_URL = 'postgres://unused';
    process.env.SMTP_URL = 'smtp://127.0.0.1:1025';
    process.env.MAIL_FROM = 'ACME IT <richieste@acme-it.example>';
    expect((await call('non-valido', { kind: 'summary' })).status).toBe(404);
    expect((await call(ID, { kind: 'altro' })).status).toBe(400);
    expect((await call(ID, { kind: 'contact', note: 'x'.repeat(501) })).status).toBe(400);
    // a recipient in the body is ignored: the schema only knows kind and note
    expect((await call(ID, { kind: 'summary', to: 'vittima@esempio.it' })).status).not.toBe(400);
  });

  it('is switched off together with the rest of the app', async () => {
    process.env.JEV_LIMIT_REACHED = 'true';
    expect((await call(ID, { kind: 'summary' })).status).toBe(503);
    expect(await (await config()).json()).toMatchObject({ mailAvailable: false });
  });
});
