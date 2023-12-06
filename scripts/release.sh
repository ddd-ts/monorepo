#!/bin/env sh

set -e

NO_FORMAT="\033[0m"
C_RED="\033[38;5;9m"

if [[ ! -z $(git status -s) ]]
then
  echo "${C_RED}Error${NO_FORMAT}: Git working tree must be clean"
  exit 1
fi

# Publish
yarn build
yarn test
yarn bump
npm publish --access public --workspaces

# Reset working tree
git checkout .
rm package-lock.json
