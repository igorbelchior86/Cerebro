#!/bin/bash
# Start the API server from anywhere
exec node "$(dirname "$0")/../apps/api/dist/index.js" "$@"
