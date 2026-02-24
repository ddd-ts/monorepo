#!/bin/bash
set -e

slugify() {
  echo $1 | iconv -t ascii//TRANSLIT | sed -E -e 's/[^[:alnum:]]+/-/g' -e 's/^-+|-+$//g' | tr '[:upper:]' '[:lower:]'
}

npm --version

branch=${BRANCH_NAME:-$(git branch --show-current)}
branch_slug=$(slugify $branch)

latest_upstream=$(npm view @ddd-ts/shape "dist-tags.$branch_slug" | awk -F'[.]' '{ print $NF }')
latest_upstream="${latest_upstream:="0"}"

next_version_suffix=$(echo $latest_upstream | awk -F'[.-]' '{ print $1+1 }')
next_version="0.0.0-$branch_slug.$next_version_suffix"

echo $next_version
pnpm --filter "@ddd-ts/*" exec cat package.json
pnpm --filter "@ddd-ts/*" exec npm pkg set version=$next_version
pnpm --filter "@ddd-ts/*" exec sed -i "s'workspace:\*'$next_version'g" package.json

pnpm publish --access public -r --no-git-checks --tag $branch_slug
