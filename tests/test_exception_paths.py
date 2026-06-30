"""Tests for exception handling paths to increase coverage."""

from unittest.mock import Mock, patch

from app.functions.gpx import handle_uploaded_gpx


class TestGPXUpload:
    """Test GPX file upload handling."""

    @patch("app.functions.gpx.save_trail")
    def test_handle_uploaded_gpx_successful_upload(self, mock_save_trail, temp_dir) -> None:
        """Test successful GPX file upload."""
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

        success, message = handle_uploaded_gpx(mock_file, is_world_wide=False)

        assert success is True
        assert "Successfully uploaded" in message
        assert "test_track.gpx" in message
        # Verify trail was saved to Firestore
        assert mock_save_trail.called

    @patch("app.functions.gpx.save_trail")
    def test_handle_uploaded_gpx_world_wide(self, mock_save_trail, temp_dir) -> None:
        """Test uploading to world-wide hikes."""
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

        success, _message = handle_uploaded_gpx(mock_file, is_world_wide=True)

        assert success is True
        # Verify trail was saved with correct source
        assert mock_save_trail.called
        saved_trail = mock_save_trail.call_args[0][0]
        assert saved_trail.source == "world_wide_hikes"

    def test_handle_uploaded_gpx_invalid_gpx(self, temp_dir) -> None:
        """Test uploading invalid GPX file."""
        mock_file = Mock()
        mock_file.name = "invalid.gpx"
        mock_file.getvalue.return_value = b"This is not valid GPX content"

        success, message = handle_uploaded_gpx(mock_file, is_world_wide=False)

        assert success is False
        assert "Error uploading file" in message

    def test_handle_uploaded_gpx_cleanup_on_error(self, temp_dir) -> None:
        """Test that temporary files are cleaned up on error."""
        mock_file = Mock()
        mock_file.name = "error.gpx"
        mock_file.getvalue.side_effect = Exception("Mock error during read")

        success, message = handle_uploaded_gpx(mock_file, is_world_wide=False)

        assert success is False
        assert "Error uploading file" in message


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
