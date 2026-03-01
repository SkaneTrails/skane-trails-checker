"""Tests for GPX upload endpoint and parser service."""

import io
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.models.trail import Coordinate, TrailBounds, TrailResponse
from api.services.gpx_parser import parse_gpx_upload

client = TestClient(app)

VALID_GPX = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test"
     xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <time>2026-01-15T10:00:00Z</time>
  </metadata>
  <trk>
    <name>Test Trail</name>
    <trkseg>
      <trkpt lat="56.0" lon="13.0"><ele>100</ele></trkpt>
      <trkpt lat="56.01" lon="13.01"><ele>120</ele></trkpt>
      <trkpt lat="56.02" lon="13.02"><ele>110</ele></trkpt>
    </trkseg>
  </trk>
</gpx>"""

MULTI_TRACK_GPX = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test"
     xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Trail One</name>
    <trkseg>
      <trkpt lat="56.0" lon="13.0"><ele>100</ele></trkpt>
      <trkpt lat="56.01" lon="13.01"><ele>120</ele></trkpt>
    </trkseg>
  </trk>
  <trk>
    <name>Trail Two</name>
    <trkseg>
      <trkpt lat="57.0" lon="14.0"><ele>200</ele></trkpt>
      <trkpt lat="57.01" lon="14.01"><ele>220</ele></trkpt>
    </trkseg>
  </trk>
</gpx>"""

NO_TRACKS_GPX = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test"
     xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="56.0" lon="13.0"><name>Waypoint</name></wpt>
</gpx>"""

EMPTY_TRACK_GPX = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test"
     xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Empty Track</name>
    <trkseg></trkseg>
  </trk>
</gpx>"""

SAMPLE_TRAIL = TrailResponse(
    trail_id="abc123",
    name="Test Trail",
    difficulty="Unknown",
    length_km=1.5,
    status="Explored!",
    coordinates_map=[Coordinate(lat=56.0, lng=13.0), Coordinate(lat=56.02, lng=13.02)],
    bounds=TrailBounds(north=56.02, south=56.0, east=13.02, west=13.0),
    center=Coordinate(lat=56.01, lng=13.01),
    source="other_trails",
    last_updated="2026-01-15T10:00:00",
)


class TestParseGpxUpload:
    def test_parse_valid_gpx(self):
        trails = parse_gpx_upload(VALID_GPX.encode("utf-8"))
        assert len(trails) == 1
        trail = trails[0]
        assert trail.name == "Test Trail"
        assert trail.status == "Explored!"
        assert trail.source == "other_trails"
        assert trail.length_km > 0
        assert trail.elevation_gain is not None
        assert trail.elevation_loss is not None

    def test_parse_multi_track_gpx(self):
        trails = parse_gpx_upload(MULTI_TRACK_GPX.encode("utf-8"))
        assert len(trails) == 2
        assert trails[0].name == "Trail One"
        assert trails[1].name == "Trail Two"

    def test_parse_with_world_wide_source(self):
        trails = parse_gpx_upload(VALID_GPX.encode("utf-8"), source="world_wide_hikes")
        assert trails[0].source == "world_wide_hikes"

    def test_parse_with_metadata_time(self):
        trails = parse_gpx_upload(VALID_GPX.encode("utf-8"))
        assert trails[0].activity_date == "2026-01-15T10:00:00+00:00"

    def test_parse_invalid_xml(self):
        with pytest.raises(ValueError, match="Invalid GPX file"):
            parse_gpx_upload(b"not xml content")

    def test_parse_no_tracks(self):
        with pytest.raises(ValueError, match="GPX file contains no tracks"):
            parse_gpx_upload(NO_TRACKS_GPX.encode("utf-8"))

    def test_parse_empty_track_skipped(self):
        with pytest.raises(ValueError, match="No valid tracks found"):
            parse_gpx_upload(EMPTY_TRACK_GPX.encode("utf-8"))

    def test_parse_preserves_elevation_data(self):
        trails = parse_gpx_upload(VALID_GPX.encode("utf-8"))
        trail = trails[0]
        assert trail.elevation_gain is not None
        assert trail.elevation_loss is not None
        assert trail.elevation_gain >= 0
        assert trail.elevation_loss >= 0

    def test_parse_calculates_bounds(self):
        trails = parse_gpx_upload(VALID_GPX.encode("utf-8"))
        trail = trails[0]
        assert trail.bounds.south == pytest.approx(56.0)
        assert trail.bounds.north == pytest.approx(56.02)
        assert trail.bounds.west == pytest.approx(13.0)
        assert trail.bounds.east == pytest.approx(13.02)

    def test_parse_calculates_center(self):
        trails = parse_gpx_upload(VALID_GPX.encode("utf-8"))
        trail = trails[0]
        assert trail.center.lat == pytest.approx(56.01, abs=0.01)
        assert trail.center.lng == pytest.approx(13.01, abs=0.01)


class TestUploadGpxEndpoint:
    @patch("api.routers.trails.trail_storage.save_trail")
    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_valid_gpx(self, mock_parse, mock_save, authenticated_client):
        mock_parse.return_value = [SAMPLE_TRAIL]
        mock_save.return_value = None

        response = authenticated_client.post(
            "/api/v1/trails/upload",
            files={"file": ("trail.gpx", io.BytesIO(VALID_GPX.encode()), "application/gpx+xml")},
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Test Trail"
        assert data[0]["status"] == "Explored!"
        mock_save.assert_called_once_with(SAMPLE_TRAIL)

    @patch("api.routers.trails.trail_storage.save_trail")
    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_with_source_param(self, mock_parse, mock_save, authenticated_client):
        mock_parse.return_value = [SAMPLE_TRAIL]
        mock_save.return_value = None

        response = authenticated_client.post(
            "/api/v1/trails/upload?source=world_wide_hikes",
            files={"file": ("trail.gpx", io.BytesIO(VALID_GPX.encode()), "application/gpx+xml")},
        )
        assert response.status_code == 201
        mock_parse.assert_called_once()
        _, kwargs = mock_parse.call_args
        assert kwargs["source"] == "world_wide_hikes"

    def test_upload_non_gpx_file(self, authenticated_client):
        response = authenticated_client.post(
            "/api/v1/trails/upload", files={"file": ("trail.txt", io.BytesIO(b"not gpx"), "text/plain")}
        )
        assert response.status_code == 400
        assert "must be a .gpx file" in response.json()["detail"]

    def test_upload_no_filename(self, authenticated_client):
        response = authenticated_client.post(
            "/api/v1/trails/upload", files={"file": ("", io.BytesIO(b"content"), "application/octet-stream")}
        )
        assert response.status_code == 422

    def test_upload_empty_file(self, authenticated_client):
        response = authenticated_client.post(
            "/api/v1/trails/upload", files={"file": ("trail.gpx", io.BytesIO(b""), "application/gpx+xml")}
        )
        assert response.status_code == 400
        assert "empty" in response.json()["detail"]

    def test_upload_invalid_source(self, authenticated_client):
        response = authenticated_client.post(
            "/api/v1/trails/upload?source=planned_hikes",
            files={"file": ("trail.gpx", io.BytesIO(VALID_GPX.encode()), "application/gpx+xml")},
        )
        assert response.status_code == 422

    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_invalid_gpx_content(self, mock_parse, authenticated_client):
        mock_parse.side_effect = ValueError("Invalid GPX file: not valid xml")

        response = authenticated_client.post(
            "/api/v1/trails/upload", files={"file": ("trail.gpx", io.BytesIO(b"not xml"), "application/gpx+xml")}
        )
        assert response.status_code == 400
        assert "Invalid GPX file" in response.json()["detail"]

    @patch("api.routers.trails.trail_storage.save_trail")
    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_multiple_tracks(self, mock_parse, mock_save, authenticated_client):
        trail2 = SAMPLE_TRAIL.model_copy(update={"trail_id": "def456", "name": "Trail Two"})
        mock_parse.return_value = [SAMPLE_TRAIL, trail2]
        mock_save.return_value = None

        response = authenticated_client.post(
            "/api/v1/trails/upload",
            files={"file": ("multi.gpx", io.BytesIO(MULTI_TRACK_GPX.encode()), "application/gpx+xml")},
        )
        assert response.status_code == 201
        assert len(response.json()) == 2
        assert mock_save.call_count == 2

    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_gpx_no_valid_tracks(self, mock_parse, authenticated_client):
        mock_parse.side_effect = ValueError("No valid tracks found in GPX file")

        response = authenticated_client.post(
            "/api/v1/trails/upload",
            files={"file": ("empty_tracks.gpx", io.BytesIO(VALID_GPX.encode()), "application/gpx+xml")},
        )
        assert response.status_code == 400
        assert "No valid tracks" in response.json()["detail"]
