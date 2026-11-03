create table if not exists h_sources (
  id text primary key,
  user_id text not null,
  source_key text not null,
  name text not null,
  kind text not null check (kind in ('official', 'attributed', 'measurement', 'manual', 'estimate')),
  unique (user_id, source_key)
);

create table if not exists h_entities (
  id text primary key,
  user_id text not null,
  kind text not null check (kind in ('horse', 'jockey', 'trainer', 'owner', 'stable')),
  entity_key text not null,
  name text not null,
  country text,
  sex text,
  foaled_year integer,
  origin text not null check (origin in ('user', 'provider', 'example')),
  created_at timestamptz not null default now(),
  unique (user_id, kind, entity_key)
);

create index if not exists h_entities_name_idx on h_entities (user_id, kind, name);

create table if not exists h_aliases (
  id text primary key,
  user_id text not null,
  entity_id text not null references h_entities (id),
  alias text not null,
  valid_from date,
  valid_to date
);

create table if not exists h_external_ids (
  id text primary key,
  user_id text not null,
  entity_id text not null references h_entities (id),
  provider text not null,
  external_id text not null,
  unique (user_id, provider, external_id)
);

create table if not exists h_matches (
  id text primary key,
  user_id text not null,
  kind text not null,
  name text not null,
  left_key text not null,
  right_key text not null,
  status text not null default 'pending',
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists h_links (
  id text primary key,
  user_id text not null,
  horse_id text not null references h_entities (id),
  other_id text not null references h_entities (id),
  role text not null check (role in ('trainer', 'owner', 'stable')),
  valid_from date,
  valid_to date
);

create table if not exists h_courses (
  id text primary key,
  user_id text not null,
  course_key text not null,
  name text not null,
  country text not null,
  unique (user_id, course_key)
);

create table if not exists h_layouts (
  id text primary key,
  user_id text not null,
  course_id text not null references h_courses (id),
  name text not null,
  distance_m integer,
  surface text,
  direction text
);

create table if not exists h_races (
  id text primary key,
  user_id text not null,
  race_key text not null,
  course_id text references h_courses (id),
  name text not null,
  country text,
  discipline text,
  off_at timestamptz not null,
  distance_m integer,
  going text,
  surface text,
  race_class text,
  weather_forecast text,
  weather_observed text,
  status text not null default 'declared',
  origin text not null check (origin in ('user', 'provider', 'example')),
  unique (user_id, race_key)
);

create index if not exists h_races_off_idx on h_races (user_id, off_at desc);

create table if not exists h_race_revisions (
  id text primary key,
  user_id text not null,
  race_id text not null references h_races (id),
  status text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists h_runners (
  id text primary key,
  user_id text not null,
  race_id text not null references h_races (id),
  horse_id text not null references h_entities (id),
  jockey_id text references h_entities (id),
  trainer_id text references h_entities (id),
  cloth integer,
  draw integer,
  carried_lb numeric,
  body_kg numeric,
  official_rating numeric,
  provider_rating numeric,
  own_metric numeric,
  started boolean,
  position integer,
  dead_heat boolean not null default false,
  finish_status text,
  comment text,
  unique (user_id, race_id, horse_id)
);

create index if not exists h_runners_horse_idx on h_runners (user_id, horse_id);

create table if not exists h_runner_revisions (
  id text primary key,
  user_id text not null,
  runner_id text not null references h_runners (id),
  patch jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists h_prices (
  id text primary key,
  user_id text not null,
  runner_id text not null references h_runners (id),
  book text not null,
  market text not null,
  decimal_odds numeric not null,
  kind text not null check (kind in ('preoff', 'sp', 'forecast')),
  observed_at timestamptz,
  received_at timestamptz not null,
  currency text
);

create index if not exists h_prices_runner_idx on h_prices (user_id, runner_id, observed_at desc);

create table if not exists h_incidents (
  id text primary key,
  user_id text not null,
  horse_id text not null references h_entities (id),
  runner_id text references h_runners (id),
  kind text not null,
  code text,
  jurisdiction text,
  obstacle text,
  description text,
  published_cause text,
  inquiry text,
  exam_note text,
  fact_at timestamptz
);

create table if not exists h_episodes (
  id text primary key,
  user_id text not null,
  horse_id text not null references h_entities (id),
  episode_key text not null,
  documented_reason text,
  unique (user_id, episode_key)
);

create table if not exists h_episode_events (
  id text primary key,
  user_id text not null,
  episode_id text not null references h_episodes (id),
  kind text not null,
  event_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists h_observations (
  id text primary key,
  user_id text not null,
  entity_id text not null references h_entities (id),
  attr text not null,
  value_num numeric,
  value_text text,
  unit text,
  observed_at timestamptz
);

create table if not exists h_workouts (
  id text primary key,
  user_id text not null,
  horse_id text not null references h_entities (id),
  worked_at timestamptz not null,
  course text,
  distance_m integer,
  time_sec numeric,
  surface text,
  going text,
  restricted boolean not null default false
);

create table if not exists h_facts (
  id text primary key,
  user_id text not null,
  subject_type text not null,
  subject_id text not null,
  attr text not null,
  value_json jsonb,
  unit text,
  observed_at timestamptz,
  available_at timestamptz,
  absence_reason text,
  ingested_at timestamptz not null default now()
);

create index if not exists h_facts_lookup_idx on h_facts (user_id, subject_type, subject_id, attr, ingested_at desc);

create table if not exists h_absences (
  id text primary key,
  user_id text not null,
  subject_type text not null,
  subject_id text not null,
  attr text not null,
  reason text not null,
  unique (user_id, subject_type, subject_id, attr)
);

create table if not exists h_imports (
  id text primary key,
  user_id text not null,
  import_key text not null,
  origin text not null,
  status text not null,
  report jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, import_key)
);

create table if not exists h_snapshots (
  id text primary key,
  user_id text not null,
  race_id text not null references h_races (id),
  taken_at timestamptz not null,
  kind text not null,
  verified_preoff boolean not null,
  content_hash text not null,
  body jsonb not null
);

create table if not exists h_features (
  id text primary key,
  user_id text not null,
  runner_id text not null references h_runners (id),
  feature_key text not null,
  value_num numeric,
  as_of timestamptz not null,
  version text not null,
  cutoff_ok boolean not null
);

create table if not exists h_models (
  id text primary key,
  user_id text not null,
  model_key text not null,
  version text not null,
  status text not null,
  family text not null,
  params jsonb not null,
  metrics jsonb not null,
  trained_at timestamptz not null default now(),
  unique (user_id, model_key, version)
);

create table if not exists h_coverage (
  id text primary key,
  user_id text not null,
  field_name text not null,
  country text,
  discipline text,
  filled integer not null,
  missing integer not null,
  computed_at timestamptz not null default now()
);
