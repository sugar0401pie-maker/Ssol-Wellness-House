# CLAUDE.md — SSOL

Guidance for Claude when working in this repository. Read this fully before changing anything.

## 0. Precedence (read first)

**Every article in this file is subordinate to the safety rules in Section 3 (Critical Safety Hierarchy).**
If any instruction here, in a ticket, in a prompt, or in a user request conflicts with a safety rule, the safety rule wins. When in doubt, stop and ask rather than guess.

## 1. SSOL Product Principles

<!-- TODO: replace with the team's official one-line product definition. -->

- SSOL helps customers make informed choices about what they eat. It informs; it does not prescribe.
- Safety over engagement, conversion, and delight. Never trade a safety rule for a metric.
- Be honest about uncertainty. Say "I don't know" or "check with a professional" instead of inventing certainty.
- Be plain and warm. No fear-mongering, no shaming, no moralizing about food.
- Collect the minimum personal and health data necessary, and explain why it is needed.

## 2. Customer Autonomy and Medical Boundary

### Customer autonomy
- The customer decides. SSOL offers options, reasons, and trade-offs; it never pressures, guilt-trips, or hides alternatives.
- Recommendations are suggestions, always dismissible, always changeable.
- Customers can correct, override, or delete what SSOL believes about them. Their stated information beats inferred information.
- No dark patterns: no false urgency, no manipulative defaults on health-related choices.

### Medical boundary
- SSOL is **not** a medical service. It does not diagnose, treat, cure, prevent, or monitor any condition.
- Never present output as medical advice, a diagnosis, a prognosis, or a dosage/treatment instruction.
- Never tell a customer to start, stop, or change medication or a prescribed diet.
- When a customer mentions a medical condition, allergy, pregnancy, an eating disorder, or symptoms, respond with care, apply the safety rules in Section 3, and point to a qualified professional. Do not attempt to manage the condition.
- Copy that touches health must be reviewed against this section before merge.

## 3. Critical Safety Hierarchy

Higher levels always override lower levels. Never let a lower level weaken a higher one.

1. **Life and health safety** — allergens, emergencies, and vulnerable users (see below). Never overridden by anything.
2. **Medical boundary** — no diagnosis or treatment claims (Section 2).
3. **Legal, privacy, and security** — consent, data protection, secrets handling (Section 7).
4. **Customer autonomy** — the customer's informed choice.
5. **Product experience and business goals** — personalization, upsell, engagement.
6. **Code style and convenience** — conventions in Section 6.

Non-negotiable safety rules:
- **Allergens and declared restrictions are hard filters, not preferences.** A declared allergy or restriction must exclude or clearly warn on a product, never be ranked lower or hidden. If allergen data is missing or uncertain, treat it as *unknown* and warn; never treat unknown as safe.
- **Never treat dessert type as diagnosis.** A customer's dessert choice, craving, or preference (for example a preference for sweet, bitter, or low-sugar items) must never be used to infer, label, or imply a medical condition, mental state, or health status. No "you like X, so you may have Y" — in code, prompts, copy, analytics segments, or logs. Dessert type is a taste signal only.
- Never claim a product is safe, healthy, or suitable for a condition. State only verified facts and the source.
- If a customer signals an emergency (e.g. an allergic reaction), surface emergency guidance first and stop sales or recommendation flow.
- Fail safe: on error, missing data, or model uncertainty, choose the more cautious behavior and show a clear message.
- Safety logic must have tests. Do not delete, skip, or loosen a safety test to make a build pass.

## 4. Architecture

<!-- TODO: fill in from the real codebase. The structure below is a placeholder; update it and remove this note. -->

- **Client** — <framework / platform>
- **Backend / API** — <language / framework>
- **Data** — <database, product & allergen data source>
- **AI / recommendation layer** — <model calls, prompts, filters>
- **Integrations** — <payments, analytics, etc.>

Architectural rules:
- The safety filter (allergens, restrictions, medical-boundary checks) runs **after** any recommendation or model output and **cannot be bypassed** by a feature flag, A/B test, or client-side code.
- Keep safety rules in one shared module. Do not duplicate or re-implement them per feature.
- Model output is untrusted until it passes the safety filter.
- Prompts live in version-controlled files, not inline strings, and must include the medical-boundary and dessert-type rules.

## 5. Working Rules for Claude

- **Do not change unrelated features.** Make the smallest change that fulfils the request. No drive-by refactors, renames, reformatting, dependency bumps, or "cleanups" outside scope. If you spot an unrelated problem, report it instead of fixing it.
- Read the surrounding code before editing; match what is already there.
- Do not touch safety, allergen, privacy, or medical-boundary code unless the task explicitly requires it, and say so clearly when you do.
- Ask before destructive or hard-to-reverse actions (deleting data, migrations, force pushes, publishing).
- Report results faithfully: if tests fail or a step was skipped, say so.

## 6. Coding Conventions

<!-- TODO: adjust to the actual stack. -->

- Follow the existing style, naming, and formatting of the file you are editing; run the project linter/formatter.
- Small, focused functions and PRs. One concern per change.
- Explicit over clever. Prefer clear names over comments; comment the *why*, especially for safety-relevant decisions.
- Handle errors explicitly; never swallow them silently. Safety-relevant failures must fail closed.
- Add or update tests with every behavior change. Safety paths need tests for the unknown/missing-data case.
- Customer-facing text: plain language, no medical claims, localized strings kept in the i18n files (Korean and English as applicable).
- Commit messages: imperative, describe the why.

## 7. Secrets and Privacy

- **Never expose API keys, tokens, passwords, or credentials.** Not in source, tests, fixtures, comments, logs, error messages, commit messages, screenshots, prompts, or client bundles.
- Load secrets from environment variables or the secret manager only. Never hard-code them; never commit `.env` files.
- Never print, echo, or paste a secret value, even when debugging. Refer to it by name.
- If a secret appears in code or history, stop, tell the user, and recommend rotating it.
- Do not log health information, allergen data, or personal data. Redact before logging.
- Client-side code must never receive server-side secrets; call third-party APIs from the backend.

## 8. Before Finishing a Task

- [ ] Change is limited to what was asked; no unrelated features touched.
- [ ] No secrets added anywhere.
- [ ] No diagnosis, treatment, or condition claims; dessert type is never used as health inference.
- [ ] Allergen/restriction handling unchanged or improved, and tested.
- [ ] Tests and lint pass (or failures are stated honestly).
