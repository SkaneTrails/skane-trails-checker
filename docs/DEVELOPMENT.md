# Development Guide

Local setup, environment configuration, and API reference for developers.

> **For contribution guidelines**, see [CONTRIBUTING.md](../CONTRIBUTING.md)
> **For infrastructure setup**, see [infra/environments/dev/README.md](../infra/environments/dev/README.md)

## Quick Reference

```bash
# API server
uv run uvicorn api.main:app --reload --reload-dir api --port 8000

# Mobile / web
cd mobile && npx expo start --web

# Tests
uv run pytest --cov=app --cov=api --cov-report=term-missing

# Lint / format
uv run ruff check --fix && uv run ruff format
```

## Setup

### Prerequisites

- Python 3.14+
- [UV package manager](https://github.com/astral-sh/uv)
- Node.js 20+ and [pnpm](https://pnpm.io/) (for mobile/web app)

### Installation

```bash
git clone https://github.com/SkaneTrails/skane-trails-checker.git
cd skane-trails-checker

# API dependencies
uv sync --extra dev
uv run pre-commit install

# Mobile dependencies
cd mobile
pnpm install
```

## Environment Setup

### API Environment Variables

First-time setup requires Firestore connection configuration:

1. **Authenticate with Google Cloud:**

   ```bash
   gcloud auth application-default login
   ```

1. **Fetch Firestore secrets from GCP Secret Manager:**

   ```bash
   uv run python dev-tools/setup_env.py
   ```

   This creates a `.env` file with Firestore connection details (gitignored). The script checks freshness (24h) and skips if the file is recent.

   **Options:**

   - `--force` — Force refresh even if `.env` is fresh
   - `--check` — Validate `.env` has all required variables
   - `--list` — Show secret mappings

The API requires these environment variables (set automatically by `setup_env.py`):

| Variable                | Required | Description                                                |
| ----------------------- | -------- | ---------------------------------------------------------- |
| `FIRESTORE_PROJECT_ID`  | Yes      | GCP project ID                                             |
| `FIRESTORE_DATABASE_ID` | Yes      | Firestore database name (default: `skane-trails-db`)       |
| `FIRESTORE_LOCATION_ID` | Yes      | Firestore region (e.g., `eur3`)                            |
| `ALLOWED_ORIGINS`       | No       | Comma-separated CORS origins (defaults to localhost ports) |
| `SKIP_AUTH`             | No       | Set to `true` to skip Firebase auth (local dev)            |

### Mobile Environment Variables

```bash
cd mobile
cp .env.example .env.development
```

Without Firebase/OAuth values, the app runs in dev mode with a mock user.

| Variable                         | Required | Description                                |
| -------------------------------- | -------- | ------------------------------------------ |
| `EXPO_PUBLIC_API_URL`            | Yes      | API URL (default: `http://localhost:8000`) |
| `EXPO_PUBLIC_FIREBASE_*`         | No\*     | Firebase config for authentication         |
| `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` | No\*     | OAuth client IDs for Google Sign-In        |

**\*Authentication in dev mode:** If Firebase/OAuth credentials are not configured, the app runs in "dev mode" with a mock authenticated user. This allows local development without setting up Firebase.

## Running the Application

### FastAPI Backend

```bash
uv run uvicorn api.main:app --reload --reload-dir api --port 8000
```

API docs available at `http://localhost:8000/api/docs` (Swagger) and `http://localhost:8000/api/redoc` (ReDoc).

### Mobile / Web App

```bash
cd mobile
npx expo start --web
```

### Android App (Native)

The app supports building a standalone Android APK with native maps (MapLibre GL + OpenStreetMap) and background GPS tracking. The web app continues working unchanged — platform-specific code uses file extensions (`.web.tsx` / `.native.tsx`).

#### Prerequisites

- [Android Studio](https://developer.android.com/studio) with Android SDK installed
- Android SDK Platform 35 (or latest)
- Android SDK Build-Tools
- An Android device with USB debugging enabled, or an Android emulator
- [EAS CLI](https://docs.expo.dev/eas/): `npm install -g eas-cli`

> **USB Debugging:** On your phone, go to Settings → About Phone → tap "Build Number" 7 times to enable Developer Options. Then enable "USB Debugging" in Developer Options.

#### Java / JAVA_HOME Setup (Windows)

The Android build uses the JDK bundled with Android Studio. Set `JAVA_HOME` to point to it:

```powershell
# PowerShell (current session)
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"

# Or set permanently via System Environment Variables
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
```

Verify: `& "$env:JAVA_HOME\bin\java" -version` should show Java 21+.

#### Production Environment Setup

To connect the Android app to the production API and Firebase Auth:

```bash
# Authenticate with GCP
gcloud auth application-default login

# Fetch secrets and create mobile/.env.development
uv run python dev-tools/setup_mobile_env.py
```

This populates `EXPO_PUBLIC_API_URL`, Firebase config, and the web OAuth client ID from GCP Secret Manager. Use `--force` to overwrite an existing file.

#### First-Time Development Build

The Android app requires an Expo development build (not Expo Go) because it uses custom native modules (`@maplibre/maplibre-react-native`, `expo-location` background tracking).

```bash
cd mobile

# Install dependencies
pnpm install

# Build and run on connected Android device via USB
npx expo run:android
```

This will:

1. Generate the `android/` directory with native project files
1. Compile the native code (Gradle build)
1. Install the app on your connected device
1. Start the Metro bundler

> **First build takes several minutes.** Subsequent builds are much faster as Gradle caches compiled code.

> **React version:** React must be pinned to `19.2.3` (exact, no caret) to match `react-native-renderer`. If `pnpm install` bumps it, run: `pnpm add react@19.2.3 --save-exact`

#### Running After First Build

Once the app is installed, start the dev server without rebuilding:

```bash
cd mobile
npx expo start --android
```

The app connects to Metro over your local network. Both the phone and computer must be on the same WiFi network.

#### Building a Standalone APK

To build a sideloadable APK that runs without a dev server:

```bash
# Local build (requires Android SDK)
npx eas build --platform android --profile preview --local

# Cloud build (requires Expo account)
npx eas build --platform android --profile preview
```

The `preview` profile in `eas.json` produces a standalone APK for internal distribution (no dev server required).

#### Installing the APK

```bash
# Via ADB (USB connected)
adb install build-*.apk

# Or transfer the .apk file to your phone and open it
# You may need to enable "Install from unknown sources" in Settings
```

#### API Connection

The Android app connects to the same API as the web app. Set the API URL in `mobile/.env.development`:

```
EXPO_PUBLIC_API_URL=http://<your-computer-ip>:8000
```

Use your computer's local IP (not `localhost`) since the phone connects over WiFi. Find it with `ipconfig` (Windows) or `ifconfig` (macOS/Linux).

#### Native Map (MapLibre GL v11 + OpenStreetMap)

The native Android map uses [MapLibre GL v11](https://github.com/maplibre/maplibre-react-native) with OpenStreetMap raster tiles — **no API key or billing required**. This keeps the project within its zero-cost constraint.

> **Why v11?** MapLibre React Native v10 has a rendering bug with React Native's New Architecture (Fabric) where tile layers fail to paint despite loading successfully. v11 (beta) resolves this with a rewritten TurboModule-based renderer.

Both web (Leaflet) and native (MapLibre) render the same OpenStreetMap tile data, ensuring visual consistency across platforms.

#### Architecture: Platform-Specific Files

Native code uses Expo's platform file extensions. Metro resolves imports automatically:

| Import               | Web resolves to            | Android resolves to           |
| -------------------- | -------------------------- | ----------------------------- |
| `./UnifiedMap`       | `UnifiedMap.web.tsx`       | `UnifiedMap.native.tsx`       |
| `./TrackingControls` | `TrackingControls.web.tsx` | `TrackingControls.native.tsx` |

Key platform-specific files:

| File                                     | Purpose                               |
| ---------------------------------------- | ------------------------------------- |
| `components/UnifiedMap.web.tsx`          | Leaflet map (OpenStreetMap tiles)     |
| `components/UnifiedMap.native.tsx`       | MapLibre GL map (OpenStreetMap tiles) |
| `components/TrackingControls.web.tsx`    | Empty stub (GPS not available on web) |
| `components/TrackingControls.native.tsx` | FAB buttons for start/pause/stop GPS  |
| `lib/tracking-service.ts`                | Background GPS via expo-task-manager  |
| `lib/location-permissions.ts`            | Android permission request flow       |

All business logic (hooks, types, API client, TrackingContext, TrackingOverlay) is shared across platforms.

#### Background GPS Tracking

The Android app records hikes with the screen off using a foreground service:

- `expo-location` provides GPS coordinates (high accuracy, 3s interval, 5m minimum movement)
- `expo-task-manager` registers a background task that survives screen lock
- A persistent notification shows "Recording hike" while tracking is active
- Coordinates are flushed to AsyncStorage every 30s for crash recovery
- Recorded tracks are saved as trails via POST `/api/v1/trails/record`

#### Permissions

The app requests these Android permissions (configured in `app.json`):

| Permission                    | Purpose                           |
| ----------------------------- | --------------------------------- |
| `ACCESS_FINE_LOCATION`        | GPS coordinates while app is open |
| `ACCESS_COARSE_LOCATION`      | Approximate location fallback     |
| `ACCESS_BACKGROUND_LOCATION`  | GPS with screen off               |
| `FOREGROUND_SERVICE`          | Keep tracking alive in background |
| `FOREGROUND_SERVICE_LOCATION` | Location-type foreground service  |

Background location requires a two-step permission flow: foreground first, then background (Android 10+ requirement).

#### Troubleshooting

| Problem                              | Solution                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Uninstall the existing app: `adb uninstall com.skanetrails.hikes`                           |
| Build fails with SDK errors          | Open `mobile/android/` in Android Studio and let it sync Gradle                             |
| Build fails with Kotlin errors       | Ensure Gradle wrapper version is 8.x (not 9.x) in `gradle-wrapper.properties`               |
| `JAVA_HOME` not set                  | Set to Android Studio JBR: `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"` |
| App can't reach API                  | Check `EXPO_PUBLIC_API_URL` uses your computer's LAN IP, not localhost                      |
| GPS not recording in background      | Ensure "Allow all the time" location permission is granted                                  |
| Emulator has no GPS                  | Use Android Studio's Extended Controls (three dots) to set a mock location                  |

## Project Structure

```
skane-trails-checker/
├── api/                       # FastAPI REST backend
│   ├── main.py                # App entry point, CORS, security headers
│   ├── auth/                  # Firebase Auth middleware
│   ├── models/                # Pydantic models (Trail, Foraging, Place)
│   ├── routers/               # REST endpoints (trails, foraging, places)
│   ├── services/              # Business logic (GPX parsing)
│   └── storage/               # Firestore persistence
├── app/                       # Server-side GPX processing
│   ├── functions/             # GPX parsing, trail conversion, bootstrap
│   ├── resources/             # Static data
│   └── tracks_gpx/            # Bundled Skåneleden GPX files
├── mobile/                    # Expo / React Native app
│   ├── app/                   # Expo Router screens (tabs, trail detail, upload)
│   ├── components/            # Shared UI (Button, TrailCard, TrailMap, etc.)
│   └── lib/                   # API client, hooks, theme, types, storage
├── dev-tools/                 # Admin scripts (setup, import, backfill)
├── infra/                     # Terraform infrastructure
│   ├── environments/dev/      # Dev environment config + setup guide
│   └── modules/               # 8 reusable modules
├── tests/                     # pytest test suite
└── docs/                      # This guide + troubleshooting
```

## API Endpoints

All endpoints are prefixed with `/api/v1`.

### Trails

| Method   | Path                   | Auth | Description                                         |
| -------- | ---------------------- | ---- | --------------------------------------------------- |
| `GET`    | `/trails/sync`         | No   | Sync metadata (count, last_modified)                |
| `GET`    | `/sync/status`         | Yes  | Version per data type + caller's scope, for polling |
| `GET`    | `/trails/changes`      | Yes  | Trails changed + IDs deleted since `?since=`        |
| `GET`    | `/trails`              | No   | List trails (filter by source, status, distance)    |
| `GET`    | `/trails/{id}`         | No   | Get single trail                                    |
| `GET`    | `/trails/{id}/details` | No   | Full trail data (all coordinates)                   |
| `PATCH`  | `/trails/{id}`         | Yes  | Update trail                                        |
| `DELETE` | `/trails/{id}`         | Yes  | Delete trail                                        |
| `POST`   | `/trails/upload`       | Yes  | Upload GPX file                                     |

### Foraging

| Method   | Path                     | Auth | Description                  |
| -------- | ------------------------ | ---- | ---------------------------- |
| `GET`    | `/foraging/spots`        | No   | List spots (filter by month) |
| `POST`   | `/foraging/spots`        | Yes  | Create spot                  |
| `PATCH`  | `/foraging/spots/{id}`   | Yes  | Update spot                  |
| `DELETE` | `/foraging/spots/{id}`   | Yes  | Delete spot                  |
| `GET`    | `/foraging/types`        | No   | List foraging types          |
| `POST`   | `/foraging/types`        | Yes  | Create/update type           |
| `DELETE` | `/foraging/types/{name}` | Yes  | Delete type                  |

### Places

| Method | Path                 | Auth | Description                      |
| ------ | -------------------- | ---- | -------------------------------- |
| `GET`  | `/places`            | No   | List places (filter by category) |
| `GET`  | `/places/categories` | No   | List place categories            |

### Other

| Method | Path      | Auth | Description  |
| ------ | --------- | ---- | ------------ |
| `GET`  | `/health` | No   | Health check |

## Local-First Trail Sync

The app keeps its own copy of every trail, including the map coordinates, and only downloads what changed:

1. On start the map draws from the local copy at once (files in the app's document folder on native, IndexedDB on web: `mobile/lib/storage/map-trail-store.*`).
1. It then calls `GET /trails/changes?since=<last server_time>`. The response holds the trails modified since then (with coordinates), the IDs deleted since then, and a new `server_time` to store. That time trails the clock by two minutes (`CURSOR_OVERLAP`), because a write takes its timestamp before it commits and could otherwise land just after a sync chose its cursor and be missed for good; the overlap re-delivers a few recent changes, which the app applies idempotently. Without a local copy (first run) it fetches everything once.
1. Deletions travel as tombstones: `delete_trail` writes a `trail_tombstones` document, so a deletion is never missed even if another trail was added in the same window.
1. If the request fails, the local copy is used.
1. The local copy belongs to one signed-in user and one scope (`scope` in the response: `all` for a superuser, else `group:<id>`). A different user, or a scope that no longer matches, erases it and fetches everything again, so private trails never carry over and an old cursor is never reused.

If the local copy is ever wrong, **Menu > Refresh all data** clears everything stored on the device and downloads it again.

### Change polling

`GET /sync/status` returns one opaque version per data type (`trails`, `places`, `foraging_spots`, `foraging_types`, `images`), stored in `_meta/sync_status` and replaced by every write path (`api/storage/sync_status.py`). The app (`mobile/lib/sync/poll-sync-status.ts`, driven by `useSyncPolling`) checks it on start, when it returns to the foreground and every 5 minutes, and refetches only the types whose version differs from the last one it synced (`mobile/lib/storage/sync-seen.ts`). Versions are compared for equality, never ordered. A refetch that fails is not remembered, so the next poll retries it.

- Queries have `staleTime: Infinity`; the poll and the app's own mutations are the only things that refresh them. Foraging spots, foraging types and places are refetched whole when their version changes.
- Trails travel through the delta described above. The trail list is derived from the same local copy as the map.
- Photos: each trail carries an `images_revision`. The app keeps a trail's photos on the device (`mobile/lib/storage/trail-image-store.*`) and downloads them again only when that revision changes. The `images` version drives the map's photo pins.
- Local data whose owner is another user, or unknown (left by an older app version), is cleared before the signed-in screens render and before the server is asked, so being offline cannot leave the previous user's data behind. A poll that was started by one user never writes results after another signed in. `/sync/status` also returns the caller's `scope` (`all`, `group:<id>` or `none`); if it differs from the one saved at the last sync (moved to another group, role changed), the local data is cleared too, because no data version reflects an access change.
- The trail refresh is strict: if the delta request fails the version is not remembered (the usual trail sync would fall back to the local copy and look successful). It also refetches open trail detail screens.
- Photo uploads and deletes commit the image document, the trail's `images_revision` and the `trails`/`images` versions in one Firestore batch; a new foraging spot is committed together with its `foraging_spots` version. `DELETE /trails/{id}/images/{index}` returns the remaining photos and their revision.
- **Menu > Refresh all data** also removes the trail cache older app versions kept (`@trails`/`@lastSyncTime` on native, `trails`/`lastSyncTime` in IndexedDB).

The React Query cache is saved to a single AsyncStorage entry, which Android caps at about 6 MB. The trail queries that are too big for it (map trails, full tracks, photos) are therefore not saved there (`mobile/lib/storage/persist-filter.ts`).

## Seeding Trail Data

After deploying infrastructure, Firestore is empty. There are two ways to add trails:

### Skåneleden Trails (Bootstrap)

The repo includes a bundled GPX file with all 169 Skåneleden etapps at `app/tracks_gpx/planned_hikes/all-skane-trails.gpx`. To seed them into Firestore:

```bash
uv run python -c "from app.functions.bootstrap_trails import bootstrap_planned_trails; bootstrap_planned_trails('app/tracks_gpx/planned_hikes/all-skane-trails.gpx')"
```

This is idempotent — it skips if `planned_hikes` trails already exist in Firestore.

To refresh the bundled GPX file from the official Skåneleden website:

```bash
uv run python dev-tools/update_skaneleden_trails.py
```

Then re-bootstrap after clearing old data:

```bash
uv run python dev-tools/delete_planned_trails.py
```

### Custom Trails (GPX Upload)

Upload GPX files through the app's upload screen, or via the API:

```bash
curl -X POST http://localhost:8000/api/v1/trails/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@my-trail.gpx" \
  -F "source=other_trails"
```

### Bulk GPX Import (CLI)

Import GPX files directly into Firestore using the database manager:

```bash
# Import all GPX files from a directory
uv run python dev-tools/db_manager.py trails import --gpx-dir path/to/gpx/ --source other_trails

# Preview first
uv run python dev-tools/db_manager.py trails import --gpx-dir path/to/gpx/ --dry-run
```

Includes duplicate detection (by date ±60min, then name). See [dev-tools/README.md](../dev-tools/README.md) for full options.

### Database Management

The `db_manager.py` tool provides interactive and CLI access to all Firestore collections:

```bash
# Interactive menu
uv run python dev-tools/db_manager.py

# Search trails
uv run python dev-tools/db_manager.py trails search "söderåsen"

# View full trail details
uv run python dev-tools/db_manager.py trails get <trail_id>

# Collection overview
uv run python dev-tools/db_manager.py status
```

See [dev-tools/README.md](../dev-tools/README.md) for the complete command reference.

## Authentication

The API uses Firebase Auth with Google Sign-In:

1. Mobile signs in via Firebase (Google OAuth)
1. Gets ID token from Firebase SDK
1. Sends token in `Authorization: Bearer <token>` header
1. API validates token with Firebase Admin SDK
1. Write endpoints return 401 if token is invalid/expired

For local development, set `SKIP_AUTH=true` to bypass authentication.

## Testing

### API (pytest)

```bash
# All tests
uv run pytest

# With coverage
uv run pytest --cov=app --cov=api --cov-report=term-missing

# Specific file
uv run pytest tests/test_api_trails.py -v
```

Coverage threshold: 85% (enforced by `fail_under` in `pyproject.toml`).

### Mobile (Vitest)

```bash
cd mobile
pnpm test
pnpm test:coverage
```

## Linting and Formatting

```bash
# Python
uv run ruff check --fix
uv run ruff format

# All pre-commit hooks
uv run pre-commit run --all-files
```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.

## Dependency Management

### Adding Dependencies

```bash
# Add production dependency
uv add package-name

# Add development dependency
uv add --dev package-name

# Add with version constraint
uv add "package-name>=1.0.0"
```

### Updating Dependencies

Renovate automatically creates PRs for dependency updates. Manual updates:

```bash
# Update all dependencies
uv sync --upgrade

# Update specific package
uv sync --upgrade-package package-name
```

### Lock File

- `uv.lock` ensures reproducible installs
- Committed to git
- Regenerated on dependency changes

## CI/CD

### GitHub Actions Workflows

- **tests.yml** - Run tests on PRs and pushes
- **security-checks.yml** - License scanning, Trivy vulnerability scanning
- **renovate.yml** - Automated dependency updates
- **auto-label-pr.yml** - Auto-label PRs based on changes
- **android-release.yml** - Build the Android app bundle on EAS and submit it to Google Play internal testing

### Android release pipeline

`android-release.yml` builds a signed Android App Bundle with **EAS Build** (Expo
cloud, 15 free Android builds/month) and submits it to the Google Play **internal
testing** track (invited testers only). EAS stores the signing keystore in the
cloud, so no keystore is kept in the repo.

**Triggers:** pushing a version tag (`v*`, e.g. `git tag v1.0.1 && git push origin v1.0.1`)
or a manual run from the Actions tab. The Android `versionCode` is auto-incremented
by EAS (`appVersionSource: "remote"` + `autoIncrement: true` in `mobile/eas.json`).

**What is automated and what is not:**

| Part                                                                    | How                                                                                |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Google Play Android Developer API, Play publisher service account       | Terraform (`infra/`)                                                               |
| Service account JSON key                                                | One-time manual step (kept out of Terraform state on purpose)                      |
| Play Console app, declarations, tracks, testers, service-account invite | Manual in Play Console (no API)                                                    |
| Android OAuth client for Google sign-in                                 | Terraform: `google_firebase_android_app` with the Play signing SHA hashes (step 9) |
| EAS project, build-time `EXPO_PUBLIC_*` variables, keystore             | `eas` CLI (the keystore is generated and stored by EAS)                            |

Always pass the project explicitly to `gcloud` (`--project=<PROJECT_ID>`); never rely on
the active gcloud configuration. `<PROJECT_ID>` is the `project` value in
`infra/environments/dev/terraform.tfvars`.

**One-time setup** (order matters):

1. **Expo project** - from `mobile/`, run `eas login` then `eas init`. Commit the
   resulting `owner` and `extra.eas.projectId` added to `mobile/app.json`.

1. **Expo token** - create an access token at expo.dev (Account > Access tokens)
   and add it as the `EXPO_TOKEN` repository secret
   (`gh secret set EXPO_TOKEN --repo SkaneTrails/skane-trails-checker`).

1. **Build-time environment variables** - cloud builds never see your gitignored
   `mobile/.env*` files, so the `EXPO_PUBLIC_*` values must live on EAS. Copy
   `mobile/.env.example` to `mobile/.env.production`, fill in the production values
   (the API URL is `terraform output cloud_run_url`), then from `mobile/`:

   ```bash
   pnpm dlx eas-cli env:push production --path .env.production
   pnpm dlx eas-cli env:list production     # check every EXPO_PUBLIC_* name is listed
   ```

   The `production` build profile in `mobile/eas.json` is pinned to this environment.
   These values are public by design (they are embedded in the app bundle).

1. **Package name** - `expo.android.package` in `mobile/app.json` must equal the
   package name of the app in Play Console (`com.skanetrails.hikes`). Google Play fixes
   the package name when the app is created and it cannot be changed afterwards.

1. **Terraform** - apply the infrastructure (merging to `main` runs the CD workflow, or
   run `terraform apply` in `infra/environments/dev`). This enables the Google Play
   Android Developer API and creates the Play publisher service account. Get its email:

   ```bash
   terraform output play_publisher_sa
   ```

1. **Play Console app** - create the app with the package name above and complete the
   **App content** declarations (privacy policy URL, data safety, content rating, target
   audience, app access, and the background location declaration for
   `ACCESS_BACKGROUND_LOCATION`). Under **Testing > Internal testing**, create the
   track and add your testers' emails as a list, then copy the opt-in link.

1. **First build and first upload (manual, once)** - Google Play requires the first
   bundle of a new app to be uploaded in the Console; automated submits only work for
   later releases. From `mobile/`, on a branch with a clean working tree:

   ```bash
   pnpm dlx eas-cli build --platform android --profile production
   ```

   Answer **yes** when asked to generate an Android keystore (run interactively, not
   with `--non-interactive`). When the build finishes, download the `.aab`, then in
   Play Console go to **Internal testing > Create new release**, accept Play App
   Signing, upload the file and roll it out.

   The certificate that signs this first bundle becomes the app's **upload key** in Google
   Play, and every later bundle must be signed with the same key. EAS keeps one keystore
   per application identifier, so if you ever change `expo.android.package` after a first
   upload, EAS generates a new keystore and Play rejects the result (see Troubleshooting).
   Get the right package name before the first upload.

1. **Service account key and Play permission** - create a key for the Play publisher
   service account and store it as the `PLAY_SERVICE_ACCOUNT_JSON` repository secret,
   then delete the local copy. Terraform deliberately does not manage this key, because
   a managed key would put the private key in the Terraform state.

   ```powershell
   # PowerShell
   gcloud iam service-accounts keys create play-key.json --iam-account=<play_publisher_sa> --project=<PROJECT_ID>
   Get-Content play-key.json -Raw | gh secret set PLAY_SERVICE_ACCOUNT_JSON --repo SkaneTrails/skane-trails-checker
   Remove-Item play-key.json
   ```

   ```bash
   # bash
   gcloud iam service-accounts keys create play-key.json --iam-account=<play_publisher_sa> --project=<PROJECT_ID>
   gh secret set PLAY_SERVICE_ACCOUNT_JSON --repo SkaneTrails/skane-trails-checker < play-key.json
   rm play-key.json
   ```

   If key creation is blocked, an organisation policy
   (`iam.disableServiceAccountKeyCreation`) is enforced and must be relaxed for this
   project. Then in Play Console go to **Users and permissions > Invite new users**,
   enter the service account email and grant it permission to release to testing
   tracks for this app. Menu names change occasionally; the goal is that the account can
   create releases on the Internal testing track.

1. **Google sign-in on Play-installed builds** - the app only reads the web client ID
   (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`), but Google also requires an Android OAuth client
   for the package and signing certificate. Terraform registers the app in Firebase
   (`google_firebase_android_app` in `infra/modules/firebase`), and Firebase then creates
   that client itself. Testers install a copy that Google re-signs, so the fingerprints
   needed are those of the **Play app signing key certificate** (Play Console: Test and
   release > App integrity > Play app signing, or from the installed app:
   `adb shell pm path com.skanetrails.hikes`, `adb pull <base.apk path>`, then
   `apksigner verify --print-certs base.apk`). Set them in `terraform.tfvars` as
   lowercase hex without colons:

   ```hcl
   android_sha1_hashes   = ["<play-app-signing-sha1>"]
   android_sha256_hashes = ["<play-app-signing-sha256>"]
   ```

   Run `terraform apply` in `infra/environments/dev`, then re-run
   `scripts/sync-secrets.ps1` so the `TF_VARS_FILE` secret carries the same values;
   otherwise the next CD run removes them again. Check that **APIs & Services >
   Credentials** now lists an auto-created "Android client for com.skanetrails.hikes".
   To also support sideloaded EAS builds, add the upload keystore fingerprints
   (`pnpm dlx eas-cli credentials --platform android`) to the same lists. If no client
   appears, create one manually: **Create credentials > OAuth client ID > Android**
   with the package name and the Play app signing SHA-1. No environment variable changes
   are needed in either case.

After setup, releases are one command: `git tag v1.0.1 && git push origin v1.0.1`.

To widen the beta later, change `submit.production.android.track` in
`mobile/eas.json` from `internal` to a closed-testing track (e.g. `alpha`).

**Troubleshooting:**

| Symptom                                                                          | Cause and fix                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Play rejects the bundle: package name must be `...`                              | `expo.android.package` differs from the Play app. Change `mobile/app.json`; the Play side cannot be changed. Rebuild.                                                                                            |
| Play rejects the bundle: signed with the wrong key (shows two SHA1 fingerprints) | The bundle's certificate differs from the upload key Play registered, usually because EAS generated a new keystore for a changed package name. Reuse the old keystore: see "Reusing an existing keystore" below. |
| EAS runs `npm ci` and fails with `ERESOLVE`                                      | A stray `mobile/package-lock.json` was uploaded, so EAS chose npm. `.easignore` replaces `.gitignore` for EAS uploads, so every ignore must be repeated there. Delete the stray file.                            |
| EAS upload is about 1 GB                                                         | `.easignore` is missing or incomplete (the whole git root is archived: `.venv`, `mobile/node_modules`, `mobile/android`).                                                                                        |
| Native compile error in `expo-modules-core` (for example `tryGetMutableBuffer`)  | Dependencies drifted from the Expo SDK. Run `pnpm dlx expo-doctor`, then `pnpm exec expo install --fix`. Remove any stray `mobile/package-lock.json` first, otherwise `expo install` uses npm.                   |
| Google sign-in fails on tester devices                                           | The Android OAuth client is missing or has the wrong package or SHA-1 (step 9).                                                                                                                                  |
| Build has no API URL or Firebase config                                          | The EAS `production` environment variables are missing (step 3).                                                                                                                                                 |

**Reusing an existing keystore** (move the keystore that Play already knows to the
current package name). You need the old package name and the SHA1 Play expects; check
which EAS build produced it with
`keytool -printcert -jarfile <old-bundle>.aab`. From `mobile/`, run interactively:

1. Temporarily set `expo.android.package` in `mobile/app.json` to the **old** package
   name (do not commit this).
1. `pnpm dlx eas-cli credentials --platform android`, choose the `production` profile,
   then **credentials.json: Upload/Download credentials between EAS servers and your
   local json**, then **Download credentials from EAS to credentials.json**. Confirm the
   fingerprint matches the one Play expects.
1. Set `expo.android.package` back to the current package name.
1. Run the same command again and choose **Upload credentials from credentials.json to
   EAS**. The current package now signs with the old keystore.
1. Delete the downloaded `mobile/credentials.json` and `mobile/credentials/` (they hold
   the keystore and its passwords; both are ignored by git and `.easignore`, but do not
   leave them around) and rebuild. Alternatively, ask Google to reset the upload key in
   Play Console (Test and release > App integrity > Play app signing) and register the
   new certificate; this can take a couple of days.

**Upgrading the Expo SDK:** the packages Expo pins (`react`, `react-native`, `typescript`,
`@react-native-async-storage/async-storage` and others) are excluded from Renovate in
`renovate.json`. Upgrade them together in a dedicated PR with `npx expo install expo@<next> --fix`,
and move the `<58.0.0` cap on Expo packages in `renovate.json` at the same time.

### Security Scanning

- **License compliance**: Fails on GPL/LGPL/AGPL/SSPL licenses
- **Vulnerability scanning**: Trivy scans for CVEs
- **SBOM generation**: Creates Software Bill of Materials

Suppress false positives in `.trivyignore`

## Future Architecture

See GitHub issues #35-#40 for Firebase migration roadmap:

1. **Abstract storage layer** - Decouple business logic from file storage
1. **Firebase/Firestore** - Cloud storage for GPX files and data
1. **Docker/Cloud Run** - Containerized deployment
1. **Zero-cost production** - Deploy on GCP free tier

## Questions?

- Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Open a [GitHub Issue](https://github.com/SkaneTrails/skane-trails-checker/issues)
- Read [copilot-instructions.md](../.github/copilot-instructions.md) for AI coding agent guidelines
