"""Tests for track management functions."""

import pandas as pd

from app.functions.tracks import (
    load_track_statuses,
    save_track_statuses,
    simplify_track_coordinates,
)


def test_load_track_statuses_nonexistent_file():
    """Test loading track statuses from a non-existent file."""
    result = load_track_statuses("/path/that/does/not/exist.csv")
    assert result == {}


def test_load_track_statuses_valid_file(sample_track_status_csv):
    """Test loading track statuses from a valid CSV file."""
    result = load_track_statuses(str(sample_track_status_csv))

    assert len(result) == 2
    assert result[0] == "To Explore"
    assert result[1] == "Explored!"


def test_save_track_statuses(temp_data_dir):
    """Test saving track statuses to CSV."""
    track_status = {
        0: "To Explore",
        1: "Explored!",
        2: "To Explore",
    }

    csv_file = temp_data_dir / "test_status.csv"
    result = save_track_statuses(track_status, str(csv_file))

    assert result is True
    assert csv_file.exists()

    # Verify the content
    saved_data = pd.read_csv(csv_file)
    assert len(saved_data) == 3
    assert list(saved_data.columns) == ["track_id", "status", "last_updated"]
    assert saved_data.iloc[0]["track_id"] == 0
    assert saved_data.iloc[0]["status"] == "To Explore"


def test_simplify_track_coordinates_basic():
    """Test coordinate simplification with RDP algorithm."""
    coordinates = [
        (56.0, 13.0),
        (56.01, 13.01),
        (56.02, 13.02),
        (56.03, 13.03),
        (56.1, 13.1),
    ]

    result = simplify_track_coordinates(coordinates, tolerance=0.001)

    # Should have fewer points than original
    assert len(result) <= len(coordinates)
    # First and last points should be preserved
    assert tuple(result[0]) == coordinates[0]
    assert tuple(result[-1]) == coordinates[-1]


def test_simplify_track_coordinates_two_points():
    """Test that tracks with 2 or fewer points are not simplified."""
    coordinates = [(56.0, 13.0), (56.1, 13.1)]
    result = simplify_track_coordinates(coordinates)
    assert result == coordinates


def test_simplify_track_coordinates_single_point():
    """Test that tracks with a single point are not simplified."""
    coordinates = [(56.0, 13.0)]
    result = simplify_track_coordinates(coordinates)
    assert result == coordinates
