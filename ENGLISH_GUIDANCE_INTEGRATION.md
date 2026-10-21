# English guidance integration

The six files in `electron/english-guidance/` are the supplied v1.1 bundle, copied without edits. `english-guidance.cjs` adds their requirements to the shared assistant and inline correction service. AI Coach and existing native writing/translation handlers are unchanged.

Runtime:
- Assistant: generation followed by at most one reviewer call. The reviewer checks all authored English and grammar explanations, including Vietnamese explanations.
- Inline correction: review follows a detected correction; a no-error result has no generated correction/explanation to review.
- Verbatim-only requests supported by the exact-copy matcher use a deterministic check without a reviewer call.
- Reviewer cannot execute tools or modify a note action. Proposed note title/content are checked before persistence. The app generates a localized acknowledgement only after persistence; model-written success claims are discarded. A review failure leaves the conversation draft available and saves no note.
- Local language repairs can apply when schema, rule/severity, evidence, numeric tokens, modal/negation tokens and fenced-code invariants pass. These checks do not prove semantic equivalence. Other high-risk changes are withheld unless the exact-copy check can restore authoritative source text.
- Note action text is immutable to the reviewer: if its proposed contents require changes, no save occurs. A new user turn can request a correction. This initial implementation deliberately does not auto-apply reviewer rewrites to title/content payloads.
- No second linguistic review occurs after accepting a revision. Conversation messages store only version/status/completion/decision metadata; they do not claim an official band or independent validation.
- The assistant generation/review timeouts total at most 65 seconds (40 + 25), within the existing 75-second embedded bridge timeout.
- Timeout, invalid reviewer output and HTTP 429 never silently become pass. No automatic retry inside a gate.

Testing:
- `node --test electron/tests/*.test.cjs`
- `node scripts/evaluate-english-guidance.cjs --live` evaluates the supplied fixtures using the configured Groq key without printing it. HTTP 429 for case_27 is simulated; missing reviewer source metadata for case_25 and verbatim-only cases 15–17 are checked deterministically. Expected labels are withheld from the reviewer. Output is `models/test-fixtures/english-guidance-evaluation.json` (ignored by Git).
- This evaluation measures agreement with development fixtures, not independently validated IELTS accuracy. Semantic required_observations/forbidden_changes still need review beyond label matching.
