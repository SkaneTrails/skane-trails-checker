# Testing Guide

## Overview

This project uses **pytest** for testing. Tests are organized to cover three layers:

1. **Unit tests** - Pure business logic functions (GPX parsing, data management)
1. **API tests** - FastAPI endpoint and storage layer tests
1. **End-to-end tests** - Full workflow tests (planned)

## Running Tests

### Install Test Dependencies

```bash
uv sync
```

### Run All Tests

```bash
pytest
```

### Run with Coverage Report

```bash
pytest --cov=app --cov-report=html
```

### Run Specific Test File

```bash
pytest tests/test_gpx_functions.py -v
```

### Run Tests in VS Code

- Use the Test Explorer in the sidebar (flask icon)
- Tests should auto-discover after installing `pytest-xdist`
- Click the play button to run individual tests or entire suites

## Test Structure

```
tests/
├── conftest.py              # Shared fixtures for all tests
├── test_gpx_functions.py    # Tests for GPX file loading and parsing
├── test_track_functions.py  # Tests for track filtering, distance, simplification
├── test_exception_paths.py  # Tests for error handling paths
└── ...                      # Storage and API tests
```

## Key Fixtures (in conftest.py)

- `temp_data_dir` - Temporary directory for test files
- `sample_gpx_content` - Valid GPX XML content
- `sample_gpx_file` - Complete GPX file in temp directory

## Writing New Tests

### Testing Pure Functions

```python
def test_my_function():
    """Test description."""
    result = my_function(input_data)
    assert result == expected_output
```

### Using Fixtures

```python
def test_with_temp_file(temp_data_dir):
    """Test that uses a temporary directory."""
    test_file = temp_data_dir / "test.txt"
    test_file.write_text("content")
    # ... test logic
```

### Testing File Operations

```python
def test_save_data(temp_data_dir):
    """Test saving data to a file."""
    csv_file = temp_data_dir / "data.csv"
    result = save_function(data, str(csv_file))

    assert result is True
    assert csv_file.exists()
    # Verify content
```

## Testing API Endpoints

API tests use FastAPI's `TestClient` with fixtures from `conftest.py`:

```python
def test_get_trails(authenticated_client):
    """Test listing trails."""
    response = authenticated_client.get("/api/v1/trails")
    assert response.status_code == 200
```

## Coverage Goals

Current coverage focus:

- ✅ `app/functions/gpx.py` - GPX file handling
- ✅ `app/functions/tracks.py` - Track status management
- ✅ `app/functions/foraging.py` - Foraging data management
- ⏳ `api/routers/*.py` - API endpoint tests
- ⏳ Full workflow tests (E2E)

## CI/CD Integration

Tests can be run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Install uv
  uses: astral-sh/setup-uv@v4

- name: Install dependencies
  run: uv sync

- name: Run tests
  run: uv run pytest --cov=app --cov-report=xml
```

## Troubleshooting

### Tests not discovered in VS Code

1. Ensure `pytest-xdist` is installed: `uv sync`
1. Check Python interpreter is correct (bottom right of VS Code)
1. Reload VS Code window

### Import errors in tests

- Make sure you're in the project root when running pytest
- Check that `app/` is in the Python path (pytest handles this automatically)

### Coverage report location

- HTML report: `htmlcov/index.html` (open in browser)
- Terminal report: Shown after running `pytest --cov`
