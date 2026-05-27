#!/bin/bash
set -e

npm --version

latest_upstream=$(npm view @ddd-ts/shape "dist-tags.latest")

next_version=$(echo $latest_upstream | awk -F'[.-]' '{ print $1 "." $2 "." $3+1 }')

pnpm --filter "@ddd-ts/*" exec npm pkg set version=$next_version
pnpm --filter "@ddd-ts/*" exec sed -i "s'workspace:\*'$next_version'g" package.json

mkdir -p "$GITHUB_WORKSPACE/tarballs"
pnpm --filter "@ddd-ts/*" exec pnpm pack --pack-destination "$GITHUB_WORKSPACE/tarballs"
