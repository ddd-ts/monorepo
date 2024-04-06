#!/bin/bash
set -e

slugify(){
  echo $1 | iconv -t ascii//TRANSLIT | sed -E -e 's/[^[:alnum:]]+/-/g' -e 's/^-+|-+$//g' | tr '[:upper:]' '[:lower:]'
}

branch=`git branch --show-current`
branch_slug=`slugify $branch`

latest_upstream=`npm view @ddd-ts/model "dist-tags.$branch_slug"`
latest_upstream="${latest_upstream:=$branch_slug-0}"

next_version_suffix=`echo $latest_upstream | awk -F'[.-]' '{ print $1 "." $2+1 }'`
next_version="0.0.0-$next_version_suffix"

echo $next_version

pnpm --filter "@ddd-ts/*" exec npm pkg set version=$next_version
pnpm --filter "@ddd-ts/*" exec sed -i "s'workspace:\*'$next_version'g" package.json