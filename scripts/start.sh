#!/bin/sh
# Run with: sh scripts/start.sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  printf '%s\n' 'Docker Engine est requis. Installez Docker et le plugin Docker Compose.' >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  printf '%s\n' 'Le plugin Docker Compose est requis (commande docker compose).' >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  printf '%s\n' 'Docker ne répond pas. Vérifiez le service Docker et vos droits d’accès.' >&2
  exit 1
fi
if [ ! -f .env ]; then
  cp .env.example .env
fi

docker compose up --build --detach --wait --wait-timeout 180
docker compose exec -T api node -e '
async function ready() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch("http://127.0.0.1:3000/api/health", { signal: AbortSignal.timeout(2000) });
      const status = await response.json();
      if (response.ok && status.redis && status.workers > 0) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("Le worker ou Redis ne répond pas. Consultez docker compose logs api worker redis.");
}
ready().catch(error => { console.error(error.message); process.exitCode = 1; });
'

PUBLISHED_ADDRESS=$(docker compose port traefik 80)
printf '\nApplication prête : http://localhost:%s\n' "${PUBLISHED_ADDRESS##*:}"
printf 'Adresse publiée : %s\n' "$PUBLISHED_ADDRESS"
case "$PUBLISHED_ADDRESS" in
  0.0.0.0:*|\[::\]:*) printf '%s\n' 'Depuis un autre ordinateur, utilisez l’adresse IP ou le domaine du serveur et ce port.' ;;
esac
printf '%s\n' 'Arrêt : sh scripts/stop.sh'
