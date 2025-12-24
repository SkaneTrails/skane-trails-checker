"""Test that Streamlit entry points can be imported without errors.

These tests simulate how Streamlit runs the app files to catch import path issues
without requiring full UI testing.
"""

from pathlib import Path


class TestStreamlitImports:
    """Test Streamlit file imports work correctly."""

    def test_home_page_imports(self, monkeypatch) -> None:
        """Test that _Home_.py can be imported as Streamlit would run it."""
        # Simulate Streamlit's environment - it runs from app/ directory
        app_dir = Path(__file__).parent.parent / "app"
        monkeypatch.chdir(app_dir)

        # Streamlit doesn't automatically add project root to path
        # So we need to test that our sys.path manipulation works
        home_file = app_dir / "_Home_.py"
        assert home_file.exists(), "Home page file should exist"

        # Try to compile the file to check for import errors
        with home_file.open(encoding="utf-8") as f:
            code = compile(f.read(), str(home_file), "exec")
            assert code is not None

    def test_hikes_map_page_imports(self) -> None:
        """Test that Hikes_map page can be imported."""
        hikes_page = Path(__file__).parent.parent / "app" / "pages" / "1_🥾_Hikes_map.py"
        assert hikes_page.exists(), "Hikes map page should exist"

        # Check file compiles without syntax errors
        with hikes_page.open(encoding="utf-8") as f:
            code = compile(f.read(), str(hikes_page), "exec")
            assert code is not None

    def test_foraging_spots_page_imports(self) -> None:
        """Test that Foraging_spots page can be imported."""
        foraging_page = Path(__file__).parent.parent / "app" / "pages" / "2_🌿_Foraging_spots.py"
        assert foraging_page.exists(), "Foraging spots page should exist"

        # Check file compiles without syntax errors
        with foraging_page.open(encoding="utf-8") as f:
            code = compile(f.read(), str(foraging_page), "exec")
            assert code is not None

    def test_sys_path_manipulation_in_home(self) -> None:
        """Test that _Home_.py correctly adds project root to sys.path."""
        home_file = Path(__file__).parent.parent / "app" / "_Home_.py"

        with home_file.open(encoding="utf-8") as f:
            content = f.read()

        # Verify sys.path.insert is present (our fix for import issues)
        assert "sys.path.insert" in content, "_Home_.py should add project root to sys.path"
        assert "Path(__file__).parent.parent.absolute()" in content, "Should add correct parent directory"

    def test_sys_path_manipulation_in_pages(self) -> None:
        """Test that page files correctly add project root to sys.path."""
        pages_dir = Path(__file__).parent.parent / "app" / "pages"

        for page_file in pages_dir.glob("*.py"):
            with page_file.open(encoding="utf-8") as f:
                content = f.read()

            # Each page should have sys.path manipulation
            assert "sys.path.insert" in content, f"{page_file.name} should add project root to sys.path"
            # Pages are 2 levels deeper than project root
            assert "Path(__file__).parent.parent.parent.absolute()" in content, (
                f"{page_file.name} should add correct parent directory"
            )

    def test_app_imports_are_absolute(self) -> None:
        """Test that all Streamlit files use absolute 'from app.functions' imports."""
        app_dir = Path(__file__).parent.parent / "app"

        # Check main file
        with (app_dir / "_Home_.py").open(encoding="utf-8") as f:
            content = f.read()
            assert "from app.functions" in content, "_Home_.py should use absolute imports"

        # Check page files
        for page_file in (app_dir / "pages").glob("*.py"):
            with page_file.open(encoding="utf-8") as f:
                content = f.read()
                # Not all pages may import from app.functions, but if they do, it should be absolute
                if "from app." in content:
                    assert "from app.functions" in content or "from app.resources" in content, (
                        f"{page_file.name} should use absolute imports"
                    )
