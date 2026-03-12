"""Tests for document ID validation."""

import pytest

from api.storage.validation import InvalidDocumentIdError, validate_document_id


class TestValidateDocumentId:
    def test_valid_alphanumeric_id(self):
        assert validate_document_id("abc123") == "abc123"

    def test_valid_id_with_hyphens_and_underscores(self):
        assert validate_document_id("trail-id_123") == "trail-id_123"

    def test_valid_id_with_swedish_chars(self):
        assert validate_document_id("kantarell-röd") == "kantarell-röd"

    def test_valid_id_with_dots(self):
        assert validate_document_id("some.trail.id") == "some.trail.id"

    def test_valid_id_with_parentheses(self):
        assert validate_document_id("trail (variant)") == "trail (variant)"

    def test_empty_string_raises(self):
        with pytest.raises(InvalidDocumentIdError, match="must not be empty"):
            validate_document_id("")

    def test_whitespace_only_raises(self):
        with pytest.raises(InvalidDocumentIdError, match="must not be empty"):
            validate_document_id("   ")

    def test_single_dot_raises(self):
        with pytest.raises(InvalidDocumentIdError, match="reserved name"):
            validate_document_id(".")

    def test_double_dot_raises(self):
        with pytest.raises(InvalidDocumentIdError, match="reserved name"):
            validate_document_id("..")

    def test_forward_slash_raises(self):
        with pytest.raises(InvalidDocumentIdError, match="path separators"):
            validate_document_id("a/b")

    def test_backslash_raises(self):
        with pytest.raises(InvalidDocumentIdError, match="path separators"):
            validate_document_id("a\\b")

    def test_too_long_raises(self):
        long_id = "a" * 1501
        with pytest.raises(InvalidDocumentIdError, match="exceeds maximum length"):
            validate_document_id(long_id)

    def test_max_length_accepted(self):
        max_id = "a" * 1500
        assert validate_document_id(max_id) == max_id

    def test_invalid_characters_raises(self):
        with pytest.raises(InvalidDocumentIdError, match="invalid characters"):
            validate_document_id("id<script>")

    def test_custom_field_name_in_error(self):
        with pytest.raises(InvalidDocumentIdError, match="Invalid spot_id"):
            validate_document_id("", field_name="spot_id")
