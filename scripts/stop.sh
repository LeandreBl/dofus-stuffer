#!/bin/sh
# Stops this project while preserving its Redis volume.
set -eu
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_DIR"
docker compose down
