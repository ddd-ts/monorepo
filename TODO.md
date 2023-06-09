# TODO

mandatory:

- [x] snapshot write model
- [x] cross aggregate projections

cleanup:

- [ ] clean projection
- [ ] clean es aggregate
- [ ] logging

next:

- [x] versionned serializers
- [ ] automated snapshot migrations
- [ ] automated event upcasting
- [ ] automated event stream migration
- [ ] sagas

reminder:

- [ ] transactionnal snapshot storage


# Release
npm dist-tags @ddd-ts/model | grep latest | awk '{ print $2 }'
npm version -ws 0.0.3-x 
npm publish --access public --workspaces