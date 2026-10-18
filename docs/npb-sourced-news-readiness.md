# Sourced NPB news and lifecycle events — readiness

User direction, 2026-10-18: periodically use AI to collect/summarize draft, FA, posting, signing, trade, joining/leaving and retirement context. Connect relevant information to Player, Team IN/OUT, Favorites and seasonal Home. Remain a baseball context product, not a general news reader (SPEC §news). Existing Google AI Pro and ChatGPT Plus subscriptions are available according to the owner; **account benefits/API access have not been inspected**.

## Proposed flow and boundaries

Permitted RSS/API/official release adapter → bounded incremental acquisition → URL/event dedupe → exact external-ID association → optional AI summary → deterministic validation → versioned bounded projection → app. Source documents are untrusted input, not execution instructions. Never execute article instructions or allow an article to choose tool destinations, commands, credentials or publish settings.

Store the minimum permitted structured data: event kind, independently identified player, source/destination club if explicit, announcement date, effective date if explicit, status (`official_announcement`, `reported`, `rumor`, `prediction`, `corrected`, `withdrawn`), evidence URLs/publisher/publication and acquisition times, summary/model/prompt version, and superseding event references. Missing fields stay null. Multiple publishers reporting the same rumor do not turn it into a formal transaction. A title/name match can suggest a quarantined candidate, not issue a canonical identity.

AI summaries cannot invent contract terms, dates, roster registrations, ages or facts absent from the evidence. Official announcements and media reports have visibly distinct statuses. Events must never automatically overwrite canonical memberships, registration, uniform numbers or certified Facts. Revisions/retractions preserve the earlier provenance and link the replacement; no silent rewrite. Home/My show small contextual lists with source links. AI outages/quota exhaustion preserve the last valid dataset and permit a minimal sourced event display.

## Rights/admission

The [Agency for Cultural Affairs](https://www.bunka.go.jp/seisaku/chosakuken/seidokaisetsu/chosakukensha_fumei/) distinguishes simple facts/data from protected works. That distinction does not remove a publisher's acquisition/contract/database restrictions. An AI paraphrase is not automatic republication permission. RSS availability is not, by itself, a license to scrape full articles, retain them indefinitely or publish generated substitutes.

Before enabling an adapter, record exact official terms, review date, permitted retrieval method/rate, storage/AI processing/public Web/Android use, attribution, third-party rights and revocation behavior. Use A/B sources only; C/D remain disabled. Prefer explicit permitted structured announcements and licensed snippets. Do not archive news bodies or images merely because they are public. No approved production news allowlist, news API key, collector or summary publication is claimed in this batch. No publisher contact or paid subscription is initiated.

## Existing subscriptions and zero-additional-cost paths

Official documentation checked 2026-10-18:

- [OpenAI plan/usage](https://learn.chatgpt.com/docs/pricing): Codex is included with ChatGPT Plus subject to usage limits; API-key calls follow API pricing. A Plus subscription is not an unlimited external OpenAI API budget.
- [Scheduled tasks](https://learn.chatgpt.com/docs/automations?surface=app): local project tasks require the PC/app running. This can support a bounded local research/draft run under the existing plan, but is not a guaranteed always-on server. No scheduled automation was created here. Proposed cadence should be agreed with actual permitted source update rates before activation.
- [Google Developer Program benefits](https://developers.google.com/program/plans-and-pricing): Google AI Pro is advertised with $10 monthly GenAI/Cloud credits. [Billing eligibility](https://developers.google.com/profile/help/faq) depends on the account's Cloud Billing plan; an initial prepaid balance may be necessary. Do not treat credits as an enforceable no-charge cap or activate billing/prepay without owner approval.
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing): some models have a separate limited free tier. It is a candidate for bounded server-side summarization only after owner-provided free credentials and input-processing terms are verified. Free quota and included Cloud credits are distinct. Model availability/limits can change; stop on quota errors, never silently switch to paid service or rotate accounts.

Public Pages/Android must never contain an AI key or subscription login. A future GitHub Actions collector can keep approved free credentials in existing secret storage and publish only validated output. Adding credentials/account registration is an owner setup step, not something hidden in a client build. No new secrets, paid project, payment method, purchased credits, browser-login automation or unofficial ChatGPT/Gemini endpoints are added here.

## Next reviewable increments

1. Evaluate a small official-source/RSS allowlist with operation-specific rights; freeze a synthetic event/summary contract and retraction/rumor/identity fixtures.
2. Build acquisition/summary adapters only for sources whose actual allowed use is established. Fixed request/token budgets, timeouts, idempotency and raw retention limits; shadow/draft output first.
3. Add contextual Player/Team/Home views with explicit status/evidence/last-checked dates; promote only validated data. Separate news/event readiness from Current statistical Production Gates.
4. Activate the chosen free automation after source admission, credential availability and safe publication behavior are verified. Uncertain claims remain unpublished; human review may be needed for exceptions without stopping unrelated features.

This original readiness record is superseded in part by the [first admitted Wikipedia event increment](npb-sourced-player-events.md): bounded licensed chronology records and a candidate-only daily check are now implemented. Media/RSS body ingestion, API-based AI summarization and automatic public promotion remain unimplemented; the earlier account/rights boundaries still apply. This does not remove pending full Career, farm/prospect, statistical coverage, signed-device or Play release gates.
