# Assistant API keys

Open **Cài đặt → AI & từ mới → API cho trợ lý AI**. Add a label and a Groq key, then press **Thêm key**. Up to three entries are supported. Added keys are saved immediately; the old **Lưu thiết lập AI** button applies to the AI Coach/default vocabulary settings above, not this list.

The assistant vault lives at `app.getPath('userData')/assistant-api-keys.json`. Secrets are encrypted through Electron safeStorage (Windows DPAPI) and the Settings API returns only masks. If encryption is unavailable, new secrets cannot be saved. An existing default Groq key is copied into the encrypted assistant vault when possible; its old AI Coach setting is retained for compatibility. New assistant keys are never copied into that legacy setting.

The shared assistant, inline correction and quality reviewer use the vault. AI Coach, vocabulary generation and the mature floating English tools keep their existing key/model paths.

Routing:
- Prefer available 120B slots across enabled keys, balancing recent use.
- 20B generation fallback is configured but off by default pending the separate IELTS quality evaluation. The user can explicitly enable it in Settings.
- The quality reviewer always uses 120B; enabling generation fallback does not downgrade the reviewer.
- At most six distinct key/model combinations for generation, three for review, within request deadlines (35s generation, 22s reviewer; per attempt at most 10s and subject to the caller's timeout).
- Respect Retry-After/reset metadata on 429; do not immediately retry the same cooling slot. Multiple keys in one Groq organization may share quotas.
- A 401 excludes that key until the user resets it by toggling. 403/404 cool the model slot, 5xx/network failures temporarily cool it, and invalid requests (400) do not rotate.
- Deleting a key removes it locally; it does not revoke the key at Groq. Disabling/removing all entries intentionally stops assistant egress rather than reverting to a hidden legacy key.

Tests:
- `node --test electron/tests/api-pool.test.cjs`
- `npm run test:api-settings` runs real Electron Settings UI with public fake keys, a temporary profile and mocked network. It tests native DPAPI encryption, masking, add/toggle/delete, 401 fallback and cross-window IPC restrictions.
- To exercise a packaged build: set `LEXFORGE_TEST_APP_ROOT` to its `resources/app.asar` before running the UI test.

No model-quality certification or new live-key account checks are performed by this setup. Actual requests validate credentials when used; IELTS testing of the fallback remains a separate task.
