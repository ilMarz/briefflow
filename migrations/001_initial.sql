CREATE TABLE IF NOT EXISTS bf_runs (id uuid PRIMARY KEY, status text NOT NULL, state jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS bf_events (run_id uuid NOT NULL REFERENCES bf_runs(id), seq bigint NOT NULL, event jsonb NOT NULL, PRIMARY KEY(run_id,seq));
CREATE TABLE IF NOT EXISTS bf_requests (request_id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES bf_runs(id), kind text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE bf_runs ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE bf_requests ADD COLUMN IF NOT EXISTS request_hash text;
CREATE TABLE IF NOT EXISTS bf_decisions (run_id uuid NOT NULL REFERENCES bf_runs(id), node text NOT NULL, round integer NOT NULL, result jsonb NOT NULL, PRIMARY KEY(run_id,node,round));
