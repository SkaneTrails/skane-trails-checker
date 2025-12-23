"""Tests for exception handling paths to increase coverage."""

from pathlib import Path
from unittest.mock import Mock, patch

import pandas as pd

from app.functions.foraging import Foraging
from app.functions.gpx import handle_uploaded_gpx
from app.functions.tracks import load_track_statuses, save_track_statuses


class TestForagingExceptions:
    """Test exception handling in foraging functions."""

    def test_load_foraging_types_with_corrupted_json(self, temp_dir) -> None:
        """Test loading foraging types from corrupted JSON file."""
        foraging = Foraging()
        # Create a corrupted JSON file
        test_path = temp_dir / "corrupted.json"
        test_path.write_text("{ invalid json content")

        with (
            patch("streamlit.warning"),  # Mock st.warning to avoid Streamlit context
            patch.object(foraging, "foraging_types_path", test_path),
        ):
            result = foraging.load_foraging_types()

        # Should return default types when JSON is corrupted
        assert isinstance(result, dict)
        assert len(result) > 0  # Should have default types

    def test_save_foraging_types_with_permission_error(self, temp_dir) -> None:
        """Test saving foraging types when write permission is denied."""
        foraging = Foraging()
        test_path = temp_dir / "readonly" / "types.json"

        # Create parent directory but make it read-only (simulating permission error)
        with (
            patch("streamlit.error"),  # Mock st.error
            patch.object(Path, "open", side_effect=PermissionError("Permission denied")),
            patch.object(foraging, "foraging_types_path", test_path),
        ):
            result = foraging.save_foraging_types({"Test": {"icon": "🧪"}})

        assert result is False

    def test_load_foraging_data_with_corrupted_csv(self, temp_dir) -> None:
        """Test loading foraging data from corrupted CSV file."""
        csv_file = temp_dir / "corrupted.csv"
        csv_file.write_text("month,type,lat\nJan,Mushroom,invalid_lat")  # Invalid data

        foraging = Foraging()
        with patch("streamlit.warning"):  # Mock st.warning
            result = foraging.load_foraging_data(str(csv_file))

        # Should return empty month dict when CSV is corrupted
        assert isinstance(result, dict)
        assert all(result[month] == [] for month in foraging.short_months)

    def test_save_foraging_data_with_io_error(self, temp_dir) -> None:
        """Test saving foraging data when IO error occurs."""
        foraging = Foraging()
        csv_file = temp_dir / "test.csv"

        data_dict = {month: [] for month in foraging.short_months}
        data_dict["Jan"] = [{"type": "Test", "lat": 56.0, "lng": 13.0, "notes": "", "date": "2025-01-01"}]

        with (
            patch("streamlit.error"),  # Mock st.error
            patch.object(pd.DataFrame, "to_csv", side_effect=OSError("Disk full")),
        ):
            result = foraging.save_foraging_data(data_dict, str(csv_file))

        assert result is False


class TestTrackExceptions:
    """Test exception handling in track functions."""

    def test_load_track_statuses_with_corrupted_csv(self, temp_dir) -> None:
        """Test loading track statuses from corrupted CSV."""
        csv_file = temp_dir / "corrupted.csv"
        csv_file.write_text("track_id,status,last_updated\ninvalid,data,here")

        with patch("streamlit.warning"):  # Mock st.warning
            result = load_track_statuses(str(csv_file))

        # Should return empty dict when CSV is corrupted
        assert result == {}

    def test_save_track_statuses_with_io_error(self, temp_dir) -> None:
        """Test saving track statuses when IO error occurs."""
        csv_file = temp_dir / "test.csv"
        track_status = {0: "To Explore", 1: "Explored!"}

        with (
            patch("streamlit.error"),  # Mock st.error
            patch.object(pd.DataFrame, "to_csv", side_effect=OSError("Disk full")),
        ):
            result = save_track_statuses(track_status, str(csv_file))

        assert result is False


class TestGPXUpload:
    """Test GPX file upload handling."""

    def test_handle_uploaded_gpx_successful_upload(self, temp_dir) -> None:
        """Test successful GPX file upload."""
        world_wide_path = temp_dir / "world_wide"
        skane_path = temp_dir / "skane"
        world_wide_path.mkdir()
        skane_path.mkdir()

        # Create mock uploaded file
        mock_file = Mock()
        mock_file.name = "test_track.gpx"
        mock_file.getvalue.return_value = b"""<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test">
    <trk>
        <name>Test Track</name>
        <trkseg>
            <trkpt lat="56.0" lon="13.0"></trkpt>
            <trkpt lat="56.1" lon="13.1"></trkpt>
        </trkseg>
    </trk>
</gpx>"""

        success, message = handle_uploaded_gpx(str(world_wide_path), str(skane_path), mock_file, is_world_wide=False)

        assert success is True
        assert "Successfully uploaded" in message
        assert (skane_path / "test_track.gpx").exists()

    def test_handle_uploaded_gpx_world_wide(self, temp_dir) -> None:
        """Test uploading to world-wide hikes directory."""
        world_wide_path = temp_dir / "world_wide"
        skane_path = temp_dir / "skane"
        world_wide_path.mkdir()
        skane_path.mkdir()

        mock_file = Mock()
        mock_file.name = "world_track.gpx"
        mock_file.getvalue.return_value = b"""<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test">
    <trk>
        <name>World Track</name>
        <trkseg>
            <trkpt lat="45.0" lon="10.0"></trkpt>
        </trkseg>
    </trk>
</gpx>"""

        success, _message = handle_uploaded_gpx(str(world_wide_path), str(skane_path), mock_file, is_world_wide=True)

        assert success is True
        assert (world_wide_path / "world_track.gpx").exists()
        assert not (skane_path / "world_track.gpx").exists()

    def test_handle_uploaded_gpx_invalid_gpx(self, temp_dir) -> None:
        """Test uploading invalid GPX file."""
        world_wide_path = temp_dir / "world_wide"
        skane_path = temp_dir / "skane"
        world_wide_path.mkdir()
        skane_path.mkdir()

        mock_file = Mock()
        mock_file.name = "invalid.gpx"
        mock_file.getvalue.return_value = b"This is not valid GPX content"

        success, message = handle_uploaded_gpx(str(world_wide_path), str(skane_path), mock_file, is_world_wide=False)

        assert success is False
        assert "Error uploading file" in message
        # Verify temp file was cleaned up
        assert not (skane_path / "invalid.gpx").exists()

    def test_handle_uploaded_gpx_cleanup_on_error(self, temp_dir) -> None:
        """Test that temporary files are cleaned up on error."""
        world_wide_path = temp_dir / "world_wide"
        skane_path = temp_dir / "skane"
        world_wide_path.mkdir()
        skane_path.mkdir()

        mock_file = Mock()
        mock_file.name = "error.gpx"
        mock_file.getvalue.side_effect = Exception("Mock error during read")

        success, message = handle_uploaded_gpx(str(world_wide_path), str(skane_path), mock_file, is_world_wide=False)

        assert success is False
        assert "Error uploading file" in message
        # Verify no files left behind
        assert not (skane_path / "error.gpx").exists()


class TestSimplifyCoordinatesEdgeCases:
    """Test edge cases for coordinate simplification."""

    def test_simplify_with_empty_list(self) -> None:
        """Test coordinate simplification with empty list."""
        from app.functions.tracks import simplify_track_coordinates

        result = simplify_track_coordinates([])
        assert result == []

    def test_simplify_with_single_coordinate(self) -> None:
        """Test coordinate simplification with single coordinate."""
        from app.functions.tracks import simplify_track_coordinates

        coordinates = [(56.0, 13.0)]
        result = simplify_track_coordinates(coordinates)
        assert result == coordinates
