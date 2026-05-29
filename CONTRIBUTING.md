# Contributing to CiderScope

First off, thank you for considering contributing to CiderScope!

## Development Workflow

1. **Local Setup:** Follow the instructions in the `README.md` to run the project locally.
2. **Branching:** Create a new branch for your feature or bugfix (e.g., `feature/add-new-chart`, `fix/login-bug`).
3. **Coding Standards:**
   - Write clean, strongly typed TypeScript code.
   - Use Tailwind CSS for styling via utility classes or `@import` for global configuration.
   - Do not commit any secrets or real `.env` variables.
4. **Validation:**
   Before pushing, ensure all checks pass by running the local CI command:
   ```bash
   npm run ci
   ```
   This will run linting, typechecking, and tests.

## Pull Requests

1. Push your branch to GitHub.
2. Open a Pull Request targeting the `main` branch.
3. Provide a clear description of the changes.
4. Wait for code review and CI checks (GitHub Actions) to pass.

## Security Rules

- **NO SECRETS:** Never hardcode API keys, passwords, or Supabase credentials in your code.
- Ensure all environment variables are documented in `README.md` and only local `.env.local` files are used for testing.

## Making changes as an AI Agent

Please refer to `AGENTS.md` and `CLAUDE.md` for specific rules regarding automated modifications. Modification of application code without explicit user consent is strictly prohibited.
