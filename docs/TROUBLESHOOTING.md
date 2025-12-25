# Troubleshooting Guide

## App Crashes or Won't Start

If the Streamlit app crashes on your computer, follow these steps to help diagnose the issue:

### 1. Check the Debug Log

The app now creates a detailed debug log file: `app_debug.log`

**How to find it:**

- The file is created in the same directory where you run the `streamlit run` command
- On Windows: Usually `C:\git\skane-trails-checker\app_debug.log`
- On Linux/Mac: Usually in the project root directory

**What it contains:**

- Python version
- Current working directory
- App file location
- Streamlit version
- Any error messages and full tracebacks

### 2. Run the App and Capture Output

```bash
# Using UV (recommended)
uv run streamlit run app/_Home_.py 2>&1 | tee streamlit_output.txt

# Or with venv activated
streamlit run app/_Home_.py 2>&1 | tee streamlit_output.txt
```

This will:

- Show output in the terminal
- Save everything to `streamlit_output.txt`

### 3. Check Your Environment

Make sure you have:

```bash
# Check Python version (need 3.11+, ideally 3.13 or 3.14)
python --version

# Check if UV is installed
uv --version

# Check if dependencies are installed
uv sync

# Or with pip
pip list | grep streamlit
```

### 4. Common Issues

#### Issue: "ModuleNotFoundError: No module named 'streamlit'"

**Solution:**

```bash
uv sync
# Or: pip install -r requirements.txt
```

#### Issue: "st.set_page_config() can only be called once"

**Solution:** This is a bug that was fixed. Make sure you have the latest code:

```bash
git pull origin main
```

#### Issue: GPX files not loading

**Solution:** Check that the paths in `app/tracks_gpx/` are correct for your OS

- Windows uses backslashes: `C:\path\to\file`
- Linux/Mac use forward slashes: `/path/to/file`

The app should handle this automatically, but if not, check `app_debug.log` for path errors.

### 5. Share Debug Information

If the app still crashes, please share:

1. **The `app_debug.log` file** - Contains environment and error details
1. **Your Python version** - Run `python --version`
1. **Your OS** - Windows, Mac, Linux (which distro)
1. **How you're running it** - UV, venv, direct python, etc.
1. **The exact error message** - Copy from terminal or log file

### 6. Test Mode

You can verify the business logic works without running the UI:

```bash
# Run all tests
uv run pytest

# Run just the home page tests
uv run pytest tests/test_home.py -v

# Check coverage
uv run pytest --cov=app
```

If tests pass but the app crashes, it's likely an environment or Streamlit configuration issue.

### 7. Clean Start

Try a completely clean environment:

```bash
# Remove virtual environment
rm -rf .venv

# Reinstall everything
uv sync

# Try running again
uv run streamlit run app/_Home_.py
```

## Still Having Issues?

Open a GitHub issue with:

- Contents of `app_debug.log`
- Output of `uv run pytest -v`
- Your Python version and OS
- Steps you've tried from this guide
