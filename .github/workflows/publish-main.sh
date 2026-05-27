#!/bin/bash
set -e

shopt -s nullglob

cd "$RUNNER_TEMP"

tgzs=("$GITHUB_WORKSPACE"/tarballs/*.tgz)
if [ ${#tgzs[@]} -eq 0 ]; then
  echo "ERROR: no tarballs found to publish" >&2
  exit 1
fi

for tgz in "${tgzs[@]}"; do
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
