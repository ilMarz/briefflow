import { randomUUID } from 'node:crypto';
import { db } from './db';
import { snapshot } from './runs';
import { mailConfigured, smtpTransport, type MailTransport } from './mail';
import { buildReport, actionLabels, verdictLabels } from '../client/report';
import {
  contactLines,
  contactSubject,
  customerSummaryLines,
  summarySubject,
} from '../client/requests';
import type { FinalCard } from '../shared/contracts';

export type MailErrorCode = 'NOT_CONFIGURED' | 'NOT_FOUND' | 'NO_EMAIL' | 'RATE_LIMIT' | 'SEND_FAILED';
export class MailError extends Error {
  constructor(readonly code: MailErrorCode) { super(code); }
}

// There is no login, so the recipient is always the address stored with the request and the
// number of messages is capped: the public form must not become a way to mail third parties.
export const MAX_PER_RUN = 5;
export const MAX_PER_RECIPIENT_PER_DAY = 10;

async function record(runId: string, kind: string, to: string, subject: string, status: string, error?: string) {
  await db().query(
    'INSERT INTO bf_mail(id,run_id,kind,to_email,subject,status,error) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [randomUUID(), runId, kind, to, subject, status, error?.slice(0, 300) ?? null],
  );
}

/** Sends the customer summary or a message from the company to the email stored with the request. */
export async function sendRunMail(
  runId: string,
  kind: 'summary' | 'contact',
  note = '',
  transport?: MailTransport,
): Promise<{ to: string }> {
  if (!transport && !mailConfigured()) throw new MailError('NOT_CONFIGURED');
  const run = await snapshot(runId);
  if (!run) throw new MailError('NOT_FOUND');
  const to = run.state.contactEmail;
  if (!to) throw new MailError('NO_EMAIL');

  const perRun = await db().query("SELECT count(*)::int AS n FROM bf_mail WHERE run_id=$1 AND kind<>'notify'", [runId]);
  const perRecipient = await db().query(
    "SELECT count(*)::int AS n FROM bf_mail WHERE to_email=$1 AND kind<>'notify' AND created_at > now() - interval '24 hours'",
    [to],
  );
  if (perRun.rows[0].n >= MAX_PER_RUN || perRecipient.rows[0].n >= MAX_PER_RECIPIENT_PER_DAY)
    throw new MailError('RATE_LIMIT');

  const company = run.state.profile.name;
  const subject = kind === 'summary' ? summarySubject(company) : contactSubject(company);
  const lines = kind === 'summary' ? customerSummaryLines(run, company) : contactLines(run.state.brief, note, company);
  try {
    await (transport ?? smtpTransport()).send({ to, subject, text: lines.join('\n') });
  } catch (cause) {
    await record(runId, kind, to, subject, 'failed', cause instanceof Error ? cause.message : 'error');
    throw new MailError('SEND_FAILED');
  }
  await record(runId, kind, to, subject, 'sent');
  return { to };
}

const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

/** Tells the company about a new request, once per request, when `MAIL_NOTIFY_TO` is set. Never throws. */
export async function notifyCompany(runId: string, transport?: MailTransport): Promise<void> {
  const to = process.env.MAIL_NOTIFY_TO;
  if (!to || (!transport && !mailConfigured())) return;
  try {
    const run = await snapshot(runId);
    if (!run) return;
    const interrupt = [...run.events].reverse().find((e) => e.type === 'run_interrupted');
    const needsPerson = run.status === 'interrupted' && interrupt?.payload.kind === 'manual_review';
    if (run.status !== 'completed' && !needsPerson) return;

    const subject = `Nuova richiesta ricevuta${run.state.category ? `: ${run.state.category}` : ''}`;
    const claimed = await db().query(
      "INSERT INTO bf_mail(id,run_id,kind,to_email,subject,status) VALUES($1,$2,'notify',$3,$4,'pending') ON CONFLICT DO NOTHING RETURNING id",
      [randomUUID(), runId, to, subject],
    );
    if (!claimed.rowCount) return;

    const done = [...run.events].reverse().find((e) => e.type === 'run_completed');
    const outcome = done
      ? (() => {
          const card = done.payload.card as unknown as FinalCard;
          const report = buildReport(card, run.events, runId);
          return `${verdictLabels[card.compatibility]} · ${actionLabels[card.nextAction]}\n${report.nextStep}`;
        })()
      : 'Serve una revisione manuale: una persona deve confermare il percorso.';
    const text = [
      'È arrivata una nuova richiesta.',
      '',
      `Categoria: ${run.state.category || 'da verificare'}`,
      `Esito: ${outcome}`,
      `Email di chi ha scritto: ${run.state.contactEmail ?? 'non presente'}`,
      '',
      'Richiesta:',
      `«${run.state.brief.slice(0, 400)}»`,
      '',
      `Apri nel backoffice: ${appUrl()}/backoffice?run=${runId}`,
    ].join('\n');

    try {
      await (transport ?? smtpTransport()).send({ to, subject, text });
      await db().query("UPDATE bf_mail SET status='sent' WHERE id=$1", [claimed.rows[0].id]);
    } catch (cause) {
      await db().query("UPDATE bf_mail SET status='failed', error=$2 WHERE id=$1", [
        claimed.rows[0].id,
        (cause instanceof Error ? cause.message : 'error').slice(0, 300),
      ]);
    }
  } catch {
    // Notification is best effort: it must never break the run that triggered it.
  }
}

/** Called after a run step ends; waits a few seconds at most so the response is not held up. */
export async function notifyIfNeeded(runId: string): Promise<void> {
  await Promise.race([notifyCompany(runId), new Promise<void>((resolve) => setTimeout(resolve, 4000))]);
}
