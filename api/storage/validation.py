"""Validation helpers for Firestore storage operations."""

import re

_MAX_DOC_ID_BYTES = 1500
_DOC_ID_PATTERN = re.compile(r"[\w\-. åäöÅÄÖ()]+")


class InvalidDocumentIdError(Exception):
    """Raised when a Firestore document ID fails validation."""


def validate_document_id(doc_id: str, *, field_name: str = "document ID") -> str:
    """Validate a Firestore document ID.

    Rejects empty strings, path traversal attempts, and IDs with illegal characters.
    Returns the validated ID for convenience.

    Raises:
        InvalidDocumentIdError: If the document ID is invalid.
    """
    if not doc_id or not doc_id.strip():
        msg = f"Invalid {field_name}: must not be empty"
        raise InvalidDocumentIdError(msg)

    if doc_id != doc_id.strip():
        msg = f"Invalid {field_name}: must not have leading or trailing whitespace"
        raise InvalidDocumentIdError(msg)

    if doc_id in (".", ".."):
        msg = f"Invalid {field_name}: reserved name"
        raise InvalidDocumentIdError(msg)

    if "/" in doc_id or "\\" in doc_id:
        msg = f"Invalid {field_name}: must not contain path separators"
        raise InvalidDocumentIdError(msg)

    if len(doc_id.encode("utf-8")) > _MAX_DOC_ID_BYTES:
        msg = f"Invalid {field_name}: exceeds maximum length"
        raise InvalidDocumentIdError(msg)

    if not _DOC_ID_PATTERN.fullmatch(doc_id):
        msg = f"Invalid {field_name}: contains invalid characters"
        raise InvalidDocumentIdError(msg)

    return doc_id
