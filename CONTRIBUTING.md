# Contributing to Skåne Trails Checker

Thank you for your interest in contributing! This document explains how to contribute to the project.

## Getting Started

### Prerequisites

- Python 3.14+
- [UV package manager](https://github.com/astral-sh/uv)
- Git

### Setup

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/skane-trails-checker.git
cd skane-trails-checker

# Install dependencies
uv sync

# Install pre-commit hooks
uv run pre-commit install
```

## Making Changes

### 1. Create a Feature Branch

Always create a new branch from `main`:

```bash
git checkout main
git pull
git checkout -b feat/your-feature-name
```

**Branch naming conventions:**

- `feat/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `chore/task-description` - Maintenance tasks
- `docs/description` - Documentation changes

### 2. Make Your Changes

- Write clear, self-documenting code
- Add tests for new functionality (aim for 70%+ coverage)
- Update documentation if needed
- Follow the code style guidelines below

### 3. Test Your Changes

```bash
# Run tests
uv run pytest

# Check coverage
uv run pytest --cov=app --cov-report=html

# Run linting
uv run ruff check --fix
uv run ruff format
```

### 4. Commit Your Changes

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>: <description>

[optional body]

[optional footer]
```

**Commit types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `chore:` - Maintenance (dependencies, config)
- `refactor:` - Code refactoring (no behavior change)
- `test:` - Adding or updating tests
- `ci:` - CI/CD changes
- `perf:` - Performance improvements

**Examples:**

```bash
git commit -m "feat: add CSV export for foraging spots"
git commit -m "fix: map not rendering after GPX upload"
git commit -m "docs: update installation instructions"
```

### 5. Push and Create Pull Request

```bash
git push -u origin feat/your-feature-name

# Create PR using GitHub CLI
gh pr create

# Or create PR via GitHub web interface
```

## Code Quality Standards

### Code Style

We use **Ruff** for linting and formatting:

- Line length: 120 characters
- Target: Python 3.13+
- Self-documenting code preferred (avoid inline comments unless explaining complex logic)

```bash
# Check and fix issues
uv run ruff check --fix

# Format code
uv run ruff format
```

### Pre-commit Hooks

Pre-commit hooks run automatically on every commit:

- `ruff` - Lint and format Python code
- `prettier` - Format JSON/YAML/Markdown
- `deptry` - Check for unused dependencies
- `actionlint` - Lint GitHub Actions workflows

Run manually:

```bash
uv run pre-commit run --all-files
```

### Testing Requirements

- **All new methods and modified functions must have tests**
- Target: 70%+ coverage for business logic
- Test both success and failure paths
- Use descriptive test names: `test_function_name_when_condition_then_expected_result`

Example:

```python
def test_parse_gpx_file_when_valid_then_returns_tracks(tmp_path):
    gpx_file = tmp_path / "test.gpx"
    gpx_file.write_text(VALID_GPX_CONTENT)

    tracks = parse_gpx_file(str(gpx_file))

    assert len(tracks) > 0
    assert tracks[0].name == "Expected Track Name"
```

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

## What to Contribute

### Good First Issues

Look for issues labeled `good first issue` in the [issue tracker](https://github.com/SkaneTrails/skane-trails-checker/issues).

### Ideas for Contributions

- **Bug fixes** - Report or fix issues you encounter
- **Documentation** - Improve README, guides, or inline documentation
- **Tests** - Add tests for uncovered code
- **Features** - See [GitHub Issues](https://github.com/SkaneTrails/skane-trails-checker/issues) for planned features
- **Performance** - Optimize GPX parsing, map rendering, or data loading

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
