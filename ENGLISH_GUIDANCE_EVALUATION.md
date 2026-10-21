# English guidance v1.1 development evaluation

Model: openai/gpt-oss-120b

- Quality-status label agreement: 30/30.
- Task-completion label agreement: 23/30.
- Review service unavailable during the final evaluations: 0.
- Cases 15–17: deterministic verbatim checks. Case 25: missing-review-source metadata fixture. Case 27: simulated HTTP 429. Other cases use Groq.
- The evaluator checks status/completion labels. It does not prove every semantic required_observation or forbidden_change is satisfied.
- Development fixtures were used to refine instructions and rerun mismatches; this is not an independent or held-out evaluation.
- No expert IELTS assessment or official band certification was performed.

Remaining task-completion disagreements (diagnostic metadata, never action authorization):
- case_04: expected partial, observed complete.
- case_06: expected partial, observed complete.
- case_07: expected partial, observed complete.
- case_12: expected partial, observed complete.
- case_14: expected partial, observed complete.
- case_23: expected partial, observed complete.
- case_29: expected partial, observed complete.

Runtime note writes remain a separate workflow. Quality review cannot modify the note action; failed review performs no save.
