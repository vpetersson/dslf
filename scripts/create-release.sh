#!/bin/bash

# DSLF Release Helper Script
# Creates a new release using CalVer (YYYY.MM.MICRO)
#
# This script automates the release process by:
# - Validating the git repository state (clean working directory, proper branch)
# - Working out the next CalVer number for the current month from existing tags
# - Checking that Cargo.toml and Cargo.lock already carry that version
# - Running quality checks (tests, release build, binary validation)
# - Creating and pushing an annotated git tag, then the GitHub release
#
# Pushing the tag triggers CI, which builds and publishes the multi-arch Docker
# images to ghcr.io and Docker Hub, and the SBOM workflow, which uploads SBOMs
# for the tagged version.
#
# Usage: ./scripts/create-release.sh
# Prerequisites: Clean git working directory, all tests must pass, gh CLI

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# CalVer: four-digit year, month without a leading zero, micro from 0.
# The month is unpadded because Cargo requires a SemVer-valid version string and
# SemVer forbids leading zeros, so "2026.09.0" would not parse.
CALVER_RE='^v([0-9]{4})\.(1[0-2]|[1-9])\.([0-9]+)$'

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "This script must be run from within a git repository"
    exit 1
fi

# Validate we're on the master branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "master" ]; then
    print_warning "You are not on the master branch (currently on: $current_branch)"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    print_error "You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Current CalVer series, in UTC so the suggested month does not depend on where
# the release is cut from.
year=$(date -u +%Y)
month=$(date -u +%-m)
series="${year}.${month}"

# Highest micro already released this month. Tags from other months (and the
# pre-CalVer v1.x tags) are ignored: the micro restarts at 0 each month.
latest_micro=$(git tag -l "v${series}.*" \
    | sed -nE "s/^v${series}\.([0-9]+)$/\1/p" \
    | sort -n \
    | tail -1)

if [ -z "$latest_micro" ]; then
    next_version="v${series}.0"
    print_info "No releases yet for ${series}; first one this month"
else
    next_version="v${series}.$((latest_micro + 1))"
    print_info "Latest tag this month: v${series}.${latest_micro}"
fi

echo
echo "Next version: $next_version"
echo "  1) Use $next_version"
echo "  2) Custom version"

read -p "Choose an option (1-2): " choice

case $choice in
    1)
        new_version=$next_version
        ;;
    2)
        read -p "Enter custom version (e.g., v${series}.0): " new_version
        if [[ ! $new_version =~ $CALVER_RE ]]; then
            print_error "Invalid version. Use CalVer: vYYYY.MM.MICRO (e.g. v${series}.0)"
            exit 1
        fi
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

# Check if tag already exists
if git tag -l | grep -q "^$new_version$"; then
    print_error "Tag $new_version already exists"
    exit 1
fi

# The manifest and the tag have drifted apart before. Catch it here rather than
# shipping a binary that reports a version nobody released.
version_number=${new_version#v}
cargo_version=$(sed -nE '0,/^version = /s/^version = "(.*)"$/\1/p' Cargo.toml)
lock_version=$(awk '/^name = "dslf"$/{getline; sub(/^version = "/, ""); sub(/"$/, ""); print; exit}' Cargo.lock)

if [ "$cargo_version" != "$version_number" ] || [ "$lock_version" != "$version_number" ]; then
    print_error "Manifest is at $cargo_version and the lockfile at $lock_version, but you are releasing $version_number"
    echo
    echo "Bump them on a branch, merge that, then re-run this script:"
    echo "    sed -i '0,/^version = /s//version = \"$version_number\"/' Cargo.toml"
    echo "    cargo update --package dslf"
    echo "    git commit -am 'chore: release $new_version'"
    exit 1
fi

print_info "Creating release: $new_version"

# Run tests first
print_info "Running tests..."
cargo test

# Build and verify
print_info "Building release binary..."
cargo build --release

# Test the binary
print_info "Testing binary..."
./target/release/dslf --help > /dev/null

print_info "All checks passed!"

# Confirm release
echo
print_warning "This will:"
echo "  - Create and push tag: $new_version"
echo "  - Publish the GitHub release with generated notes"
echo "  - Trigger CI to build and publish the Docker images and SBOMs"
echo
read -p "Continue? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Release cancelled"
    exit 0
fi

# Create and push tag
print_info "Creating tag $new_version..."
git tag -a "$new_version" -m "Release $new_version"

print_info "Pushing tag to origin..."
git push origin "$new_version"

print_info "Creating GitHub release..."
gh release create "$new_version" --title "$new_version" --generate-notes

print_info "✅ Release $new_version created successfully!"
print_info "🚀 CI will now build and publish the Docker images and SBOMs"
print_info "📦 Check the Actions tab and Releases page on GitHub"
