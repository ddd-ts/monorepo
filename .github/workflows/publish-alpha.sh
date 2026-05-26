#!/bin/bash
set -e

slugify() {
  echo $1 | iconv -t ascii//TRANSLIT | sed -E -e 's/[^[:alnum:]]+/-/g' -e 's/^-+|-+$//g' | tr '[:upper:]' '[:lower:]'
}

branch_slug=$(slugify "$BRANCH_NAME")

if [ -z "$branch_slug" ]; then
  echo "ERROR: branch '$BRANCH_NAME' slugifies to an empty string" >&2
  exit 1
fi

case "$branch_slug" in
  latest|next|beta|alpha|canary|rc|stable)
    echo "ERROR: branch slug '$branch_slug' collides with a reserved npm dist-tag" >&2
    exit 1
    ;;
esac

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
  npm publish "$tgz" --access public --provenance --ignore-scripts --tag "$branch_slug"
done
