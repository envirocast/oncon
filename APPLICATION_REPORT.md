# Onconnect Application Report

**Snapshot:** 2026-11-25  
**Application:** Onconnect, a pediatric oncology education research prototype  
**Status:** Functional local-first prototype with multi-role workflows implemented in code; Supabase migration and role-specific database integration remain unverified and must be deployed before those workflows are active

## 1. Purpose and scope

Onconnect is a web application for learning about pediatric oncology topics in general terms. It adapts educational explanations to a reader-selected profile and conversation feedback, while encouraging personal diagnosis, treatment, and procedure questions to go to the healthcare team. It is not a medical device, clinical decision tool, or substitute for professional care.

The application combines a local, curated educational corpus with an optional language-model rewriting step. It does **not** perform live internet search. A question must match a supported topic (or be a recognizable follow-up to one) before the model can answer; unsupported topics are not answered from general model knowledge. Supported replies display links from a static, topic-mapped source catalog. The presence of a citation does not establish that each generated sentence is verified by that source.

## 2. Medical learning content

### Supported topic guides

There are 18 source-linked topic records:

- Biopsy and tissue sampling
- CT scan, MRI, ultrasound, PET/CT, and X-ray
- Blood tests and complete blood count (CBC)
- Catheter placement
- Embolization and tumor ablation
- Understanding a diagnosis
- Chemotherapy and radiation therapy
- Bone marrow aspiration or biopsy
- Lumbar puncture (spinal tap)
- Cancer treatment side effects
- Clinical trials

Topic records contain four age-band explanations (6–8, 9–11, 12–14, and 15–17), general step sequences, examples, related terms, and questions a reader may wish to ask their care team. The expanded vocabulary includes terms such as radiotracer, hemoglobin, neutrophil, bone marrow, remission, and side effect. A broader word bank, anatomy material, resource listings, and procedure-specific supplemental material are also present.

### Procedure and treatment explorer

Each topic has a guide page with an age/detail selector and, where supplemental procedure data exists, purpose, possible equipment, preparation, experience, and aftercare information. It includes a staged interactive walkthrough, read-aloud support, optional knowledge checks, glossary definitions, questions for the care team, and linked sources. The guides explicitly say that actual procedures vary and that care-team instructions take precedence.

Other learning surfaces include:

- Medical-word search, definitions, examples, related terms, and category-based references.
- An anatomy explorer connecting body structures with definitions and related procedures.
- A dashboard with a reader-selected learning plan, completion tracking, recently explored topics, suggestions, saved items, conversations, and chat-memory indicators.
- An activity-based care journey that persists guide views, walkthrough stage/completion, optional-check responses, and chat topics discussed. This is a learning-activity record, not a medical care plan or mastery assessment.
- A searchable personalization history across saved conversations, with descriptive two-conversation comparisons and links to the existing detailed reports.
- A family and school information page, with references to institutional communication resources.
- A question builder that organizes and prints or copies questions for appointments; optional wording clarification does not answer the personal medical question. Clarification uses the configured model provider (OpenRouter or Gemini), with input validation, rate limiting, and a deterministic fallback.

## 3. Adaptive chat

### Profile and preferences

The optional setup flow collects:

- Reader context: patient, caregiver, or shared reading.
- Selected age band, response language, and short/balanced/detailed preference.
- Selected topics, concerns, and free-text notes.
- Requested formats such as steps, examples, definitions, and understanding checks.
- Optional communication/accessibility preferences: short chunks, literal wording, predictable order, structured lists, and gentle sensory detail.

These are user-entered preferences, not psychological classifications. The app does not infer a diagnosis, disability, or learning style. Profile fields are sanitized on the server before use. Notes and concerns are treated as unverified, optional context; they must not be used to add medical claims or make individual care decisions.

### Conversation adaptation

Chat history is used for follow-ups. Explicit feedback signals (for example, “simpler,” “more detail,” “shorter,” “I don't understand,” and “got it”) update local memory for level shift, length, scaffolding, and topic-specific confusion. Repeated confusion can trigger an alternate, analogy-first explanation. Responses can also incorporate role, selected learning preferences, language, and relevant stated concerns.

Age bands and readability targets are heuristics, not validated developmental or clinical norms. Flesch–Kincaid readability estimates, word limits, and concept-coverage scores are automated indicators; they do not prove comprehension or factual accuracy. If the language model is unavailable, the application uses its built-in age-banded template where a topic matches. Non-English model responses are not medically translated or independently verified.

### Response safety and grounding

- The response pipeline checks for selected distress expressions and personal-advice patterns. Distress triggers a fixed support message rather than personalization or model generation.
- Personal treatment decisions, dosing, diagnosis, and prognosis are outside scope and are redirected to the reader's care team.
- For a supported topic, the model receives the matched topic record and its mapped source links, with instructions to stay within the provided content. A response guard looks for selected unsafe output patterns and can append a care-team reminder.
- A failed or missing model call falls back to the local template. A topic mismatch returns supported-topic choices without a model-generated medical answer.
- Pattern matching and output checks are limited heuristics and can miss or misclassify language. They are not a complete safety system.

The library is static at runtime: there is no live search, retrieval index, per-claim citation verification, automatic source update, or guarantee that a citation covers every generated statement. Institutional sources are mapped to topics and surfaced in chat, guides, word entries, and saved explanations. Citation coverage and accuracy still require expert review.

## 4. Chat and accessibility features

The chat supports streamed responses, follow-up context, suggested follow-up questions, stop generation, retry/regenerate, answer feedback, save/bookmark, copy, print, Markdown conversation export, browser text-to-speech, optional voice input when supported by the browser, and a research/context panel. It can display answer citations and retains those citations when an explanation is saved or exported. An online/offline indicator reports model availability; offline explanations are less flexible and are available in English.

The application shell includes responsive navigation, chat switching and deletion, page jump/search, collapsible navigation, dark/light theme, text-size controls, keyboard shortcuts, and skip-to-content navigation.

## 5. Feelings and family support

The optional feelings area has mood check-ins and history, a journal, breathing and grounding activities, and prompts for speaking with a trusted adult. It is not therapy and does not diagnose mental health conditions. A limited set of crisis-related phrases displays a prompt to contact a trusted adult and, in the U.S., call or text 988. This keyword-based behavior is not a crisis assessment service.

## 6. Research and review tools

The application includes a suite of research-oriented pages:

- **Session report:** explains what the system used and changed, shows adaptation traces, readability/coverage heuristics, age comparisons, clickable source citations per reply, and Markdown/JSON export with references.
- **Personalization history:** searches saved conversations and compares measured activity/adaptation summaries; detailed session reports remain available per conversation.
- **Audit log and research dashboard:** summarize locally available reply measurements, feedback, models, topics, signals, and adaptations. The researcher dashboard also reads role-protected, pseudonymized Supabase research export views and can export structured rows to CSV (up to 5,000 newest rows per table per request).
- **Age comparison and evaluation harness:** compare age-band renderings and run fixed evaluation/ablation flows.
- **Comprehension study and protocol/power pages:** provide study materials, quiz/self-rating workflow, design parameters, and power calculations.
- **Analysis and paper draft pages:** support statistical summaries and draft reporting from collected measurements.
- **Clinician review:** authenticated clinician-role workflow for reviewing pending, versioned educational topics against mapped source links, with accuracy, age-fit, and safety ratings; approval, rejection, or revision requests are recorded in Supabase. An author cannot review their own version.
- **Legacy local review analysis:** historical device-local rating records can still be analyzed, but user-entered rater labels do not establish clinician identity and are separate from protected content-version reviews.
- **Administrator workspace:** administrator-role workflow to stage a new immutable version of each built-in topic and inspect review status. It cannot grant roles or approve content.
- **Caregiver workspace:** accepts a one-time invitation and reads only topic IDs and walkthrough completion IDs the patient has explicitly shared; it does not read chats, questions, profile notes, feelings data, or medical records.
- **Patient-controlled caregiver sharing:** the patient can enable or remove summary sharing, record assent and guardian permission, create a hashed, single-use 72-hour invite, and revoke accepted or pending links. The caregiver separately confirms consent. These confirmations are self-attestations, not independent identity or legal-consent verification.
- **Literature map and method page:** distinguish measured application behavior from theory-inspired design decisions and describe limitations.

Research calculations include descriptive statistics, Welch's t-test, Mann–Whitney U, bootstrap confidence intervals, effect sizes, Holm correction, kappa, internal-consistency calculations, and sample-size/power helpers. Automated readability and coverage metrics are not clinical measures. Literature references that are not linked to an institutional source are marked as requiring bibliographic verification. This prototype does not establish effectiveness, safety, or clinical validity; real-participant research requires appropriate review and consent.

## 7. Data, privacy, and configuration

The application is local-first. Profile, chats, memory, saved explanations, questions, check-ins, journal entries, study data, procedure walkthrough progress, and related preferences are stored in browser local storage. The privacy page provides browser-data export and deletion. If Supabase is configured and the user signs in, selected state can sync to the user's account across devices; users can also sign out or erase cloud data.

When a question is sent to the server, its text, profile context, and optional notes may be sent to the configured model provider for response generation. The app supports OpenRouter and Gemini through server-side keys. Optional research sharing is off by default and sends structured measurements rather than question/answer text or profile notes; consent and appropriate study approval are required. Shared rows are pseudonymized, not anonymous. On account switching, local synced account data is cleared before the next account is pulled. Device-only settings remain local.

Relevant deployment configuration includes `OPENROUTER_API_KEY` and/or `GEMINI_API_KEY`, with `LLM_PROVIDER` available to select a provider, plus `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for cloud sync. Without model credentials, supported topics still work through the template engine. Without Supabase configuration, the app remains local-only.

## 8. Application routes

The primary navigation groups routes as follows:

- **Learn:** Dashboard, My care journey, Procedure explorer, Anatomy, Medical words.
- **Support:** Feelings, Questions, Family & school.
- **Research:** Comprehension study, Protocol & power, Evaluation harness, Data analysis, role-gated Research dashboard, Compare ages, Literature map, Audit log, role-gated Clinician review, Method, Paper draft.
- **Multi-role:** Patient sharing controls are on My care journey; Caregiver and Administrator workspaces are available at `/caregiver` and `/admin`.
- **You:** Personalization history, Session report, Saved explanations, Profile, Account & sync, Privacy & data.
- **Chat:** available as the main interaction, with conversation navigation and export actions.

## 9. Readiness against the full product specification

The repository now contains implementations for role-gated patient, caregiver, clinician, researcher, and administrator workflows. Database policies and scoped RPCs are the intended security boundary; page-level role gates alone do not provide authorization. These workflows are **not live or deployment-verified** until the new migration is applied, role claims are securely provisioned, and separate-role integration tests pass in the target Supabase project.

The following requirements have a code-level implementation:

- Role claims are read from trusted Supabase `app_metadata`; self-editable user metadata cannot grant access. RLS policies scope sensitive records, and review/invitation mutations use role-checked RPCs.
- Caregiver links require patient assent, guardian-permission, and caregiver-consent confirmations, use expiring one-time invite codes, allow revocation by either party, and expose only explicitly shared topic and walkthrough IDs.
- Administrators can stage immutable content versions; a different authenticated clinician can approve, reject, or request revision with structured ratings. Chat retrieval uses the newest validated approved version for a matched topic, otherwise it falls back to the built-in source-linked draft and may report a retrieval warning.
- Researcher-role accounts can read pseudonymized structured export views and download bounded CSV exports. Existing local dashboards and study tools remain available separately.
- Historical device-local clinician-rating analyses are explicitly labeled unverified and are not represented as the authenticated review workflow.
- Cloud data erasure includes new account-owned workflow data; retained content versions are detached from deleted author/reviewer identities.

The following requirements are **not implemented as production features** and must not be presented as complete:

- Migration application, live Supabase/PostgreSQL verification, role-by-role integration tests, production role provisioning, and independently verified clinician credentials or legal guardian consent.
- Per-conversation sharing, clinician escalation queues, access to patient-specific clinical records, patient-specific care plans, or shared clinical care-team workflows. The caregiver surface is limited to educational activity identifiers.
- Live medical web search/RAG, claim-level evidence validation, automatic evidence freshness checks, or a full knowledge-base search interface. Versioned clinician review does not itself establish that sources support every generated statement.
- A verified community-benefit directory with eligibility and freshness checks; caregiver resource pages are informational rather than a managed referral service.
- A verified community-benefit directory with eligibility and freshness checks; caregiver resource pages are informational rather than a managed referral service.
- Production-grade AI quality evaluation, model token/cost accounting and spend controls, or full outcome/psychosocial measurement.
- Full accessibility/voice requirements such as diagrams for every topic, adjustable speech speed, pause/resume audio, comprehensive captions, and validated mobile/accessibility testing.

Vercel environment variables alone do not activate these features. Apply migrations in order using [the Supabase setup guide](./supabase/README.md), provision verified roles, test RLS and RPC behavior, and obtain required research/clinical/privacy governance approvals before use with real participants. No Supabase project was accessed or migration applied during this work.

## 10. Verification and known limitations

The source-link implementation is checked for topic-to-source coverage. Current verification: `npm test` passed all 144 tests across 13 files; `npm run typecheck`, `npm run build`, and `git diff --check` passed. Tests cover profile sanitization, citations in supported prompts and replies, unsupported-topic no-generation behavior, adaptation context, safety redirects, route validation, report behavior, role-claim parsing, content-version validation, account-switch cleanup, and learning-journey summaries. SQL syntax and policy behavior have not been tested against PostgreSQL or a Supabase project.

Important limitations:

1. Built-in educational text is draft until a clinician-approved version is staged in a configured, migrated Supabase project. If none exists, chat intentionally falls back to the built-in draft.
2. The catalog is curated and static; the app does not conduct live web searches.
3. Citation display is topic-level, not a per-sentence fact-check.
4. Readability and coverage are proxies; no validated child comprehension or clinical accuracy evaluation is implied.
5. Age targets and communication adaptations are design heuristics and self-selected preferences, not prescriptions for people with particular conditions.
6. Language-model content, translations, automated safety checks, mental-health prompts, and resource freshness require ongoing expert review.
7. Caregiver consent is self-attested; this feature does not verify identities, guardianship, or legal authorization.
8. Research exports are pseudonymized and bounded, not anonymous or a complete study data warehouse. The researcher dashboards make no causal or clinical-effectiveness claims.

## 11. Summary

Onconnect currently combines pediatric oncology topic guides, medical vocabulary, procedure walkthroughs, a source-linked adaptive chat, browser-based learning tools, family/support resources, privacy controls, and code-level multi-role workflows for education sharing, content review, and research reporting. Adaptation uses explicit profile choices and chat feedback rather than inferred diagnoses. Answers for supported topics display mapped source links; unsupported medical topics do not receive model-generated answers. The app remains a research prototype and does not provide personalized medical advice or live source search. The multi-role database workflows must not be considered active until the migration is applied and verified in a configured Supabase project.
