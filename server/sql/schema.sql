create table if not exists sessions (
  id text primary key,
  name text not null,
  cycle text,
  date_label text,
  location text,
  start_date date,
  end_date date,
  description text,
  edit_window text default 'Редактирование до 03:00 следующего дня',
  registration_status text not null default 'draft',
  registration_starts_at timestamptz,
  registration_ends_at timestamptz,
  registration_capacity integer,
  registration_policy jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  full_name text not null,
  role text not null check (role in ('participant', 'curator', 'organizer', 'admin')),
  email text,
  phone text,
  age integer,
  gender text,
  status text not null default 'active',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists groups (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  name text not null,
  curator_id text references users(id) on delete set null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists session_users (
  session_id text not null references sessions(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  group_id text references groups(id) on delete set null,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table if not exists auth_sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  ip_address text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists auth_magic_links (
  id text primary key,
  token_hash text not null unique,
  purpose text not null check (purpose in ('login', 'invite')),
  target_user_id text references users(id) on delete cascade,
  session_id text references sessions(id) on delete cascade,
  role text,
  group_id text references groups(id) on delete set null,
  full_name text,
  created_by text references users(id) on delete set null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by text references users(id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists state_scale_levels (
  id text primary key,
  session_id text references sessions(id) on delete cascade,
  level integer not null,
  label text not null,
  short_label text,
  icon text,
  color text,
  surface text,
  text_color text,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  unique (session_id, level)
);

create table if not exists speakers (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  name text not null,
  role text,
  topics text[] not null default '{}',
  bio text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists programs (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  title text not null,
  description text,
  event_title text,
  event_type text,
  venue text,
  start_date date,
  end_date date,
  participant_count integer default 0,
  event_description text,
  is_current boolean not null default false,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists program_days (
  id text primary key,
  program_id text not null references programs(id) on delete cascade,
  session_id text not null references sessions(id) on delete cascade,
  day_number integer not null,
  label text not null,
  date_label text,
  date_value date,
  flow_order jsonb not null default '[]'::jsonb,
  flow_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists program_events (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  program_id text not null references programs(id) on delete cascade,
  day_id text not null references program_days(id) on delete cascade,
  speaker_id text references speakers(id) on delete set null,
  title text not null,
  start_time text,
  end_time text,
  event_type text,
  location text,
  track text,
  parallel_group text not null default 'A',
  status text not null default 'planned',
  description text,
  sort_order integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_tags (
  event_id text not null references program_events(id) on delete cascade,
  tag text not null,
  primary key (event_id, tag)
);

create table if not exists diary_entries (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  session_id text not null references sessions(id) on delete cascade,
  day_id text not null,
  event_id text references program_events(id) on delete set null,
  state_id text references state_scale_levels(id) on delete set null,
  state_level integer,
  comment text not null default '',
  confidence text not null default 'high',
  source text not null default 'web',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_id, day_id, event_id)
);

create table if not exists daily_reflections (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  session_id text not null references sessions(id) on delete cascade,
  day_id text not null,
  answers jsonb not null default '{}'::jsonb,
  free_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_id, day_id)
);

create table if not exists surveys (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  title text not null,
  category text,
  cadence text,
  source text,
  description text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists survey_questions (
  id text primary key,
  survey_id text not null references surveys(id) on delete cascade,
  question_type text not null default 'scale',
  title text not null,
  options jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists survey_publications (
  id text primary key,
  survey_id text not null references surveys(id) on delete cascade,
  session_id text not null references sessions(id) on delete cascade,
  status text not null default 'active',
  published_at timestamptz not null default now(),
  audience_summary text,
  recipients_count integer not null default 0,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists survey_responses (
  id text primary key,
  survey_id text not null references surveys(id) on delete cascade,
  publication_id text references survey_publications(id) on delete set null,
  session_id text not null references sessions(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  status text not null default 'submitted',
  submitted_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create table if not exists survey_answers (
  id text primary key,
  response_id text not null references survey_responses(id) on delete cascade,
  question_id text not null references survey_questions(id) on delete cascade,
  answer jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists trajectory_metrics (
  id text primary key,
  user_id text references users(id) on delete cascade,
  group_id text references groups(id) on delete cascade,
  session_id text not null references sessions(id) on delete cascade,
  day_id text,
  scope text not null default 'user',
  metrics jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now()
);

create table if not exists typology_assignments (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  session_id text not null references sessions(id) on delete cascade,
  typology text not null,
  score numeric,
  explanation text,
  features jsonb not null default '{}'::jsonb,
  model_version text not null default 'rule-based-v1',
  calculated_at timestamptz not null default now()
);

create table if not exists comment_clusters (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  group_id text references groups(id) on delete cascade,
  label text not null,
  summary text,
  score numeric,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists comment_cluster_items (
  cluster_id text not null references comment_clusters(id) on delete cascade,
  diary_entry_id text not null references diary_entries(id) on delete cascade,
  primary key (cluster_id, diary_entry_id)
);

create table if not exists risk_signals (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  group_id text references groups(id) on delete cascade,
  user_id text references users(id) on delete cascade,
  severity text not null default 'medium',
  title text not null,
  detail text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists curator_notes (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  group_id text references groups(id) on delete cascade,
  user_id text references users(id) on delete cascade,
  curator_id text references users(id) on delete set null,
  status text not null default 'ok',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_reports (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  group_id text references groups(id) on delete cascade,
  scope text not null,
  day_id text,
  title text not null,
  confidence text not null default 'medium',
  content jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id text primary key,
  actor_id text references users(id) on delete set null,
  session_id text references sessions(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists organizer_workspaces (
  session_id text primary key,
  workspace jsonb not null,
  updated_at timestamptz not null default now()
);

alter table sessions add column if not exists registration_status text not null default 'draft';
alter table sessions add column if not exists registration_starts_at timestamptz;
alter table sessions add column if not exists registration_ends_at timestamptz;
alter table sessions add column if not exists registration_capacity integer;
alter table sessions add column if not exists registration_policy jsonb not null default '{}'::jsonb;
alter table sessions add column if not exists created_by text;
alter table sessions add column if not exists updated_by text;
alter table users add column if not exists status text not null default 'active';
create table if not exists auth_sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  ip_address text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists auth_magic_links (
  id text primary key,
  token_hash text not null unique,
  purpose text not null check (purpose in ('login', 'invite')),
  target_user_id text references users(id) on delete cascade,
  session_id text references sessions(id) on delete cascade,
  role text,
  group_id text references groups(id) on delete set null,
  full_name text,
  created_by text references users(id) on delete set null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by text references users(id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table program_days add column if not exists flow_order jsonb not null default '[]'::jsonb;
alter table program_days add column if not exists flow_meta jsonb not null default '{}'::jsonb;
alter table diary_entries add column if not exists responded_at timestamptz;
alter table daily_reflections add column if not exists responded_at timestamptz;
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'programs' and column_name = 'status'
  ) then
    alter table programs add column status text not null default 'published';
  end if;

  alter table programs alter column status set default 'draft';
end $$;

update diary_entries
set responded_at = coalesce(updated_at, created_at, now())
where responded_at is null
  and (
    state_id is not null
    or nullif(btrim(comment), '') is not null
    or confidence <> 'high'
  );

update daily_reflections
set responded_at = coalesce(updated_at, created_at, now())
where responded_at is null
  and (
    nullif(btrim(free_text), '') is not null
    or exists (
      select 1
      from jsonb_each_text(answers) as answer(key, value)
      where nullif(btrim(answer.value), '') is not null
    )
  );

create index if not exists idx_groups_session on groups(session_id);
create index if not exists idx_session_users_session on session_users(session_id);
create index if not exists idx_session_users_user on session_users(user_id);
create index if not exists idx_sessions_registration_status on sessions(registration_status);
create index if not exists idx_auth_sessions_token on auth_sessions(token_hash);
create index if not exists idx_auth_sessions_user on auth_sessions(user_id);
create index if not exists idx_auth_magic_links_token on auth_magic_links(token_hash);
create index if not exists idx_auth_magic_links_session on auth_magic_links(session_id);
create index if not exists idx_programs_session on programs(session_id);
create index if not exists idx_programs_session_status on programs(session_id, status);
create index if not exists idx_program_days_program on program_days(program_id);
create index if not exists idx_program_events_session on program_events(session_id);
create index if not exists idx_program_events_program_day on program_events(program_id, day_id);
create index if not exists idx_program_events_speaker on program_events(speaker_id);
create index if not exists idx_diary_entries_user_session on diary_entries(user_id, session_id);
create index if not exists idx_diary_entries_event on diary_entries(event_id);
create index if not exists idx_daily_reflections_user_session on daily_reflections(user_id, session_id);
create index if not exists idx_diary_entries_responded on diary_entries(session_id, event_id, responded_at);
create index if not exists idx_daily_reflections_responded on daily_reflections(session_id, day_id, responded_at);
create index if not exists idx_surveys_session on surveys(session_id);
create index if not exists idx_survey_questions_survey on survey_questions(survey_id);
create index if not exists idx_survey_publications_survey on survey_publications(survey_id);
create index if not exists idx_survey_responses_user on survey_responses(user_id);
create index if not exists idx_trajectory_metrics_session on trajectory_metrics(session_id);
create index if not exists idx_typology_assignments_user on typology_assignments(user_id);
create index if not exists idx_comment_clusters_session on comment_clusters(session_id);
create index if not exists idx_risk_signals_session_group on risk_signals(session_id, group_id);
create index if not exists idx_ai_reports_session_scope on ai_reports(session_id, scope);
