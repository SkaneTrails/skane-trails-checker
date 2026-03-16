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

    def test_parse_auto_detects_skane_source(self):
        trails = parse_gpx_upload(VALID_GPX.encode("utf-8"))
        assert trails[0].source == "other_trails"

    def test_parse_auto_detects_worldwide_source(self):
        worldwide_gpx = (
            VALID_GPX.replace('lat="56.0"', 'lat="45.0"')
            .replace('lat="56.01"', 'lat="45.01"')
            .replace('lat="56.02"', 'lat="45.02"')
        )
        trails = parse_gpx_upload(worldwide_gpx.encode("utf-8"))
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

    def test_parse_strips_empty_elevation_tags(self):
        gpx_with_empty_ele = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Trail with empty ele</name>
    <trkseg>
      <trkpt lat="56.0" lon="13.0"><ele> </ele></trkpt>
      <trkpt lat="56.01" lon="13.01"><ele> </ele></trkpt>
      <trkpt lat="56.02" lon="13.02"><ele> </ele></trkpt>
    </trkseg>
  </trk>
</gpx>"""
        trails = parse_gpx_upload(gpx_with_empty_ele.encode("utf-8"))
        assert len(trails) == 1
        assert trails[0].elevation_gain is None
        assert trails[0].elevation_loss is None

    def test_parse_whitespace_only_name_becomes_unnamed(self):
        gpx_with_space_name = VALID_GPX.replace("<name>Test Trail</name>", "<name> </name>")
        trails = parse_gpx_upload(gpx_with_space_name.encode("utf-8"))
        assert trails[0].name == "Unnamed Trail 0"


class TestUploadGpxEndpoint:
    @patch("api.routers.trails.trail_storage.update_sync_metadata")
    @patch("api.routers.trails.trail_storage.save_trail")
    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_sets_created_by(self, mock_parse, mock_save, mock_sync, authenticated_client):
        trail = SAMPLE_TRAIL.model_copy()
        mock_parse.return_value = [trail]
        mock_save.return_value = None

        authenticated_client.post(
            "/api/v1/trails/upload",
            files={"file": ("trail.gpx", io.BytesIO(VALID_GPX.encode()), "application/gpx+xml")},
        )
        saved_trail = mock_save.call_args[0][0]
        assert saved_trail.created_by == "test-user"

    @patch("api.routers.trails.trail_storage.update_sync_metadata")
    @patch("api.routers.trails.trail_storage.save_trail")
    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_valid_gpx(self, mock_parse, mock_save, mock_sync, authenticated_client):
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
        mock_save.assert_called_once_with(SAMPLE_TRAIL, update_sync=False)
        mock_sync.assert_called_once()

    @patch("api.routers.trails.trail_storage.update_sync_metadata")
    @patch("api.routers.trails.trail_storage.save_trail")
    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_no_source_param(self, mock_parse, mock_save, mock_sync, authenticated_client):
        """Source param is no longer accepted — auto-detected from coordinates."""
        mock_parse.return_value = [SAMPLE_TRAIL]
        mock_save.return_value = None

        response = authenticated_client.post(
            "/api/v1/trails/upload",
            files={"file": ("trail.gpx", io.BytesIO(VALID_GPX.encode()), "application/gpx+xml")},
        )
        assert response.status_code == 201
        mock_parse.assert_called_once()

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

    @patch("api.routers.trails.trail_storage.update_sync_metadata")
    @patch("api.routers.trails.trail_storage.save_trail")
    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_ignores_source_query_param(self, mock_parse, mock_save, mock_sync, authenticated_client):
        """Source query param is silently ignored (not a validation error)."""
        mock_parse.return_value = [SAMPLE_TRAIL]
        mock_save.return_value = None

        response = authenticated_client.post(
            "/api/v1/trails/upload?source=planned_hikes",
            files={"file": ("trail.gpx", io.BytesIO(VALID_GPX.encode()), "application/gpx+xml")},
        )
        assert response.status_code == 201
        mock_parse.assert_called_once()

    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_invalid_gpx_content(self, mock_parse, authenticated_client):
        mock_parse.side_effect = ValueError("Invalid GPX file: not valid xml")

        response = authenticated_client.post(
            "/api/v1/trails/upload", files={"file": ("trail.gpx", io.BytesIO(b"not xml"), "application/gpx+xml")}
        )
        assert response.status_code == 400
        assert "Invalid GPX file" in response.json()["detail"]

    @patch("api.routers.trails.trail_storage.update_sync_metadata")
    @patch("api.routers.trails.trail_storage.save_trail")
    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_multiple_tracks(self, mock_parse, mock_save, mock_sync, authenticated_client):
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
        mock_sync.assert_called_once()

    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_gpx_no_valid_tracks(self, mock_parse, authenticated_client):
        mock_parse.side_effect = ValueError("No valid tracks found in GPX file")

        response = authenticated_client.post(
            "/api/v1/trails/upload",
            files={"file": ("empty_tracks.gpx", io.BytesIO(VALID_GPX.encode()), "application/gpx+xml")},
        )
        assert response.status_code == 400
        assert "No valid tracks" in response.json()["detail"]

    def test_upload_gpx_too_large(self, authenticated_client):
        oversized = b"x" * (10 * 1024 * 1024 + 1)
        response = authenticated_client.post(
            "/api/v1/trails/upload", files={"file": ("huge.gpx", io.BytesIO(oversized), "application/gpx+xml")}
        )
        assert response.status_code == 413
        assert "too large" in response.json()["detail"]
        assert "bytes" in response.json()["detail"]

    @patch("api.routers.trails.trail_storage.update_sync_metadata")
    @patch("api.routers.trails.trail_storage.save_trail")
    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_with_planned_status(self, mock_parse, mock_save, mock_sync, authenticated_client):
        """Upload with status=To Explore sets planned status on trails."""
        trail = SAMPLE_TRAIL.model_copy()
        mock_parse.return_value = [trail]
        mock_save.return_value = None

        response = authenticated_client.post(
            "/api/v1/trails/upload?status=To%20Explore",
            files={"file": ("trail.gpx", io.BytesIO(VALID_GPX.encode()), "application/gpx+xml")},
        )
        assert response.status_code == 201
        saved_trail = mock_save.call_args[0][0]
        assert saved_trail.status == "To Explore"

    @patch("api.routers.trails.trail_storage.update_sync_metadata")
    @patch("api.routers.trails.trail_storage.save_trail")
    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_defaults_to_explored_status(self, mock_parse, mock_save, mock_sync, authenticated_client):
        """Without status param, trails default to Explored!"""
        trail = SAMPLE_TRAIL.model_copy()
        mock_parse.return_value = [trail]
        mock_save.return_value = None

        response = authenticated_client.post(
            "/api/v1/trails/upload",
            files={"file": ("trail.gpx", io.BytesIO(VALID_GPX.encode()), "application/gpx+xml")},
        )
        assert response.status_code == 201
        saved_trail = mock_save.call_args[0][0]
        assert saved_trail.status == "Explored!"

    @patch("api.routers.trails.trail_storage.update_sync_metadata")
    @patch("api.routers.trails.trail_storage.save_trail")
    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_with_line_color(self, mock_parse, mock_save, mock_sync, authenticated_client):
        """Upload with line_color sets color on all trails."""
        trail = SAMPLE_TRAIL.model_copy()
        mock_parse.return_value = [trail]
        mock_save.return_value = None

        response = authenticated_client.post(
            "/api/v1/trails/upload?line_color=%23E53E3E",
            files={"file": ("trail.gpx", io.BytesIO(VALID_GPX.encode()), "application/gpx+xml")},
        )
        assert response.status_code == 201
        saved_trail = mock_save.call_args[0][0]
        assert saved_trail.line_color == "#E53E3E"

    @patch("api.routers.trails.trail_storage.update_sync_metadata")
    @patch("api.routers.trails.trail_storage.save_trail")
    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_without_line_color_leaves_none(self, mock_parse, mock_save, mock_sync, authenticated_client):
        """Without line_color, trail.line_color remains None."""
        trail = SAMPLE_TRAIL.model_copy()
        mock_parse.return_value = [trail]
        mock_save.return_value = None

        response = authenticated_client.post(
            "/api/v1/trails/upload",
            files={"file": ("trail.gpx", io.BytesIO(VALID_GPX.encode()), "application/gpx+xml")},
        )
        assert response.status_code == 201
        saved_trail = mock_save.call_args[0][0]
        assert saved_trail.line_color is None

    def test_upload_with_invalid_line_color(self, authenticated_client):
        """Upload with invalid line_color returns 400."""
        response = authenticated_client.post(
            "/api/v1/trails/upload?line_color=%23BADCOL",
            files={"file": ("trail.gpx", io.BytesIO(VALID_GPX.encode()), "application/gpx+xml")},
        )
        assert response.status_code == 400
        assert "Invalid color" in response.json()["detail"]

    @patch("api.routers.trails.trail_storage.update_sync_metadata")
    @patch("api.routers.trails.trail_storage.save_trail")
    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_with_is_public(self, mock_parse, mock_save, mock_sync, authenticated_client):
        """Upload with is_public=true makes trails publicly visible."""
        trail = SAMPLE_TRAIL.model_copy()
        mock_parse.return_value = [trail]
        mock_save.return_value = None

        response = authenticated_client.post(
            "/api/v1/trails/upload?is_public=true",
            files={"file": ("trail.gpx", io.BytesIO(VALID_GPX.encode()), "application/gpx+xml")},
        )
        assert response.status_code == 201
        saved_trail = mock_save.call_args[0][0]
        assert saved_trail.is_public is True

    @patch("api.routers.trails.trail_storage.update_sync_metadata")
    @patch("api.routers.trails.trail_storage.save_trail")
    @patch("api.routers.trails.parse_gpx_upload")
    def test_upload_is_public_defaults_to_false(self, mock_parse, mock_save, mock_sync, authenticated_client):
        """Without is_public param, trails default to private."""
        trail = SAMPLE_TRAIL.model_copy()
        mock_parse.return_value = [trail]
        mock_save.return_value = None

        response = authenticated_client.post(
            "/api/v1/trails/upload",
            files={"file": ("trail.gpx", io.BytesIO(VALID_GPX.encode()), "application/gpx+xml")},
        )
        assert response.status_code == 201
        saved_trail = mock_save.call_args[0][0]
        assert saved_trail.is_public is False

    def test_upload_rejects_invalid_status(self, authenticated_client):
        """Upload with invalid status returns 422."""
        response = authenticated_client.post(
            "/api/v1/trails/upload?status=Bad%20Status",
            files={"file": ("trail.gpx", io.BytesIO(VALID_GPX.encode()), "application/gpx+xml")},
        )
        assert response.status_code == 422
