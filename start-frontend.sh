#!/usr/bin/env bash
cd "$(dirname "$0")/frontend"
[ -d node_modules ] || npm install
npm run dev
