"""Tests for GPX handling functions."""

from app.functions.gpx import load_additional_gpx_files


def test_load_additional_gpx_files_nonexistent_directory() -> None:
    """Test that loading from a non-existent directory returns empty list."""
    result = load_additional_gpx_files("/path/that/does/not/exist")
    assert result == []


def test_load_additional_gpx_files_empty_directory(temp_data_dir) -> None:
    """Test that loading from an empty directory returns empty list."""
    result = load_additional_gpx_files(str(temp_data_dir))
    assert result == []


def test_load_additional_gpx_files_with_valid_gpx(temp_data_dir, sample_gpx_file) -> None:
    """Test loading a valid GPX file."""
    result = load_additional_gpx_files(str(temp_data_dir))

    assert len(result) == 1
    assert result[0]["name"] == "Test Track"
    assert result[0]["file"] == "test_track.gpx"
    assert len(result[0]["segments"]) == 1
    assert len(result[0]["segments"][0]) == 3  # 3 track points

    # Check coordinates
    coords = result[0]["segments"][0]
    assert coords[0] == (56.0, 13.0)
    assert coords[1] == (56.1, 13.1)
    assert coords[2] == (56.2, 13.2)


def test_load_additional_gpx_files_with_multiple_segments(temp_data_dir) -> None:
    """Test loading a GPX file with multiple segments."""
    gpx_content = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin Connect">
  <trk>
    <name>Multi-Segment Trail</name>
    <trkseg>
      <trkpt lat="56.0" lon="13.0"/>
      <trkpt lat="56.1" lon="13.1"/>
    </trkseg>
    <trkseg>
      <trkpt lat="56.2" lon="13.2"/>
      <trkpt lat="56.3" lon="13.3"/>
    </trkseg>
  </trk>
</gpx>"""

    gpx_file = temp_data_dir / "multi_segment.gpx"
    gpx_file.write_text(gpx_content, encoding="utf-8")

    result = load_additional_gpx_files(str(temp_data_dir))

    assert len(result) == 1
    assert len(result[0]["segments"]) == 2
    assert len(result[0]["segments"][0]) == 2
    assert len(result[0]["segments"][1]) == 2


def test_load_additional_gpx_files_with_invalid_gpx(temp_data_dir) -> None:
    """Test that invalid GPX files are skipped with warning."""
    invalid_file = temp_data_dir / "invalid.gpx"
    invalid_file.write_text("This is not valid GPX content")

    # Should not raise an exception, but return empty list
    result = load_additional_gpx_files(str(temp_data_dir))
    assert result == []
