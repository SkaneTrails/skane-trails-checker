# Skåne Trails Checker

A free, open-source trail tracker and foraging guide for Skåne, Sweden — built entirely on GCP free tier. Track hiking trails, upload GPX files, manage foraging spots, and explore interactive maps.

Fork this repo, create a GCP project, and follow the [infrastructure guide](infra/environments/dev/README.md) — you'll have your own trail tracker running for free.

## What It Does

### 🥾 Trail Tracking

Browse all 169 Skåneleden etapps (~1,000 km) on an interactive map. Upload your own GPX files from Garmin, Strava, or any GPS device to add regional or worldwide hikes. Mark trails as explored, filter by distance, difficulty, or status.

### 🌿 Foraging Guide

Track seasonal foraging locations — mushrooms, berries, herbs — on a map with monthly filtering. Add custom foraging types with icons, colors, and Swedish names.

### 📍 Points of Interest

Browse curated places and points of interest in Skåne, organized by category.

### 🗺️ Interactive Maps

OpenStreetMap-based maps with trail polylines, color-coded status (blue = explored, orange = to explore), click-to-inspect trail cards, and user location.

## Fully Automated Pipeline

Everything from testing to deployment is automated. Push to `main` and the pipeline takes care of the rest:

| What          | How                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------- |
| **Testing**   | Pre-commit hooks, pytest (API), security scans — all run on every PR                            |
| **Building**  | Docker image built and pushed to Artifact Registry                                              |
| **Deploying** | Terraform applies infrastructure changes, deploys API to Cloud Run, web app to Firebase Hosting |
| **Patching**  | [Renovate](https://docs.renovatebot.com/) keeps all dependencies up to date automatically       |

## Free Tier

The entire stack runs within GCP's always-free tier:

| Service           | Free limit                  |
| ----------------- | --------------------------- |
| Firestore         | 1 GB storage, 50K reads/day |
| Cloud Run         | 2M requests/month           |
| Cloud Storage     | 5 GB                        |
| Artifact Registry | 500 MB                      |
| Secret Manager    | 6 active versions           |

No credit card surprises — the Terraform configuration is designed to stay within these limits.

## Architecture

| Platform       | Stack              | Purpose                             |
| -------------- | ------------------ | ----------------------------------- |
| Mobile + Web   | React Native, Expo | iOS, Android, and web app           |
| API            | FastAPI, Python    | REST backend                        |
| Infrastructure | Terraform, GCP     | Firestore, Cloud Run, Cloud Storage |

## Getting Started

1. **Set up infrastructure** — Follow the [infrastructure guide](infra/environments/dev/README.md) to create your GCP project, bootstrap Terraform, and deploy
1. **Configure local dev** — Follow [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) to set up environment variables and start the API and mobile app locally
1. **Start coding** — Read [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, commit conventions, and testing requirements

## AI-Assisted Development

The project includes [GitHub Copilot](https://github.com/features/copilot) configuration to assist with development. Custom instructions, domain-specific skills, and coding conventions are defined in `.github/` — but none of it is required to contribute. It's there to help, not gatekeep.

## Documentation

| Document                                                             | What's inside                                     |
| -------------------------------------------------------------------- | ------------------------------------------------- |
| [CONTRIBUTING.md](CONTRIBUTING.md)                                   | Git workflow, code style, testing                 |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)                           | Local setup, environment variables, API endpoints |
| [infra/environments/dev/README.md](infra/environments/dev/README.md) | GCP bootstrap, Terraform, CI/CD, variables        |
| [dev-tools/README.md](dev-tools/README.md)                           | Admin scripts and Firestore tools                 |

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
