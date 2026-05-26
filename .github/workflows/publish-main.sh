#!/bin/bash
set -e

cd "$RUNNER_TEMP"

for tgz in "$GITHUB_WORKSPACE"/tarballs/*.tgz; do
  name=$(tar -xzOf "$tgz" package/package.json | jq -r .name)
  case "$name" in
    @ddd-ts/*) ;;
    *)
      echo "ERROR: refusing to publish unexpected package: $name" >&2
      exit 1
      ;;
  esac
  npm publish "$tgz" --access public --provenance --ignore-scripts
done
