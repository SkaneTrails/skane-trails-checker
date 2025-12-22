"""Tests for Home page functions."""

from unittest.mock import Mock, patch

import pytest

from app._Home_ import HTTP_OK, get_weather


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
