#!/bin/bash

# Exit on error
set -e

echo "Running pnpm clean..."
pnpm clean

echo "Running pnpm install..."
if ! pnpm install; then
  echo "pnpm install failed, retrying with --no-frozen-lockfile..."
  pnpm install --no-frozen-lockfile
fi

echo "Running pnpm build..."
pnpm build

echo "Script completed successfully!"
