-- Log of every email the app sends (metadata only, never the body).
CREATE TABLE IF NOT EXISTS bf_mail (
  id uuid PRIMARY KEY,
  run_id uuid REFERENCES bf_runs(id) ON DELETE CASCADE,
  kind text NOT NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- The company is notified at most once per request.
CREATE UNIQUE INDEX IF NOT EXISTS bf_mail_notify_once ON bf_mail(run_id) WHERE kind='notify';
CREATE INDEX IF NOT EXISTS bf_mail_recent ON bf_mail(to_email, created_at);