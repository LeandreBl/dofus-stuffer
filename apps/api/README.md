# API

L’API NestJS répond derrière Traefik. Elle sert les données dont l’interface a besoin ; la recherche de stuff tourne entièrement dans le navigateur (voir [l’architecture](../../docs/ARCHITECTURE.md#flux-de-recherche)). Le même image exécute le service `maintenance` avec `ROLE=maintenance`.

## Routes

- `GET /api/health` vérifie Redis et indique la version du catalogue.
- `GET /api/catalog` expose le catalogue utilisé par le simulateur, les formulaires et la recherche.
- `GET /api/maintenance` décrit la dernière vérification des sources et la planification.
- `GET /api/prices?server=…` renvoie le dernier relevé automatique d’un serveur connu.
- `GET /api/admin/overview` et `POST /api/admin/maintenance/run` exigent `Authorization: Bearer <ADMIN_TOKEN>` ; sans jeton d’au moins 32 caractères, l’administration répond 404.

Chaque adresse cliente dispose de 240 requêtes par minute, partagées entre instances par Redis ; les adresses IPv6 d’un même /64 partagent ce budget. Seul le proxy configuré peut transmettre l’adresse réelle. Les jetons administrateur erronés consomment un budget distinct de 10 essais par quart d’heure.

## Vérification reproductible

Depuis la racine du dépôt :

```sh
npm run build -w @dofus/shared
npm run build -w @dofus/api
npm test -w @dofus/api
```

`test/optimizer.test.ts` exerce le moteur de recherche partagé via `test/optimize.ts`, qui le pilote comme une île du navigateur. Pour inclure le test de la stack démarrée, indiquer le port `APP_PORT` de `.env` :

```sh
API_URL=http://localhost:8180 npm test -w @dofus/api
```

Le contrôle des limites de débit sur le vrai Redis utilise un espace de clés aléatoire nettoyé à la fin :

```sh
docker compose exec -T api node --input-type=module < apps/api/test/redis.security.mjs
```

## Variables du service

| Variable | Valeur usuelle |
| --- | --- |
| `ROLE` | `api` ou `maintenance` |
| `REDIS_URL` | `redis://dofus-stuffer-redis:6379` (alias interne dérivé de `COMPOSE_PROJECT_NAME`) |
| `REDIS_PASSWORD` | Mot de passe privé défini dans `.env` |
| `TRUSTED_PROXY_ADDRESSES` | Adresse exacte du Traefik local |
| `TRUSTED_PROXY_HOSTS` | Nom Docker du Traefik existant sur VPS |
| `CATALOG_PATH` | `/app/data/catalog.json` |
| `ADMIN_TOKEN` | Secret d’au moins 32 caractères, ou vide |
| `PORT` | `3000` |

Le serveur recharge le catalogue actif publié par la maintenance. Après un import manuel, reconstruire et relancer les conteneurs.
