// dependency-cruiser config: forbid src/ui from importing src/db internals (a layering rule).
module.exports = {
  forbidden: [
    {
      name: 'no-ui-to-db-internal',
      comment: 'UI must not reach into DB internals.',
      severity: 'error',
      from: { path: '^src/ui' },
      to: { path: '^src/db/internal' },
    },
  ],
  options: { doNotFollow: { path: 'node_modules' } },
};
