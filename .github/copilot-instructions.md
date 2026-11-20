# Working on FORENSIQ

The React client in `frontend/` and the FastAPI service in `backend/app/` share one origin. Use SQLite for application state and tests. Local development starts at the repository root with `npm ci` and `npm run dev`. Account creation belongs on the opening screen. Preserve existing local data and users during upgrades.

- Trace each feature from its browser control through the API permission check to the database transaction. Preserve access checks on detail, list, export, search and count endpoints.
- Registering an evidence reference records metadata. Hash an uploaded file at intake and compare the stored bytes with that baseline on demand. Attribute each custody transfer and keep its history. Use the precise operation that occurred in labels and reports.
- Keep credentials and real case material out of prompts, fixtures, screenshots and commits. Use synthetic examples for debugging. Keep privileged keys and database connections on the server.
- Retain keyboard navigation, accessible form errors, readable text, theme switching and reduced-motion behavior. Treat the fingerprint as a visual exhibit.
- Run `npm test` and `npm run build`. Follow `docs/VERIFICATION.md` to run the API integration suite on a disposable SQLite database. Exercise migrations and access control when touching database or permission code.
- In review notes record which requirement changed, the affected source paths, the test actually run and any part requiring a live environment. The phase prompts in `docs/DESIGN-AND-WORKFLOW.md` can guide planning and review.
