# Local notes workspace implementation plan

Goal: Add an in-app notes workspace with local SQLite persistence, voice dictation, scoped AI edits, revision undo, trash and Markdown export. No floating assistant changes and no push.

Architecture: A notes store owns SQLite schema and validated operations; Electron IPC exposes named operations. A separate AI module receives only the selected note and its conversation, validates structured actions and uses revision checks. React displays list/editor/chat; a shared local recorder supports both existing AI Coach and notes.

1. Write failing real-SQLite tests for CRUD, revisions, trash, persistence and optimistic updates. Implement notes store and scoped AI actions with mocked network tests.
2. Wire IPC/preload and packaged files; add sidebar route and responsive notes page using existing app colors. Save local editor drafts, surface save errors, allow export/undo/restore.
3. Extract existing recorder for reuse. Add multilingual local speech model and language routing with regression tests; keep English AI Coach behavior.
4. Run Node/Jest/Python/TypeScript checks and production build. Verify workspace with isolated temporary database and synthetic voice. Restart app to load new IPC and leave changes uncommitted for user review.

Validation: real SQLite tests cover persistence, failed writes, revisions, trash and stale edits; AI tests use fake network and check selected-note scope. An isolated Electron run verified create/save/draft recovery/AI append/undo/trash/restore and synthetic local microphone transcription. Production build succeeds with the pre-existing VAD dependency source-map warnings.
