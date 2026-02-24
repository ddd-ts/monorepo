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
pnpm dist-tags @ddd-ts/core | grep latest | awk '{ print $2 }'
pnpm version -ws 0.0.3-x 
pnpm publish --access public --r