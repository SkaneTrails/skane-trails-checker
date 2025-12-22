"""Tests for Home page functions."""

import sys
from unittest.mock import Mock, patch

import pytest

from app._Home_ import HTTP_OK, get_weather


class TestModuleImport:
    """Test that the module can be imported safely."""

    def test_module_imports_without_streamlit_execution(self) -> None:
        """Test that importing _Home_ doesn't execute Streamlit UI code.

        This test verifies that the pytest guard prevents Streamlit commands
        from running during import. If st.set_page_config() or other UI code
        executes outside the guard, this test will fail.
        """
        # The import at the top of this file already proves this works,
        # but we explicitly verify pytest is in sys.modules
        assert "pytest" in sys.modules

        # Re-import to ensure no side effects
        import importlib

        import app._Home_ as home_module

        importlib.reload(home_module)

        # Verify we can access the business logic function
        assert callable(home_module.get_weather)
        assert home_module.HTTP_OK == 200


class TestGetWeather:
    """Test weather fetching functionality."""

    @patch("requests.get")
    def test_get_weather_success(self, mock_get) -> None:
        """Test successful weather data fetch."""
        mock_response = Mock()
        mock_response.status_code = HTTP_OK
        mock_response.json.return_value = {
            "daily": {
                "time": ["2025-01-01", "2025-01-02"],
                "temperature_2m_max": [10, 12],
                "temperature_2m_min": [2, 4],
                "weathercode": [0, 1],
                "precipitation_sum": [0.0, 1.5],
            }
        }
        mock_get.return_value = mock_response

        result = get_weather()

        assert result is not None
        assert "daily" in result
        assert "time" in result["daily"]
        mock_get.assert_called_once()

    @patch("requests.get")
    def test_get_weather_api_failure(self, mock_get) -> None:
        """Test weather fetch when API returns error status."""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_get.return_value = mock_response

        result = get_weather()

        assert result is None

    @patch("requests.get")
    def test_get_weather_request_exception(self, mock_get) -> None:
        """Test weather fetch when request raises exception."""
        mock_get.side_effect = Exception("Network error")

        # Should raise the exception (not caught in get_weather)
        with pytest.raises(Exception, match="Network error"):
            get_weather()

    @patch("requests.get")
    def test_get_weather_uses_correct_url(self, mock_get) -> None:
        """Test that weather fetch uses correct API URL."""
        mock_response = Mock()
        mock_response.status_code = HTTP_OK
        mock_response.json.return_value = {"daily": {}}
        mock_get.return_value = mock_response

        get_weather()

        # Verify the URL contains expected parameters
        call_args = mock_get.call_args[0][0]
        assert "api.open-meteo.com" in call_args
        assert "latitude=56.0" in call_args
        assert "longitude=13.5" in call_args
        assert "daily=temperature_2m_max,temperature_2m_min,weathercode" in call_args
        assert "timezone=Europe/Stockholm" in call_args
        assert "forecast_days=4" in call_args


class TestPytestGuardPresence:
    """Verify the pytest guard exists to prevent UI code execution during tests."""

    def test_pytest_guard_exists_in_source(self) -> None:
        """Verify the source file contains the pytest guard check.

        This test ensures the pytest guard ('pytest' not in sys.modules) exists
        in the source code. If someone removes it, this test will fail, preventing
        accidental Streamlit execution during imports.
        """
        from pathlib import Path

        home_file = Path(__file__).parent.parent / "app" / "_Home_.py"
        source = home_file.read_text(encoding="utf-8")

        # Verify the guard exists
        assert '"pytest" not in sys.modules' in source or "'pytest' not in sys.modules" in source

        # Verify st.set_page_config() appears AFTER the guard (not at module level)
        guard_pos = source.find('if "pytest" not in sys.modules:')
        if guard_pos == -1:
            guard_pos = source.find("if 'pytest' not in sys.modules:")

        config_pos = source.find("st.set_page_config(")

        assert guard_pos > 0, "Pytest guard not found in source"
        assert config_pos > guard_pos, "st.set_page_config() must appear after pytest guard"
