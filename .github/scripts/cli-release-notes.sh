#!/usr/bin/env bash
# Prints Markdown release notes for a CLI release, built from the subjects of commits
# that touched cli/ since the previous release tag.
#
set -euo pipefail

current="$1"
prerelease="${2:-false}"
ref="${3:-$current}"
repo="${GITHUB_REPOSITORY:-xerdin442/orbit}"

# Oldest first. versionsort.suffix makes 1.0.0-rc.N sort before 1.0.0.
mapfile -t tags < <(git -c versionsort.suffix=- tag -l 'cli-v*' --sort=v:refname)

prev=""
first=""
for tag in "${tags[@]}"; do
  [ "$tag" = "$current" ] && break
  [ -z "$first" ] && first="$tag"
  if [ "$prerelease" = "true" ] || [[ "$tag" != *-* ]]; then
    prev="$tag"
  fi
done

heading="Changes"
base="${prev:-$first}"
if [ -n "$prev" ]; then
  heading="Changes since $prev"
elif [ -n "$first" ]; then
  # First stable release: cover the release candidates that led up to it.
  heading="First stable release. Changes since $first"
fi

# `base...ref --cherry-pick --right-only` is `base..ref`, minus commits whose changes
# already shipped under another hash (e.g. a commit amended after it was tagged).
range_args=("$ref")
[ -n "$base" ] && range_args=(--cherry-pick --right-only "$base...$ref")

# Housekeeping commit types aren't user-facing.
changes="$(
  git log --no-merges --format='- %s (%h)' "${range_args[@]}" -- ':(top)cli' |
    grep -Ev '^- (ci|chore|tests?|docs|style)(\(|:|!)' || true
)"

echo "## $heading"
echo
if [ -n "$changes" ]; then
  echo "$changes"
else
  echo "_No user-facing changes._"
fi

if [ -n "$prev" ] || [ -n "$first" ]; then
  echo
  echo "**Full diff:** https://github.com/$repo/compare/${prev:-$first}...$current"
fi
