"""Tests for GPX file handling functions."""

from app.functions.gpx import load_additional_gpx_files


class TestLoadAdditionalGpxFiles:
    """Test loading GPX files from a directory."""

    def test_load_from_directory(self, temp_dir, sample_gpx_file) -> None:
        """Load GPX files from a directory."""
        tracks = load_additional_gpx_files(str(temp_dir))

        assert len(tracks) == 1
        assert tracks[0]["name"] == "Test Track"
        assert tracks[0]["file"] == "test_track.gpx"
        assert len(tracks[0]["segments"]) == 1
        assert len(tracks[0]["segments"][0]) == 3  # 3 track points

    def test_load_from_empty_directory(self, temp_dir) -> None:
        """Loading from empty directory should return empty list."""
        tracks = load_additional_gpx_files(str(temp_dir))
        assert tracks == []

    def test_load_from_nonexistent_directory(self, temp_dir) -> None:
        """Loading from non-existent directory should return empty list."""
        fake_dir = temp_dir / "nonexistent"
        tracks = load_additional_gpx_files(str(fake_dir))
        assert tracks == []

    def test_load_multiple_tracks_single_file(self, temp_dir) -> None:
        """GPX file with multiple tracks should load all tracks."""
        gpx_content = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test">
    <trk>
        <name>Track 1</name>
        <trkseg>
            <trkpt lat="56.0" lon="13.0"></trkpt>
            <trkpt lat="56.1" lon="13.1"></trkpt>
        </trkseg>
    </trk>
    <trk>
        <name>Track 2</name>
        <trkseg>
            <trkpt lat="57.0" lon="14.0"></trkpt>
            <trkpt lat="57.1" lon="14.1"></trkpt>
        </trkseg>
    </trk>
</gpx>"""
        gpx_file = temp_dir / "multi_track.gpx"
        gpx_file.write_text(gpx_content)

        tracks = load_additional_gpx_files(str(temp_dir))
        assert len(tracks) == 2
        assert tracks[0]["name"] == "Track 1"
        assert tracks[1]["name"] == "Track 2"

    def test_load_track_with_multiple_segments(self, temp_dir) -> None:
        """Track with multiple segments should load all segments."""
        gpx_content = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test">
    <trk>
        <name>Multi-segment Track</name>
        <trkseg>
            <trkpt lat="56.0" lon="13.0"></trkpt>
            <trkpt lat="56.1" lon="13.1"></trkpt>
        </trkseg>
        <trkseg>
            <trkpt lat="57.0" lon="14.0"></trkpt>
            <trkpt lat="57.1" lon="14.1"></trkpt>
        </trkseg>
    </trk>
</gpx>"""
        gpx_file = temp_dir / "multi_segment.gpx"
        gpx_file.write_text(gpx_content)

        tracks = load_additional_gpx_files(str(temp_dir))
        assert len(tracks) == 1
        assert len(tracks[0]["segments"]) == 2

    def test_skip_empty_segments(self, temp_dir) -> None:
        """Empty segments should not be included."""
        gpx_content = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test">
    <trk>
        <name>Track with empty segment</name>
        <trkseg>
            <trkpt lat="56.0" lon="13.0"></trkpt>
        </trkseg>
        <trkseg>
        </trkseg>
    </trk>
</gpx>"""
        gpx_file = temp_dir / "empty_segment.gpx"
        gpx_file.write_text(gpx_content)

        tracks = load_additional_gpx_files(str(temp_dir))
        assert len(tracks) == 1
        assert len(tracks[0]["segments"]) == 1  # Only one segment with data

    def test_skip_invalid_gpx_file(self, temp_dir) -> None:
        """Invalid GPX files should be skipped with warning (not crash)."""
        invalid_file = temp_dir / "invalid.gpx"
        invalid_file.write_text("This is not valid GPX XML")

        # Should not raise exception, just skip the file
        tracks = load_additional_gpx_files(str(temp_dir))
        assert tracks == []
