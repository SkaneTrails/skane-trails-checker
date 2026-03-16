"""Tests for admin API endpoints (group and member management)."""

from unittest.mock import patch

from api.models.hike_group import HikeGroupResponse
from api.storage.hike_group_storage import GroupMember

SAMPLE_GROUP = HikeGroupResponse(
    group_id="group1",
    name="Hemmestorp",
    created_by="su@example.com",
    created_at="2026-03-13T10:00:00",
    last_updated="2026-03-13T10:00:00",
)

SAMPLE_GROUP_2 = HikeGroupResponse(
    group_id="group2",
    name="Other Group",
    created_by="su@example.com",
    created_at="2026-03-13T10:00:00",
    last_updated="2026-03-13T10:00:00",
)


class TestGetCurrentUser:
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_me_with_group(self, mock_get, authenticated_client):
        mock_get.return_value = SAMPLE_GROUP
        response = authenticated_client.get("/api/v1/admin/me")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["role"] == "admin"
        assert data["group_id"] == "test-group"

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_me_with_group_not_found(self, mock_get, authenticated_client):
        mock_get.return_value = None
        response = authenticated_client.get("/api/v1/admin/me")
        assert response.status_code == 200
        data = response.json()
        assert data["group_id"] == "test-group"
        assert data["group_name"] is None

    def test_me_superuser(self, superuser_client):
        response = superuser_client.get("/api/v1/admin/me")
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "superuser"
        assert data["group_id"] is None

    def test_me_unauthenticated(self, unauthenticated_client):
        response = unauthenticated_client.get("/api/v1/admin/me")
        assert response.status_code == 401


class TestListGroups:
    @patch("api.routers.hike_groups.hike_group_storage.list_group_members")
    @patch("api.routers.hike_groups.hike_group_storage.get_all_hike_groups")
    def test_list_groups_superuser(self, mock_get, mock_members, superuser_client):
        mock_get.return_value = [SAMPLE_GROUP, SAMPLE_GROUP_2]
        mock_members.side_effect = [
            [
                GroupMember(email="a@test.com", group_id="group1", role="owner"),
                GroupMember(email="b@test.com", group_id="group1", role="member"),
            ],
            [],
        ]
        response = superuser_client.get("/api/v1/admin/groups")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["member_count"] == 2
        assert data[1]["member_count"] == 0

    def test_list_groups_forbidden_for_admin(self, authenticated_client):
        response = authenticated_client.get("/api/v1/admin/groups")
        assert response.status_code == 403

    def test_list_groups_forbidden_for_member(self, member_client):
        response = member_client.get("/api/v1/admin/groups")
        assert response.status_code == 403


class TestCreateGroup:
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.save_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.group_name_exists")
    def test_create_group(self, mock_exists, mock_save, mock_get, superuser_client):
        mock_exists.return_value = False
        mock_save.return_value = "new-group-id"
        mock_get.return_value = HikeGroupResponse(
            group_id="new-group-id", name="Trail Blazers", created_by="su@example.com"
        )

        response = superuser_client.post("/api/v1/admin/groups", json={"name": "Trail Blazers"})
        assert response.status_code == 201
        data = response.json()
        assert data["group_id"] == "new-group-id"
        assert data["name"] == "Trail Blazers"
        mock_save.assert_called_once_with("Trail Blazers", "su@example.com")

    @patch("api.routers.hike_groups.hike_group_storage.group_name_exists")
    def test_create_group_duplicate_name(self, mock_exists, superuser_client):
        mock_exists.return_value = True
        response = superuser_client.post("/api/v1/admin/groups", json={"name": "Existing"})
        assert response.status_code == 409

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.save_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.group_name_exists")
    def test_create_group_fallback(self, mock_exists, mock_save, mock_get, superuser_client):
        mock_exists.return_value = False
        mock_save.return_value = "new-id"
        mock_get.return_value = None

        response = superuser_client.post("/api/v1/admin/groups", json={"name": "Hikers"})
        assert response.status_code == 201
        assert response.json()["group_id"] == "new-id"

    def test_create_group_empty_name(self, superuser_client):
        response = superuser_client.post("/api/v1/admin/groups", json={"name": ""})
        assert response.status_code == 422

    def test_create_group_name_too_long(self, superuser_client):
        response = superuser_client.post("/api/v1/admin/groups", json={"name": "x" * 51})
        assert response.status_code == 422

    def test_create_group_forbidden_for_admin(self, authenticated_client):
        response = authenticated_client.post("/api/v1/admin/groups", json={"name": "Test"})
        assert response.status_code == 403

    def test_create_group_unauthenticated(self, unauthenticated_client):
        response = unauthenticated_client.post("/api/v1/admin/groups", json={"name": "Test"})
        assert response.status_code == 401


class TestGetGroup:
    @patch("api.routers.hike_groups.hike_group_storage.list_group_members")
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_get_group_as_member(self, mock_get, mock_members, authenticated_client):
        mock_get.return_value = HikeGroupResponse(group_id="test-group", name="My Group", created_by="su@example.com")
        mock_members.return_value = [GroupMember(email="admin@example.com", group_id="test-group", role="admin")]
        response = authenticated_client.get("/api/v1/admin/groups/test-group")
        assert response.status_code == 200
        assert response.json()["name"] == "My Group"
        assert response.json()["member_count"] == 1

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_get_group_not_found(self, mock_get, authenticated_client):
        mock_get.return_value = None
        response = authenticated_client.get("/api/v1/admin/groups/test-group")
        assert response.status_code == 404

    def test_get_group_wrong_group(self, authenticated_client):
        """Admin of test-group can't see other-group."""
        response = authenticated_client.get("/api/v1/admin/groups/other-group")
        assert response.status_code == 403

    @patch("api.routers.hike_groups.hike_group_storage.list_group_members")
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_get_group_superuser_any_group(self, mock_get, mock_members, superuser_client):
        mock_get.return_value = SAMPLE_GROUP
        mock_members.return_value = []
        response = superuser_client.get("/api/v1/admin/groups/group1")
        assert response.status_code == 200
        assert response.json()["member_count"] == 0


class TestUpdateGroup:
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.update_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.group_name_exists")
    def test_update_group_name(self, mock_exists, mock_update, mock_get, authenticated_client):
        mock_get.side_effect = [
            HikeGroupResponse(group_id="test-group", name="Old", created_by="su@example.com"),
            HikeGroupResponse(group_id="test-group", name="New Name", created_by="su@example.com"),
        ]
        mock_exists.return_value = False
        response = authenticated_client.patch("/api/v1/admin/groups/test-group", json={"name": "New Name"})
        assert response.status_code == 200
        mock_update.assert_called_once()

    def test_update_group_wrong_group(self, authenticated_client):
        response = authenticated_client.patch("/api/v1/admin/groups/other-group", json={"name": "New"})
        assert response.status_code == 403

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_update_group_no_fields(self, mock_get, authenticated_client):
        mock_get.return_value = HikeGroupResponse(group_id="test-group", name="Test", created_by="su@example.com")
        response = authenticated_client.patch("/api/v1/admin/groups/test-group", json={})
        assert response.status_code == 400

    def test_update_group_forbidden_for_member(self, member_client):
        response = member_client.patch("/api/v1/admin/groups/test-group", json={"name": "New"})
        assert response.status_code == 403

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.update_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.group_name_exists")
    def test_update_group_superuser(self, mock_exists, mock_update, mock_get, superuser_client):
        """Superuser can update any group."""
        mock_get.side_effect = [
            HikeGroupResponse(group_id="group1", name="Old", created_by="su@example.com"),
            HikeGroupResponse(group_id="group1", name="New", created_by="su@example.com"),
        ]
        mock_exists.return_value = False
        response = superuser_client.patch("/api/v1/admin/groups/group1", json={"name": "New"})
        assert response.status_code == 200

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_update_group_not_found(self, mock_get, superuser_client):
        mock_get.return_value = None
        response = superuser_client.patch("/api/v1/admin/groups/nonexistent", json={"name": "New"})
        assert response.status_code == 404

    @patch("api.routers.hike_groups.hike_group_storage.group_name_exists")
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_update_group_duplicate_name(self, mock_get, mock_exists, authenticated_client):
        mock_get.return_value = HikeGroupResponse(group_id="test-group", name="Old", created_by="su@example.com")
        mock_exists.return_value = True
        response = authenticated_client.patch("/api/v1/admin/groups/test-group", json={"name": "Taken"})
        assert response.status_code == 409


class TestDeleteGroup:
    @patch("api.routers.hike_groups.hike_group_storage.delete_hike_group")
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_delete_group_superuser(self, mock_get, mock_delete, superuser_client):
        mock_get.return_value = SAMPLE_GROUP
        response = superuser_client.delete("/api/v1/admin/groups/group1")
        assert response.status_code == 204
        mock_delete.assert_called_once_with("group1")

    def test_delete_group_forbidden_for_admin(self, authenticated_client):
        response = authenticated_client.delete("/api/v1/admin/groups/test-group")
        assert response.status_code == 403

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_delete_group_not_found(self, mock_get, superuser_client):
        mock_get.return_value = None
        response = superuser_client.delete("/api/v1/admin/groups/nonexistent")
        assert response.status_code == 404


class TestListMembers:
    @patch("api.routers.hike_groups.hike_group_storage.list_group_members")
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_list_members(self, mock_get, mock_list, authenticated_client):
        mock_get.return_value = HikeGroupResponse(group_id="test-group", name="G", created_by="su@example.com")
        mock_list.return_value = [GroupMember(email="user@example.com", group_id="test-group", role="member")]
        response = authenticated_client.get("/api/v1/admin/groups/test-group/members")
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["email"] == "user@example.com"

    def test_list_members_wrong_group(self, authenticated_client):
        response = authenticated_client.get("/api/v1/admin/groups/other-group/members")
        assert response.status_code == 403

    def test_list_members_forbidden_for_member(self, member_client):
        response = member_client.get("/api/v1/admin/groups/test-group/members")
        assert response.status_code == 403

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_list_members_group_not_found(self, mock_get, authenticated_client):
        mock_get.return_value = None
        response = authenticated_client.get("/api/v1/admin/groups/test-group/members")
        assert response.status_code == 404

    @patch("api.routers.hike_groups.hike_group_storage.list_group_members")
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_list_members_superuser(self, mock_get, mock_list, superuser_client):
        """Superuser can list any group's members."""
        mock_get.return_value = HikeGroupResponse(group_id="group1", name="G", created_by="su@example.com")
        mock_list.return_value = []
        response = superuser_client.get("/api/v1/admin/groups/group1/members")
        assert response.status_code == 200


class TestAddMember:
    @patch("api.routers.hike_groups.hike_group_storage.add_member")
    @patch("api.routers.hike_groups.hike_group_storage.get_user_membership")
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_add_member(self, mock_get, mock_membership, mock_add, authenticated_client):
        mock_get.return_value = HikeGroupResponse(group_id="test-group", name="G", created_by="su@example.com")
        mock_membership.return_value = None

        response = authenticated_client.post(
            "/api/v1/admin/groups/test-group/members", json={"email": "new@example.com", "role": "member"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "new@example.com"
        assert data["role"] == "member"
        mock_add.assert_called_once()

    @patch("api.routers.hike_groups.hike_group_storage.get_user_membership")
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_add_member_already_in_group(self, mock_get, mock_membership, authenticated_client):
        mock_get.return_value = HikeGroupResponse(group_id="test-group", name="G", created_by="su@example.com")
        mock_membership.return_value = GroupMember(email="existing@example.com", group_id="test-group", role="member")

        response = authenticated_client.post(
            "/api/v1/admin/groups/test-group/members", json={"email": "existing@example.com"}
        )
        assert response.status_code == 409

    @patch("api.routers.hike_groups.hike_group_storage.add_member")
    @patch("api.routers.hike_groups.hike_group_storage.get_user_membership")
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_add_admin_member(self, mock_get, mock_membership, mock_add, authenticated_client):
        mock_get.return_value = HikeGroupResponse(group_id="test-group", name="G", created_by="su@example.com")
        mock_membership.return_value = None

        response = authenticated_client.post(
            "/api/v1/admin/groups/test-group/members", json={"email": "admin@example.com", "role": "admin"}
        )
        assert response.status_code == 201
        assert response.json()["role"] == "admin"

    def test_add_member_wrong_group(self, authenticated_client):
        response = authenticated_client.post(
            "/api/v1/admin/groups/other-group/members", json={"email": "new@example.com"}
        )
        assert response.status_code == 403

    def test_add_member_forbidden_for_member(self, member_client):
        response = member_client.post("/api/v1/admin/groups/test-group/members", json={"email": "new@example.com"})
        assert response.status_code == 403

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_add_member_group_not_found(self, mock_get, authenticated_client):
        mock_get.return_value = None
        response = authenticated_client.post(
            "/api/v1/admin/groups/test-group/members", json={"email": "new@example.com"}
        )
        assert response.status_code == 404

    def test_add_member_invalid_role(self, authenticated_client):
        response = authenticated_client.post(
            "/api/v1/admin/groups/test-group/members", json={"email": "new@example.com", "role": "superuser"}
        )
        assert response.status_code == 422


class TestRemoveMember:
    @patch("api.routers.hike_groups.hike_group_storage.remove_member")
    @patch("api.routers.hike_groups.hike_group_storage.get_user_membership")
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_remove_member(self, mock_get, mock_membership, mock_remove, authenticated_client):
        mock_get.return_value = HikeGroupResponse(group_id="test-group", name="G", created_by="su@example.com")
        mock_membership.return_value = GroupMember(email="other@example.com", group_id="test-group", role="member")
        mock_remove.return_value = True

        response = authenticated_client.delete("/api/v1/admin/groups/test-group/members/other@example.com")
        assert response.status_code == 204
        mock_remove.assert_called_once_with("other@example.com")

    @patch("api.routers.hike_groups.hike_group_storage.get_user_membership")
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_remove_self_forbidden(self, mock_get, mock_membership, authenticated_client):
        mock_get.return_value = HikeGroupResponse(group_id="test-group", name="G", created_by="su@example.com")
        mock_membership.return_value = GroupMember(email="test@example.com", group_id="test-group", role="admin")

        response = authenticated_client.delete("/api/v1/admin/groups/test-group/members/test@example.com")
        assert response.status_code == 400

    @patch("api.routers.hike_groups.hike_group_storage.get_user_membership")
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_remove_nonexistent_member(self, mock_get, mock_membership, authenticated_client):
        mock_get.return_value = HikeGroupResponse(group_id="test-group", name="G", created_by="su@example.com")
        mock_membership.return_value = None

        response = authenticated_client.delete("/api/v1/admin/groups/test-group/members/nonexistent@example.com")
        assert response.status_code == 404

    def test_remove_member_wrong_group(self, authenticated_client):
        response = authenticated_client.delete("/api/v1/admin/groups/other-group/members/someone@example.com")
        assert response.status_code == 403

    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_remove_member_group_not_found(self, mock_get, authenticated_client):
        mock_get.return_value = None
        response = authenticated_client.delete("/api/v1/admin/groups/test-group/members/other@example.com")
        assert response.status_code == 404

    @patch("api.routers.hike_groups.hike_group_storage.get_user_membership")
    @patch("api.routers.hike_groups.hike_group_storage.get_hike_group")
    def test_remove_member_in_different_group(self, mock_get, mock_membership, authenticated_client):
        """Cannot remove a member who belongs to a different group."""
        mock_get.return_value = HikeGroupResponse(group_id="test-group", name="G", created_by="su@example.com")
        mock_membership.return_value = GroupMember(email="other@example.com", group_id="different-group", role="member")
        response = authenticated_client.delete("/api/v1/admin/groups/test-group/members/other@example.com")
        assert response.status_code == 404


class TestHikeGroupStorage:
    """Tests for the storage layer mapping function."""

    def test_doc_to_hike_group(self):
        from api.storage.hike_group_storage import _doc_to_hike_group

        data = {
            "name": "Test Group",
            "created_by": "su@example.com",
            "created_at": "2026-01-01T00:00:00",
            "last_updated": "2026-01-01T00:00:00",
        }

        result = _doc_to_hike_group("doc-id", data)
        assert result.group_id == "doc-id"
        assert result.name == "Test Group"
        assert result.created_by == "su@example.com"

    def test_doc_to_hike_group_defaults(self):
        from api.storage.hike_group_storage import _doc_to_hike_group

        result = _doc_to_hike_group("doc-id", {})
        assert result.group_id == "doc-id"
        assert result.name == ""
        assert result.created_by == ""
        assert result.created_at == ""
        assert result.last_updated == ""
