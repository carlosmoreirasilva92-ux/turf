create table if not exists turf_races (
  id text primary key,
  user_id text not null,
  provider_race_id text,
  course text not null,
  country text not null,
  discipline text not null,
  name text not null,
  distance text,
  going text,
  off_at timestamptz not null,
  handicap boolean not null default false,
  origin text not null check (origin in ('user', 'provider')),
  created_at timestamptz not null default now()
);

create unique index if not exists turf_races_provider_idx
  on turf_races (user_id, provider_race_id)
  where provider_race_id is not null;

create index if not exists turf_races_user_off_idx
  on turf_races (user_id, off_at desc, id desc);

create table if not exists turf_runners (
  id text primary key,
  user_id text not null,
  race_id text not null references turf_races (id),
  provider_runner_id text,
  horse_key text,
  name text not null,
  cloth integer,
  jockey_name text,
  jockey_key text,
  trainer_name text,
  trainer_key text,
  profile jsonb not null default '{}'::jsonb
);

create index if not exists turf_runners_race_idx on turf_runners (user_id, race_id);

create table if not exists turf_prices (
  id text primary key,
  user_id text not null,
  race_id text not null,
  runner_id text not null,
  market text not null,
  book text not null,
  decimal_odds numeric not null,
  source text not null check (source in ('user', 'provider')),
  observed_at timestamptz,
  provider_updated_at timestamptz,
  received_at timestamptz not null
);

create index if not exists turf_prices_runner_idx on turf_prices (user_id, runner_id, received_at desc);

create table if not exists turf_predictions (
  id text primary key,
  user_id text not null,
  race_id text not null,
  idempotency_key text not null,
  model_id text not null,
  model_version text not null,
  content_hash text not null,
  snapshot jsonb not null,
  server_now timestamptz not null,
  off_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (user_id, race_id, model_version)
);

create table if not exists turf_result_events (
  id text primary key,
  user_id text not null,
  race_id text not null,
  idempotency_key text not null,
  status text not null,
  payload jsonb not null,
  source text not null check (source in ('user', 'provider')),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists turf_sync_runs (
  id text primary key,
  user_id text not null,
  source text not null,
  status text not null,
  detail jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists turf_ai_calls (
  id text primary key,
  user_id text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null
);

create index if not exists turf_ai_calls_user_idx on turf_ai_calls (user_id, started_at desc);

create table if not exists turf_favorites (
  user_id text not null,
  race_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, race_id)
);
