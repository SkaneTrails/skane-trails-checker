# Contributing to Skåne Trails Checker

Thank you for your interest in contributing! This document covers the development
workflow. For local setup and environment configuration, see
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Getting Started

### Prerequisites

- Python 3.14+ and [UV](https://github.com/astral-sh/uv)
- Node.js 20+ and [pnpm](https://pnpm.io/) (for mobile/web app)
- Git and [gh CLI](https://cli.github.com/) (for PRs)

### Setup

```bash
# Clone or fork
git clone https://github.com/YOUR-USERNAME/skane-trails-checker.git
cd skane-trails-checker

# API dependencies
uv sync --extra dev
uv run pre-commit install

# Mobile dependencies
cd mobile
pnpm install
```

## Making Changes

### 1. Create a Feature Branch

Always create a new branch from `main`:

```bash
git switch main
git pull
git switch -c feat/your-feature-name
```

**Branch naming conventions:**

- `feat/feature-name` — New features
- `fix/bug-description` — Bug fixes
- `chore/task-description` — Maintenance tasks
- `docs/description` — Documentation changes

### 2. Write Tests First

All API and mobile changes should have corresponding tests.

```bash
# API tests (pytest)
uv run pytest --cov=app --cov=api --cov-report=term-missing

# Mobile tests (Vitest)
cd mobile && pnpm test
```

**Exceptions:** Terraform, config files, pure UI styling.

### 3. Commit Your Changes

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>
```

**Commit types:**

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation only
- `chore:` — Maintenance (dependencies, config)
- `refactor:` — Code refactoring (no behavior change)
- `test:` — Adding or updating tests
- `ci:` — CI/CD changes
- `perf:` — Performance improvements

### 4. Push and Create Pull Request

```bash
git push origin feat/your-feature-name
gh pr create
```

## Code Style

### Python

- **Formatter/Linter**: Ruff (configured in `pyproject.toml`)
- **Line length**: 120 characters
- **Type hints**: Use modern syntax (`list[str]` not `List[str]`)
- **Models**: Dataclasses with `@dataclass` decorator
- **Self-documenting code**: Avoid inline comments

```bash
uv run ruff check --fix
uv run ruff format
```

### TypeScript/React

- **Components**: Arrow function components
- **Hooks**: Custom hooks in `lib/hooks/`, tested in `__tests__/`
- **Styling**: NativeWind (Tailwind for React Native)

## Testing Requirements

- **All new methods and modified functions must have tests**
- Coverage threshold: 85% (enforced by `fail_under` in `pyproject.toml`)
- Test both success and failure paths
- Use descriptive test names: `test_function_name_when_condition_then_expected_result`

## Pull Request Process

1. **Ensure all CI checks pass:**

   - All tests pass
   - Code coverage maintained
   - Linting passes
   - Security scans pass

1. **Write a clear PR description:**

   - What problem does this solve?
   - What changes were made?
   - How was it tested?
   - Any breaking changes?

1. **Address review feedback promptly**

1. **Keep PRs focused:**

   - One feature/fix per PR
   - Avoid mixing refactoring with new features

1. **Squash and merge** (preferred) once approved

## Further Reading

- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — Environment setup, API endpoints, project structure
- [infra/environments/dev/README.md](infra/environments/dev/README.md) — Infrastructure bootstrap, CI/CD, Terraform

### Not Sure Where to Start?

- Check the [issue tracker](https://github.com/SkaneTrails/skane-trails-checker/issues)
- Look at TODOs in the code
- Improve test coverage
- Update documentation

## Development Tips

### Running the App Locally

```bash
uv run streamlit run app/_Home_.py
```

The app opens at `http://localhost:8501`

### Debugging

- Enable debug logging in the code
- Check `app_debug.log` for error details
- Use `streamlit run app/_Home_.py --logger.level=debug` for verbose output
- See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for common issues

### Project Architecture

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for:

- Project structure
- Data flow patterns
- Key functions and modules
- Performance considerations

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

## Questions?

- Check [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- Check [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- Open a [GitHub Issue](https://github.com/SkaneTrails/skane-trails-checker/issues)
- Ask in your pull request

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
