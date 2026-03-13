"""Tests for hike group API endpoints."""

from unittest.mock import patch

from api.models.hike_group import HikeGroupMember, HikeGroupResponse

OWNER = HikeGroupMember(uid="test-user", email="test@example.com", name="Test User", role="owner")
MEMBER = HikeGroupMember(uid="member-1", email="member@example.com", name="Member One", role="member")

SAMPLE_GROUP = HikeGroupResponse(
    group_id="group1",
    name="Weekend Hikers",
    members=[OWNER, MEMBER],
    created_by="test-user",
    created_at="2026-03-13T10:00:00",
    last_updated="2026-03-13T10:00:00",
)

SAMPLE_GROUP_OTHER_OWNER = HikeGroupResponse(
    group_id="group2",
    name="Other Group",
    members=[HikeGroupMember(uid="other-user", email="other@example.com", role="owner")],
    created_by="other-user",
    created_at="2026-03-13T10:00:00",
    last_updated="2026-03-13T10:00:00",
)


class TestListHikeGroups:
    @patch("api.routers.hike_groups.hike_group_storage.get_user_groups")
    def test_list_groups(self, mock_get, authenticated_client):
        mock_get.return_value = [SAMPLE_GROUP]
        response = authenticated_client.get("/api/v1/hike-groups")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Weekend Hikers"
        mock_get.assert_called_once_with("test-user")

    @patch("api.routers.hike_groups.hike_group_storage.get_user_groups")
    def test_list_groups_empty(self, mock_get, authenticated_client):
        mock_get.return_value = []
        response = authenticated_client.get("/api/v1/hike-groups")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_groups_unauthenticated(self, unauthenticated_client):
        response = unauthenticated_client.get("/api/v1/hike-groups")
        assert response.status_code == 401


class TestCreateHikeGroup:
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.save_hike_group")
    def test_create_group(self, mock_save, mock_get, authenticated_client):
        mock_save.return_value = "new-group-id"
        mock_get.return_value = HikeGroupResponse(
            group_id="new-group-id", name="Trail Blazers", members=[OWNER], created_by="test-user"
        )

        response = authenticated_client.post("/api/v1/hike-groups", json={"name": "Trail Blazers"})
        assert response.status_code == 201
        data = response.json()
        assert data["group_id"] == "new-group-id"
        assert data["name"] == "Trail Blazers"

        saved_data = mock_save.call_args[0][0]
        assert saved_data["name"] == "Trail Blazers"
        assert saved_data["created_by"] == "test-user"
        assert saved_data["members"][0]["role"] == "owner"

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.save_hike_group")
    def test_create_group_fallback(self, mock_save, mock_get, authenticated_client):
        mock_save.return_value = "new-group-id"
        mock_get.return_value = None

        response = authenticated_client.post("/api/v1/hike-groups", json={"name": "Hikers"})
        assert response.status_code == 201
        data = response.json()
        assert data["group_id"] == "new-group-id"
        assert len(data["members"]) == 1
        assert data["members"][0]["role"] == "owner"

    def test_create_group_empty_name(self, authenticated_client):
        response = authenticated_client.post("/api/v1/hike-groups", json={"name": ""})
        assert response.status_code == 422

    def test_create_group_name_too_long(self, authenticated_client):
        response = authenticated_client.post("/api/v1/hike-groups", json={"name": "x" * 51})
        assert response.status_code == 422

    def test_create_group_unauthenticated(self, unauthenticated_client):
        response = unauthenticated_client.post("/api/v1/hike-groups", json={"name": "Test"})
        assert response.status_code == 401


class TestGetHikeGroup:
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_get_group(self, mock_get, authenticated_client):
        mock_get.return_value = SAMPLE_GROUP
        response = authenticated_client.get("/api/v1/hike-groups/group1")
        assert response.status_code == 200
        assert response.json()["name"] == "Weekend Hikers"

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_get_group_not_found(self, mock_get, authenticated_client):
        mock_get.return_value = None
        response = authenticated_client.get("/api/v1/hike-groups/nonexistent")
        assert response.status_code == 404

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_get_group_not_member(self, mock_get, authenticated_client):
        mock_get.return_value = SAMPLE_GROUP_OTHER_OWNER
        response = authenticated_client.get("/api/v1/hike-groups/group2")
        assert response.status_code == 403


class TestUpdateHikeGroup:
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.update_hike_group")
    def test_update_group_name(self, mock_update, mock_get, authenticated_client):
        mock_get.side_effect = [SAMPLE_GROUP, SAMPLE_GROUP]
        response = authenticated_client.patch("/api/v1/hike-groups/group1", json={"name": "New Name"})
        assert response.status_code == 200
        mock_update.assert_called_once()

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_update_group_not_owner(self, mock_get, authenticated_client):
        mock_get.return_value = SAMPLE_GROUP_OTHER_OWNER
        response = authenticated_client.patch("/api/v1/hike-groups/group2", json={"name": "New"})
        assert response.status_code == 403

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_update_group_no_fields(self, mock_get, authenticated_client):
        mock_get.return_value = SAMPLE_GROUP
        response = authenticated_client.patch("/api/v1/hike-groups/group1", json={})
        assert response.status_code == 400

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.update_hike_group")
    def test_update_group_get_returns_none(self, mock_update, mock_get, authenticated_client):
        mock_get.side_effect = [SAMPLE_GROUP, None]
        response = authenticated_client.patch("/api/v1/hike-groups/group1", json={"name": "New"})
        assert response.status_code == 200


class TestDeleteHikeGroup:
    @patch("api.routers.hike_groups.hike_group_storage.delete_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_delete_group(self, mock_get, mock_delete, authenticated_client):
        mock_get.return_value = SAMPLE_GROUP
        response = authenticated_client.delete("/api/v1/hike-groups/group1")
        assert response.status_code == 204
        mock_delete.assert_called_once_with("group1")

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_delete_group_not_owner(self, mock_get, authenticated_client):
        mock_get.return_value = SAMPLE_GROUP_OTHER_OWNER
        response = authenticated_client.delete("/api/v1/hike-groups/group2")
        assert response.status_code == 403

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_delete_group_not_found(self, mock_get, authenticated_client):
        mock_get.return_value = None
        response = authenticated_client.delete("/api/v1/hike-groups/nonexistent")
        assert response.status_code == 404


class TestAddMember:
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.update_hike_group")
    def test_add_member(self, mock_update, mock_get, authenticated_client):
        group_with_owner_only = HikeGroupResponse(
            group_id="group1", name="Weekend Hikers", members=[OWNER], created_by="test-user"
        )
        updated_group = HikeGroupResponse(
            group_id="group1", name="Weekend Hikers", members=[OWNER, MEMBER], created_by="test-user"
        )
        mock_get.side_effect = [group_with_owner_only, updated_group]

        response = authenticated_client.post("/api/v1/hike-groups/group1/members", json={"email": "member@example.com"})
        assert response.status_code == 201
        assert len(response.json()["members"]) == 2

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_add_member_already_exists(self, mock_get, authenticated_client):
        mock_get.return_value = SAMPLE_GROUP
        response = authenticated_client.post("/api/v1/hike-groups/group1/members", json={"email": "member@example.com"})
        assert response.status_code == 409

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_add_member_not_owner(self, mock_get, authenticated_client):
        mock_get.return_value = SAMPLE_GROUP_OTHER_OWNER
        response = authenticated_client.post("/api/v1/hike-groups/group2/members", json={"email": "new@example.com"})
        assert response.status_code == 403

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_add_member_max_reached(self, mock_get, authenticated_client):
        full_group = HikeGroupResponse(
            group_id="group1",
            name="Full",
            members=[HikeGroupMember(uid=f"u{i}", email=f"u{i}@x.com", role="member") for i in range(20)],
            created_by="test-user",
        )
        mock_get.return_value = full_group
        response = authenticated_client.post("/api/v1/hike-groups/group1/members", json={"email": "new@example.com"})
        assert response.status_code == 400

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.update_hike_group")
    def test_add_member_email_normalized(self, mock_update, mock_get, authenticated_client):
        group = HikeGroupResponse(group_id="group1", name="Test", members=[OWNER], created_by="test-user")
        mock_get.side_effect = [group, group]

        authenticated_client.post("/api/v1/hike-groups/group1/members", json={"email": "  New@Example.COM  "})
        saved_members = mock_update.call_args[0][1]["members"]
        new_member = saved_members[-1]
        assert new_member["email"] == "new@example.com"
        assert "uid" not in new_member

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.update_hike_group")
    def test_add_member_get_returns_none(self, mock_update, mock_get, authenticated_client):
        group = HikeGroupResponse(group_id="group1", name="Test", members=[OWNER], created_by="test-user")
        mock_get.side_effect = [group, None]

        response = authenticated_client.post("/api/v1/hike-groups/group1/members", json={"email": "new@example.com"})
        assert response.status_code == 201


class TestRemoveMember:
    @patch("api.routers.hike_groups.hike_group_storage.update_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_remove_member(self, mock_get, mock_update, authenticated_client):
        mock_get.return_value = SAMPLE_GROUP
        response = authenticated_client.delete("/api/v1/hike-groups/group1/members/member@example.com")
        assert response.status_code == 204
        saved_members = mock_update.call_args[0][1]["members"]
        assert len(saved_members) == 1
        assert saved_members[0]["email"] == "test@example.com"

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_remove_self_as_owner(self, mock_get, authenticated_client):
        mock_get.return_value = SAMPLE_GROUP
        response = authenticated_client.delete("/api/v1/hike-groups/group1/members/test@example.com")
        assert response.status_code == 400

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_remove_nonexistent_member(self, mock_get, authenticated_client):
        mock_get.return_value = SAMPLE_GROUP
        response = authenticated_client.delete("/api/v1/hike-groups/group1/members/nonexistent@example.com")
        assert response.status_code == 404

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_remove_member_not_owner(self, mock_get, authenticated_client):
        mock_get.return_value = SAMPLE_GROUP_OTHER_OWNER
        response = authenticated_client.delete("/api/v1/hike-groups/group2/members/someone@example.com")
        assert response.status_code == 403


class TestHikeGroupStorage:
    """Tests for the storage layer mapping function."""

    def test_doc_to_hike_group(self):
        from api.storage.hike_group_storage import _doc_to_hike_group

        data = {
            "name": "Test Group",
            "members": [
                {"uid": "u1", "email": "a@b.com", "name": "Alice", "role": "owner"},
                {"uid": "u2", "email": "c@d.com", "name": None, "role": "member"},
            ],
            "created_by": "u1",
            "created_at": "2026-01-01T00:00:00",
            "last_updated": "2026-01-01T00:00:00",
        }

        result = _doc_to_hike_group("doc-id", data)
        assert result.group_id == "doc-id"
        assert result.name == "Test Group"
        assert len(result.members) == 2
        assert result.members[0].uid == "u1"
        assert result.members[0].role == "owner"
        assert result.members[1].name is None
        assert result.created_by == "u1"

    def test_doc_to_hike_group_defaults(self):
        from api.storage.hike_group_storage import _doc_to_hike_group

        result = _doc_to_hike_group("doc-id", {})
        assert result.group_id == "doc-id"
        assert result.name == ""
        assert result.members == []
        assert result.created_by == ""

    def test_doc_to_hike_group_missing_member_fields(self):
        from api.storage.hike_group_storage import _doc_to_hike_group

        data = {"members": [{"uid": "u1"}]}
        result = _doc_to_hike_group("doc-id", data)
        member = result.members[0]
        assert member.uid == "u1"
        assert member.email == ""
        assert member.name is None
        assert member.role == "member"
