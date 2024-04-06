#!/bin/bash
set -e

slugify(){
  echo $1 | iconv -t ascii//TRANSLIT | sed -E -e 's/[^[:alnum:]]+/-/g' -e 's/^-+|-+$//g' | tr '[:upper:]' '[:lower:]'
}

latest_upstream=`npm view @ddd-ts/model "dist-tags.latest"`

next_version=`echo $latest_upstream | awk -F'[.-]' '{ print $1 "." $2 "." $3+1 }'`

pnpm --filter "@ddd-ts/*" exec npm pkg set version=$next_version
pnpm --filter "@ddd-ts/*" exec sed -i "s'workspace:\*'$next_version'g" package.json

npm publish --access public --workspaces