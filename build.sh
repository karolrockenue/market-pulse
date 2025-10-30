#!/bin/bash
set -e

echo "--- [DEBUG] 1. build.sh script started. Listing root ---"
ls -laR

echo "--- [DEBUG] 2. Entering /web and installing ---"
cd web
yarn install --frozen-lockfile --production=false

echo "--- [DEBUG] 3. Building React app ---"
yarn build

echo "--- [DEBUG] 4. Listing /web after build ---"
ls -laR

echo "--- [DEBUG] 5. Moving web/build to /public ---"
mv build ../public

echo "--- [DEBUG] 6. Returning to root and listing after move ---"
cd ..
ls -laR

echo "--- [DEBUG] 7. Build finished ---"