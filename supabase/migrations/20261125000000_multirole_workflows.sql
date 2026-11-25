-- Multi-role access, explicit caregiver consent, and versioned educational-content review.
-- Roles come only from auth.app_metadata; clients cannot grant or edit their own roles.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.has_app_role(p_role text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = p_role, false)
      or coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? p_role, false)
$$;
create or replace function public.is_researcher()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_app_role('researcher') $$;
revoke all on function public.has_app_role(text) from public, anon;
revoke all on function public.is_researcher() from public, anon;
grant execute on function public.has_app_role(text), public.is_researcher() to authenticated;

-- Role-specific reads remain account-scoped; administrative roles still cannot see local user_state.
drop policy if exists clinician_ratings_insert on public.clinician_ratings;
create policy clinician_ratings_insert on public.clinician_ratings for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_app_role('clinician'));
drop policy if exists clinician_ratings_select on public.clinician_ratings;
create policy clinician_ratings_select on public.clinician_ratings for select to authenticated
  using (user_id = (select auth.uid()) or public.is_researcher() or public.has_app_role('administrator'));

drop policy if exists research_answers_select on public.research_answers;
create policy research_answers_select on public.research_answers for select to authenticated
  using (user_id = (select auth.uid()) or public.is_researcher() or public.has_app_role('administrator'));
drop policy if exists study_responses_select on public.study_responses;
create policy study_responses_select on public.study_responses for select to authenticated
  using (user_id = (select auth.uid()) or public.is_researcher() or public.has_app_role('administrator'));
grant select on public.research_answers_export, public.study_responses_export to authenticated;
grant select on public.research_answers, public.study_responses, public.clinician_ratings to authenticated;

-- A caregiver sees only the narrow, explicitly shared learning summary below, never the child's user_state or chats.
create table if not exists public.caregiver_links (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  caregiver_user_id uuid not null references auth.users(id) on delete cascade,
  patient_alias text not null check (char_length(patient_alias) between 1 and 32),
  patient_assent_at timestamptz not null,
  guardian_permission_at timestamptz not null,
  caregiver_consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (patient_user_id <> caregiver_user_id),
  unique (patient_user_id, caregiver_user_id)
);
alter table public.caregiver_links enable row level security;
grant select, delete on public.caregiver_links to authenticated;
drop policy if exists caregiver_links_select on public.caregiver_links;
create policy caregiver_links_select on public.caregiver_links for select to authenticated
  using (patient_user_id = (select auth.uid()) or caregiver_user_id = (select auth.uid()));
drop policy if exists caregiver_links_delete on public.caregiver_links;
create policy caregiver_links_delete on public.caregiver_links for delete to authenticated
  using (patient_user_id = (select auth.uid()) or caregiver_user_id = (select auth.uid()));
create index if not exists caregiver_links_patient_idx on public.caregiver_links (patient_user_id, created_at desc);
create index if not exists caregiver_links_caregiver_idx on public.caregiver_links (caregiver_user_id, created_at desc);

create or replace function public.is_linked_caregiver(p_patient uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.caregiver_links l
    where l.patient_user_id = p_patient
      and l.caregiver_user_id = auth.uid()
      and l.patient_assent_at is not null
      and l.guardian_permission_at is not null
      and l.caregiver_consent_at is not null
      and l.revoked_at is null
  )
$$;
revoke all on function public.is_linked_caregiver(uuid) from public, anon;
grant execute on function public.is_linked_caregiver(uuid) to authenticated;

create table if not exists public.caregiver_link_invites (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  patient_alias text not null check (char_length(patient_alias) between 1 and 32),
  token_hash text not null unique,
  patient_assent_at timestamptz not null,
  guardian_permission_at timestamptz not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.caregiver_link_invites enable row level security;
grant delete on public.caregiver_link_invites to authenticated;
-- No direct SELECT or INSERT policy: invite codes and mutations are handled by the scoped RPCs below.
drop policy if exists caregiver_invites_delete on public.caregiver_link_invites;
create policy caregiver_invites_delete on public.caregiver_link_invites for delete to authenticated
  using (patient_user_id = (select auth.uid()));

create or replace function public.create_caregiver_link_invite(
  p_token text, p_patient_alias text, p_patient_assent boolean, p_guardian_permission boolean
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.has_app_role('patient') then raise exception 'patient role required'; end if;
  if p_patient_assent is distinct from true or p_guardian_permission is distinct from true then raise exception 'both patient assent and guardian permission are required'; end if;
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 200 then raise exception 'invalid invite token'; end if;
  if p_patient_alias is null or char_length(trim(p_patient_alias)) not between 1 and 32 then raise exception 'alias must be 1 to 32 characters'; end if;
  insert into public.caregiver_link_invites (patient_user_id, patient_alias, token_hash, patient_assent_at, guardian_permission_at, expires_at)
  values (auth.uid(), trim(p_patient_alias), encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex'), now(), now(), now() + interval '72 hours')
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.accept_caregiver_link_invite(p_token text, p_caregiver_consent boolean)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_invite public.caregiver_link_invites%rowtype; v_id uuid;
begin
  if auth.uid() is null or not public.has_app_role('caregiver') then raise exception 'caregiver role required'; end if;
  if p_caregiver_consent is distinct from true then raise exception 'caregiver consent is required'; end if;
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 200 then raise exception 'invalid invite token'; end if;
  select * into v_invite from public.caregiver_link_invites
  where token_hash = encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
    and expires_at > now()
  for update;
  if not found or v_invite.patient_user_id = auth.uid() then raise exception 'invite is invalid or expired'; end if;
  insert into public.caregiver_links
    (patient_user_id, caregiver_user_id, patient_alias, patient_assent_at, guardian_permission_at, caregiver_consent_at)
  values (v_invite.patient_user_id, auth.uid(), v_invite.patient_alias, v_invite.patient_assent_at, v_invite.guardian_permission_at, now())
  on conflict (patient_user_id, caregiver_user_id) do update set
    patient_alias = excluded.patient_alias,
    patient_assent_at = excluded.patient_assent_at,
    guardian_permission_at = excluded.guardian_permission_at,
    caregiver_consent_at = excluded.caregiver_consent_at,
    revoked_at = null
  returning id into v_id;
  delete from public.caregiver_link_invites where id = v_invite.id;
  return v_id;
end
$$;

create or replace function public.revoke_pending_caregiver_invites()
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_count integer;
begin
  if auth.uid() is null or not public.has_app_role('patient') then raise exception 'patient role required'; end if;
  delete from public.caregiver_link_invites where patient_user_id = auth.uid();
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

create or replace function public.revoke_caregiver_link(p_link_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  update public.caregiver_links set revoked_at = now()
  where id = p_link_id and (patient_user_id = auth.uid() or caregiver_user_id = auth.uid())
    and revoked_at is null;
  if not found then raise exception 'active link not found'; end if;
end
$$;
revoke all on function public.create_caregiver_link_invite(text,text,boolean,boolean) from public, anon;
revoke all on function public.accept_caregiver_link_invite(text,boolean) from public, anon;
revoke all on function public.revoke_pending_caregiver_invites() from public, anon;
revoke all on function public.revoke_caregiver_link(uuid) from public, anon;
grant execute on function public.create_caregiver_link_invite(text,text,boolean,boolean),
  public.accept_caregiver_link_invite(text,boolean), public.revoke_pending_caregiver_invites(),
  public.revoke_caregiver_link(uuid) to authenticated;

create table if not exists public.caregiver_learning_shares (
  patient_user_id uuid primary key references auth.users(id) on delete cascade,
  topic_ids text[] not null default '{}',
  completed_topic_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  check (cardinality(topic_ids) <= 20),
  check (cardinality(completed_topic_ids) <= 20)
);
alter table public.caregiver_learning_shares enable row level security;
grant select, insert, update, delete on public.caregiver_learning_shares to authenticated;
drop policy if exists caregiver_shares_patient_select on public.caregiver_learning_shares;
create policy caregiver_shares_patient_select on public.caregiver_learning_shares for select to authenticated
  using (patient_user_id = (select auth.uid()));
drop policy if exists caregiver_shares_patient_insert on public.caregiver_learning_shares;
create policy caregiver_shares_patient_insert on public.caregiver_learning_shares for insert to authenticated
  with check (patient_user_id = (select auth.uid()) and public.has_app_role('patient'));
drop policy if exists caregiver_shares_patient_update on public.caregiver_learning_shares;
create policy caregiver_shares_patient_update on public.caregiver_learning_shares for update to authenticated
  using (patient_user_id = (select auth.uid()) and public.has_app_role('patient'))
  with check (patient_user_id = (select auth.uid()) and public.has_app_role('patient'));
drop policy if exists caregiver_shares_patient_delete on public.caregiver_learning_shares;
create policy caregiver_shares_patient_delete on public.caregiver_learning_shares for delete to authenticated
  using (patient_user_id = (select auth.uid()) and public.has_app_role('patient'));
drop policy if exists caregiver_shares_linked_select on public.caregiver_learning_shares;
create policy caregiver_shares_linked_select on public.caregiver_learning_shares for select to authenticated
  using (public.is_linked_caregiver(patient_user_id) and public.has_app_role('caregiver'));

-- Immutable content versions are submitted by administrators and reviewed by a different, role-verified clinician.
create table if not exists public.educational_content_versions (
  id uuid primary key default gen_random_uuid(),
  topic_id text not null check (char_length(topic_id) between 1 and 64),
  version integer not null check (version > 0),
  payload jsonb not null check (octet_length(payload::text) <= 50000),
  source_ids text[] not null default '{}',
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected','revision_requested')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  unique (topic_id, version)
);
alter table public.educational_content_versions enable row level security;
alter table public.educational_content_versions alter column created_by drop not null;
alter table public.educational_content_versions drop constraint educational_content_versions_created_by_fkey;
alter table public.educational_content_versions add constraint educational_content_versions_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;
alter table public.educational_content_versions drop constraint educational_content_versions_reviewed_by_fkey;
alter table public.educational_content_versions add constraint educational_content_versions_reviewed_by_fkey
  foreign key (reviewed_by) references auth.users(id) on delete set null;
grant select on public.educational_content_versions to anon, authenticated;
grant insert on public.educational_content_versions to authenticated;
drop policy if exists content_versions_visible on public.educational_content_versions;
create policy content_versions_visible on public.educational_content_versions for select to anon, authenticated
  using (status = 'approved');
drop policy if exists content_versions_role_read on public.educational_content_versions;
create policy content_versions_role_read on public.educational_content_versions for select to authenticated
  using (public.has_app_role('clinician') or public.has_app_role('researcher') or public.has_app_role('administrator'));
drop policy if exists content_versions_admin_insert on public.educational_content_versions;
create policy content_versions_admin_insert on public.educational_content_versions for insert to authenticated
  with check (public.has_app_role('administrator') and created_by = (select auth.uid()) and status = 'pending_review');
create index if not exists content_versions_topic_status_idx on public.educational_content_versions (topic_id, status, version desc);

create table if not exists public.educational_content_reviews (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.educational_content_versions(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  decision text not null check (decision in ('approve','reject','request_revision')),
  accuracy integer not null check (accuracy between 1 and 5),
  age_fit integer not null check (age_fit between 1 and 5),
  safety integer not null check (safety between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1200),
  created_at timestamptz not null default now(),
  unique (version_id, reviewer_id)
);
alter table public.educational_content_reviews enable row level security;
grant select, delete on public.educational_content_reviews to authenticated;
drop policy if exists content_reviews_read on public.educational_content_reviews;
create policy content_reviews_read on public.educational_content_reviews for select to authenticated
  using (reviewer_id = (select auth.uid()) or public.has_app_role('researcher') or public.has_app_role('administrator'));
drop policy if exists content_reviews_delete_own on public.educational_content_reviews;
create policy content_reviews_delete_own on public.educational_content_reviews for delete to authenticated
  using (reviewer_id = (select auth.uid()));

create or replace function public.review_educational_content(
  p_version_id uuid, p_decision text, p_accuracy integer, p_age_fit integer, p_safety integer, p_comment text default ''
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_author uuid; v_status text; v_review uuid; v_comment text;
begin
  if auth.uid() is null or not public.has_app_role('clinician') then raise exception 'clinician role required'; end if;
  if p_decision not in ('approve','reject','request_revision') then raise exception 'invalid review decision'; end if;
  if p_accuracy not between 1 and 5 or p_age_fit not between 1 and 5 or p_safety not between 1 and 5 then raise exception 'ratings must be 1 to 5'; end if;
  v_comment := coalesce(p_comment, '');
  if char_length(v_comment) > 1200 then raise exception 'review comment is too long'; end if;
  select created_by, status into v_author, v_status
  from public.educational_content_versions where id = p_version_id for update;
  if not found or v_status <> 'pending_review' then raise exception 'content version is not awaiting review'; end if;
  if v_author = auth.uid() then raise exception 'authors cannot review their own content'; end if;
  insert into public.educational_content_reviews (version_id, reviewer_id, decision, accuracy, age_fit, safety, comment)
  values (p_version_id, auth.uid(), p_decision, p_accuracy, p_age_fit, p_safety, v_comment)
  returning id into v_review;
  update public.educational_content_versions set
    status = case p_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'revision_requested' end,
    reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_version_id;
  return v_review;
end
$$;
revoke all on function public.review_educational_content(uuid,text,integer,integer,integer,text) from public, anon;
grant execute on function public.review_educational_content(uuid,text,integer,integer,integer,text) to authenticated;

-- Withdrawals include role workflow data. Account deletion cascades through the remaining foreign keys.
drop policy if exists content_reviews_delete_own on public.educational_content_reviews;
create policy content_reviews_delete_own on public.educational_content_reviews for delete to authenticated
  using (reviewer_id = (select auth.uid()));

create or replace function public.delete_my_data() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  delete from public.user_state where user_id = auth.uid();
  delete from public.research_answers where user_id = auth.uid();
  delete from public.study_responses where user_id = auth.uid();
  delete from public.clinician_ratings where user_id = auth.uid();
  delete from public.caregiver_learning_shares where patient_user_id = auth.uid();
  delete from public.caregiver_link_invites where patient_user_id = auth.uid();
  delete from public.caregiver_links where patient_user_id = auth.uid() or caregiver_user_id = auth.uid();
  delete from public.educational_content_reviews where reviewer_id = auth.uid();
  update public.educational_content_versions set created_by = null where created_by = auth.uid();
  update public.educational_content_versions set reviewed_by = null where reviewed_by = auth.uid();
end
$$;
revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;
