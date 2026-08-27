# Contributing to @playerstack/core

Thanks for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/playerstack/core.git
cd core
npm install
```

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run build` | Build ESM, CJS, and type declarations |
| `npm run test` | Run tests |
| `npm run test:cov` | Run tests with coverage |
| `npm run lint` | Lint source files |
| `npm run clean` | Remove build artifacts |

## Workflow

1. Fork the repo and create a branch: `feat/my-feature` or `fix/42-bug-description`
2. Make changes in `src/` (TypeScript)
3. Write or update tests in `test/`
4. Verify: `npm run build && npm run test && npm run lint`
5. Open a PR with a conventional commit title

## Coding Standards

- Source is TypeScript in `src/`
- No React or framework dependencies allowed in this package
- All utilities must work in both browser and SSR contexts (guard `window`/`document` access)
- Follow existing code style (Prettier enforces formatting)

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(engine): add quality switching support
fix(utils): handle null URL in canPlay
chore(build): upgrade esbuild
```

Valid scopes: `engine`, `utils`, `i18n`, `patterns`, `build`
