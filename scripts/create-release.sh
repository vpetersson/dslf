#!/bin/bash

# DSLF Release Helper Script
# Creates a new release with proper semantic versioning
#
# This script automates the release process by:
# - Validating the git repository state (clean working directory, proper branch)
# - Parsing existing tags to suggest next semantic version (patch/minor/major)
# - Running comprehensive quality checks (tests, build, binary validation)
# - Creating and pushing annotated git tags to trigger CI/CD pipeline
#
# The CI/CD pipeline will then automatically:
# - Build cross-platform binaries for Linux, macOS, and Windows
# - Create GitHub releases with downloadable assets
# - Build and push Docker images to Docker Hub and GitHub Container Registry
#
# Usage: ./scripts/create-release.sh
# Prerequisites: Clean git working directory, all tests must pass

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Get the latest tag
latest_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
print_info "Latest tag: $latest_tag"

# Parse version components
if [[ $latest_tag =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)(.*)$ ]]; then
    major=${BASH_REMATCH[1]}
    minor=${BASH_REMATCH[2]}
    patch=${BASH_REMATCH[3]}
    suffix=${BASH_REMATCH[4]}
else
    print_warning "Could not parse latest tag. Starting from v0.0.0"
    major=0
    minor=0
    patch=0
    suffix=""
fi

# Suggest next versions
next_patch="v$major.$minor.$((patch + 1))"
next_minor="v$major.$((minor + 1)).0"
next_major="v$((major + 1)).0.0"

echo
echo "Suggested next versions:"
echo "  1) Patch release: $next_patch"
echo "  2) Minor release: $next_minor"
echo "  3) Major release: $next_major"
echo "  4) Custom version"

read -p "Choose an option (1-4): " choice

case $choice in
    1)
        new_version=$next_patch
        ;;
    2)
        new_version=$next_minor
        ;;
    3)
        new_version=$next_major
        ;;
    4)
        read -p "Enter custom version (e.g., v1.2.3): " new_version
        # Validate version format
        if [[ ! $new_version =~ ^v[0-9]+\.[0-9]+\.[0-9]+.*$ ]]; then
            print_error "Invalid version format. Use semantic versioning (e.g., v1.2.3)"
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
echo "  - Trigger CI/CD pipeline to build and publish release"
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

print_info "✅ Release $new_version created successfully!"
print_info "🚀 CI/CD pipeline will now build and publish the release"
print_info "📦 Check the Actions tab and Releases page on GitHub"
