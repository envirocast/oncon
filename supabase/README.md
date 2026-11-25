# Supabase setup

Onconnect is local-first. Supabase adds optional account sync, opt-in structured research sharing, consent-based caregiver learning summaries, and role-protected content review. These workflows are not active on a deployment until both migrations below are applied and the necessary roles are provisioned.

## 1. Create a dedicated project

Use a project dedicated to Onconnect. Choose a region appropriate for the intended users and configure authentication, retention, backups, and access controls for the deployment.

## 2. Apply migrations in order

From the repository root, link the project and apply both migrations:

```sh
supabase link --project-ref <ref>
supabase db push
```

Or apply these files in order using the Supabase SQL editor:

1. `migrations/20261124000000_onconnect_init.sql`
2. `migrations/20261125000000_multirole_workflows.sql`

The second migration changes role-aware RLS on existing research tables and adds:

| Resource | Purpose and access |
|---|---|
| `caregiver_links`, `caregiver_link_invites` | Single-use, 72-hour, hashed invitation codes; patient and caregiver can revoke a link. Mutation is through scoped RPCs. |
| `caregiver_learning_shares` | Patient-controlled topic IDs and walkthrough completion IDs only; an active linked caregiver can read it. |
| `educational_content_versions` | Immutable versioned drafts; admins can stage, clinicians can review, and all users can retrieve approved versions. |
| `educational_content_reviews` | Authenticated clinician decisions and accuracy/age-fit/safety ratings; reviewer cannot approve their own submitted version. |
| `research_answers_export`, `study_responses_export` | Pseudonymized structured research views; researcher access remains subject to RLS on the source tables. |

The chat uses the newest validated approved version for a matched topic. If none is available, the schema is missing, or a record fails validation, it falls back to the built-in source-linked draft and surfaces a provenance warning where available. This is not live web search or sentence-level fact verification.

## 3. Configure authentication

In Supabase Authentication > URL configuration, set the production Site URL and add:

- `https://<your-domain>/auth/callback`
- `http://localhost:3000/auth/callback`

The app uses email magic links. Configure email delivery and rate limits for the deployment.

## 4. Set environment variables

```text
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key>
```

Set these in `.env.local` and in Vercel for the required environments. Never expose a `service_role` key in browser code or `NEXT_PUBLIC_*` variables.

## 5. Provision roles through a trusted process

The app reads roles from Supabase `auth.users.raw_app_meta_data`, never user-editable profile metadata. Only a trusted project owner or controlled provisioning process should grant roles after identity/eligibility checks. Example for a verified clinician:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"clinician"}'::jsonb
where email = 'verified-clinician@example.org';
```

The supported roles are `patient`, `caregiver`, `clinician`, `researcher`, and `administrator`. For a user with multiple roles, use a `roles` array in app metadata, for example `{"roles":["patient","caregiver"]}`. Ask the user to request a fresh sign-in token/session after provisioning. Do not expose a role-management endpoint to normal users.

`RoleGate` is a user-interface affordance only. RLS and the scoped database RPCs are the authorization boundary. Test each role with separate accounts before enabling a workflow.

## 6. Consent, data boundaries, and readiness

- Research sharing is off by default. Rows are pseudonymized, not anonymous, and include structured measurements only. The researcher portal reads at most 5,000 newest rows per export table per request.
- Caregiver codes are hashed in the database, expire after 72 hours, and are consumed on acceptance. The patient confirms assent and guardian permission; the caregiver separately consents. These are self-attestations, not verified legal consent. Only topic and walkthrough IDs are shared, and sharing can be disabled or revoked.
- The clinician workflow reviews versioned educational topics, not patient answers or medical records.
- `delete_my_data()` removes account-owned user state, research rows, caregiver sharing/invites/links, and authored reviews. Retained educational content versions are detached from the deleting account by clearing author/reviewer identifiers.
- Apply and test migrations in a non-production project first. This repository has no configured project credentials; deployment, external identity verification, study approval, privacy review, and role-specific integration tests remain deployment responsibilities.

Do not enroll children or real study participants until the relevant guardian/participant consent, institutional review, privacy and security checks, and operational procedures are approved.
