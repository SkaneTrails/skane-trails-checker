______________________________________________________________________

## name: pr-review-workflow description: Handle PR creation, review comments, feedback, and CI status using GitHub CLI and APIs

# Skill: PR Review Workflow

## Activation context

- Creating a PR (see section 5 for PowerShell quoting)
- After pushing commits to a PR branch
- Developer asks about PR comments, review feedback, or CI status

______________________________________________________________________

## 1. Post-push workflow

After every `git push`, do ALL in order:

1. Fetch review threads and **save to `tmp/pr-<PR>-comments.json`** (section 2)
1. Summarize and present to developer (section 3)
1. Wait for developer confirmation on which to address
1. Fix each issue → record reply text in the JSON file as you go
1. Commit and push all fixes
1. Batch reply + resolve all threads in one pass (section 4) — using saved IDs, no re-fetch

**Completion checklist per comment (all required):**

- [ ] Code fix implemented
- [ ] Reply text recorded in `tmp/pr-<PR>-comments.json`
- [ ] Committed and pushed
- [ ] Single-script batch: reply + resolve all threads (section 4) — **1 terminal approval**

______________________________________________________________________

## 2. Fetching PR comments

> **⚠️ NEVER use built-in IDE tools** (`github-pull-request_activePullRequest` etc.) — they return stale/cached data. Always use `gh api graphql` directly.

### Primary method: GraphQL reviewThreads (with both IDs)

Fetch all threads with resolution status, **thread IDs** (for resolving), and **comment IDs** (for replying) in one call:

```bash
gh api graphql -f query='
  query($owner: String!, $repo: String!, $pr: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100) {
          nodes {
            id
            isResolved
            comments(first: 5) {
              nodes { body path author { login } databaseId }
            }
          }
        }
      }
    }
  }
' -f owner="<OWNER>" -f repo="<REPO>" -F pr=<PR>
```

- `id` on each thread node = `threadId` for resolution
- `databaseId` on each comment = `commentId` for REST replies

### Save IDs immediately to `tmp/pr-<PR>-comments.json`

After fetching, **immediately** save all comment metadata using `create_file`. This avoids re-fetching later:

```json
{
  "pr": 171,
  "owner": "SkaneTrails",
  "repo": "skane-trails-checker",
  "threads": [
    {
      "threadId": "PRT_kwDO...",
      "commentId": 2927547515,
      "path": "api/routers/foraging.py",
      "body": "The fallback response omits created_by...",
      "author": "copilot-pull-request-reviewer",
      "isResolved": false,
      "reply": null
    }
  ]
}
```

- `threadId` → GraphQL resolve. `commentId` → REST reply. Both captured once; no second lookup needed.
- `reply` starts as `null` — filled in as each issue is fixed (section 2b).

### Recording replies as you fix

After implementing a fix for a comment, update the `reply` field in the JSON file:

```json
{ "reply": "Fixed in 209ac4d — now uses get_foraging_spot(doc_id) for single-doc fetch." }
```

This keeps fix context fresh and avoids composing replies from memory later.

### REST fallback (only when GraphQL is unavailable)

```bash
gh api repos/<OWNER>/<REPO>/pulls/<PR>/comments --jq "[.[] | {id, path, body}]"
```

Returns `id` (for replies) but NOT `threadId` (cannot resolve). Save to `tmp/` file the same way.

### CI status

```bash
gh pr checks <PR>
```

On failure: `gh run view <run_id> --log-failed` to diagnose.

______________________________________________________________________

## 3. Assessing comments

### Categorize

Group into: **Actionable** | **Questions** | **Informational** | **Blocking**

Present as a table with file, author, and summary. Wait for developer confirmation before acting.

### Bot comments (`copilot-pull-request-reviewer`, `github-actions`)

- Do not blindly apply — verify against project conventions and codebase context
- Watch for false positives (API format assumptions, inapplicable security warnings, style conflicts with tooling)
- When uncertain, present with your assessment. When wrong, explain why

______________________________________________________________________

## 4. Responding to comments — single-script batch

All replies and resolutions use IDs from `tmp/pr-<PR>-comments.json`. No re-fetching.
**Goal: 1 terminal execution = 1 user approval** for all replies + all resolves.

### Generate and run `tmp/pr-<PR>-respond.py`

Use `create_file` to write a Python script that reads the JSON and does everything:

```python
import json, subprocess

with open("tmp/pr-<PR>-comments.json") as f:
    data = json.load(f)

owner, repo, pr = data["owner"], data["repo"], data["pr"]

# Post all replies
for t in data["threads"]:
    if t.get("reply"):
        subprocess.run(
            ["gh", "api", f"repos/{owner}/{repo}/pulls/{pr}/comments/{t['commentId']}/replies",
             "-X", "POST", "-f", f"body={t['reply']}"],
            check=True,
        )

# Batch-resolve all threads (single GraphQL call)
parts = []
for i, t in enumerate(data["threads"], 1):
    tid = t["threadId"]
    parts.append(f't{i}: resolveReviewThread(input: {{threadId: "{tid}"}}) {{ thread {{ isResolved }} }}')

mutation = "mutation { " + " ".join(parts) + " }"
subprocess.run(["gh", "api", "graphql", "-f", f"query={mutation}"], check=True)
```

Then execute: `python tmp/pr-<PR>-respond.py`

**Why Python instead of chained `gh` commands:**

- Avoids PowerShell backtick escaping issues in GraphQL queries
- Reply text can contain any characters (read from JSON, not shell-interpolated)
- One script, one approval, regardless of comment count

### Disagreeing

Reply with reasoning, then resolve the thread. Do not leave threads open.

______________________________________________________________________

## 5. Branch Strategy — Avoiding Merge Conflicts

### The problem

Parallel branches created from the same base that modify the same lines will conflict when the first one merges.

### Before creating a new branch

1. Check for open PRs: `GH_PAGER="" gh pr list --limit 20 2>&1`
1. For each open PR, check which files it touches: `gh pr diff <NUMBER> --name-only`
1. If the new work will modify any of the same files, choose a strategy:

| Situation                                          | Strategy                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| New work depends on the open PR                    | **Stack**: branch from the open PR's branch, not main                |
| Same files but independent work                    | **Wait**: let the open PR merge first, then branch from updated main |
| Overlap is trivial (1-2 lines, different sections) | **Proceed**: create from main, accept minor rebase work              |

### Stacking branches

When stacking branch B on top of open PR branch A:

```bash
git switch branch-a
git pull origin branch-a
git switch -c branch-b
# ... work on branch B ...
# When branch A merges into main:
git fetch origin
git rebase origin/main
```

______________________________________________________________________

## 6. Creating PRs and Issues

### Avoiding Terminal Escaping Issues

NEVER use heredocs (`<< 'EOF'`) in terminal commands — they corrupt with multi-line content.
NEVER pass backtick-containing text via `--body` — PowerShell uses backticks as escape characters and many shells treat backticks specially; for portability, use `--body-file` instead.

**Correct approach:**

1. Use `create_file` tool to write body to `tmp/` file
1. Use `--body-file` flag to reference the file
1. Set `GH_PAGER=""` to disable pager (prevents "alternate buffer" issues)

### Creating Issues

```bash
# 1. Create body file using create_file tool (not terminal heredoc)
# 2. Then run:
GH_PAGER="" gh issue create \
  --repo OWNER/REPO \
  --title "feat: Short description" \
  --body-file tmp/issue-body.md \
  --label "enhancement" 2>&1
```

### Creating PRs

```bash
# Same pattern as issues:
GH_PAGER="" gh pr create \
  --title "feat: Short description" \
  --body-file tmp/pr-body.md 2>&1
```

### Listing Issues/PRs

Always disable pager to avoid "alternate buffer" output:

```bash
GH_PAGER="" gh issue list --limit 10 2>&1
GH_PAGER="" gh pr list --limit 10 2>&1
```

______________________________________________________________________

## 7. Skåne Trails project context

For this project (Skåne Trails on GCP free tier):

- **FastAPI + Expo/React Native app**: PRs may change API endpoints, mobile UI, or both. When reviewing, consider both code quality and user experience impacts.
- **Firestore + Cloud Run on GCP free tier**: All data persistence uses Firestore and the API runs on Cloud Run. PR changes must respect free-tier limits (reads/writes, requests, CPU/memory) and avoid introducing costly polling or chatty database patterns.
- **Infrastructure via Terraform only**: Any change that affects GCP resources must be implemented in `infra/` with Terraform. Do not suggest or approve manual console or `gcloud`-only changes.
- **Security and CI workflows**: CI runs Trivy scans, SBOM and license checks, and tests via GitHub Actions. When reviewing PRs, ensure new dependencies, workflows, or patterns align with these existing checks and keep the project zero-cost and public-repo safe.
- **Pre-commit hooks** may auto-format files — always run `git diff` after committing to verify the actual changes.
