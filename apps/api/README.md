# API et moteur de recherche

L’API NestJS répond derrière Traefik. Un processus distinct exécute la recherche ; BullMQ distribue les travaux, Redis conserve les instantanés et publie les mises à jour, puis la passerelle Socket.IO les transmet aux abonnés autorisés.

## Contrat HTTP et temps réel

- `GET /api/health` vérifie Redis et indique le nombre de workers connectés ainsi que la version du catalogue.
- `GET /api/catalog` expose le catalogue utilisé par le simulateur et les formulaires.
- `POST /api/jobs` reçoit un `OptimizationRequest` défini dans `packages/shared/src/types.ts` et renvoie `{ id, token, status }`.
- `GET /api/jobs/:id`, avec `Authorization: Bearer <token>`, récupère l’instantané persistant, y compris après une déconnexion.
- `POST /api/jobs/:id/cancel`, avec le même en-tête, demande l’arrêt d’une recherche. Le champ JSON `token` reste accepté pour les anciens clients ; les jetons dans les URL sont refusés.
- Socket.IO utilise `/socket.io`. Envoyer `subscribe` avec `{ jobId, token }` puis écouter `job:update`. L’abonnement transmet immédiatement l’instantané courant. `unsubscribe` accepte `{ jobId }`.

Le jeton est une capacité d’accès privée à la recherche. Redis ne conserve que son empreinte ; les messages publiés et les instantanés ne contiennent pas le jeton. Les états finaux sont `completed`, `cancelled` et `failed`. La progression et les résultats restent accessibles pendant au plus 24 heures à compter de la création du jeton. Les files terminées conservent au plus 500 entrées de chaque état ; la file de travaux en attente est limitée à 100.

## Recherche

Les budgets Redis sont partagés entre instances : 20 tentatives de création par minute, 3 recherches simultanées et 1 800 secondes de calcul demandées par tranche de 10 minutes pour une même adresse cliente. Les adresses IPv6 d’un même /64 partagent ce budget. Seul le proxy configuré peut transmettre l’adresse réelle ; les en-têtes d’un client direct ne changent pas son quota. Les sockets sont limités à 10 par client et 200 au total, avec 30 ouvertures par minute et 60 événements d’abonnement par minute et par client. Un socket suit au plus 5 recherches et émet au plus 30 demandes par minute. Les origines autorisées sont définies par `ALLOWED_ORIGINS`.

Le worker explore des remplacements d’une ou deux pièces, des changements de panoplie, la répartition automatique des points de base et plusieurs points de départ. Chaque candidat passe dans le même évaluateur que le navigateur. Seuls les candidats valides sont proposés ; des prix inconnus ne sont jamais assimilés à des prix nuls. Les emplacements Dofus peuvent rester libres.

Un critère de sort avec `metric: "criticalChance"` mesure son pourcentage final de critique, entre 0 et 100, à partir du rang disponible et du bonus `criticalHit` du stuff. Il ne reçoit ni `mode` ni `turnOffset`. Un critère de dégâts séparé peut viser le même `spellId`, avec un autre identifiant de critère et sa propre priorité. La recherche privilégie alors les bonus de chance de critique pour le premier, et les caractéristiques de dégâts pour le second ; les points de base ne sont pas investis dans un élément au seul motif d’une probabilité de critique.

Les exos sont des bonus globaux du stuff : `Build.exoBonuses` peut contenir `actionPoints` et `movementPoints`, une fois chacun, sans association à un objet. Pour chaque candidat, le moteur évalue toutes les combinaisons permises par `filters.allowedExos` et le plafond `filters.maxExos` : aucun bonus, PA, PM ou PA + PM. Ce plafond est un entier de 0 à 2 ; son omission conserve la limite de 2 des anciennes requêtes. Avec une limite de 1 et les deux types autorisés, le moteur choisit le PA ou le PM selon les priorités et peut aussi ne retenir aucun exo. Les PA/PM naturels des objets ne consomment pas ce plafond ; les exos déjà possédés le consomment. Un stuff initial qui dépasse le plafond est refusé avant la mise en file. Cela fonctionne aussi quand tous les objets sont verrouillés. Le joueur choisit ensuite les objets sur lesquels réaliser ses exos.

`prices.exoCosts` indique le supplément estimé de chaque bonus, ajouté aux prix ordinaires des objets. `prices.ownedExos` dispense de ce supplément uniquement en mode `remaining`. Un supplément inconnu reste inconnu et empêche de valider un budget obligatoire lorsqu’un tel bonus est nécessaire. L’API rejette les anciennes associations par emplacement (`exos`, `lockedExos`, `exoValues`, `ownedExoKeys`) ; le worker revalide également les requêtes conservées dans Redis avant de les exécuter.

Une recherche dure de 3 à 600 secondes et dispose d'un plafond de 10 000 000 candidats par défaut. `MAX_CANDIDATES`, transmis au worker par Compose, peut ajuster cette borne entre 1 000 et 50 000 000. La recherche s'arrête à la première limite atteinte : durée choisie ou nombre de candidats. Le nombre évalué dépend du catalogue, des contraintes et du serveur ; le plafond n'est pas une promesse de débit ni de combinaisons toutes distinctes, car le cache est borné à 10 000 évaluations récentes. Les cinq meilleurs équipements sont conservés indépendamment du cache. La progression est publiée au plus trois fois par seconde. Le moteur cède régulièrement l’exécution pour permettre l’annulation et le renouvellement des verrous BullMQ.

Un critère `kind: weapon` évalue l'attaque de l'arme de chaque candidat, avec `mode: normal|critical` et `metric: min|average|max`, ou `metric: criticalChance` pour sa probabilité de critique. Les deux objectifs peuvent coexister. Aucun `spellId`, `statKey` ni `turnOffset` n'est admis ; pour imposer une arme précise, utiliser `filters.lockedSlots.weapon`. L'absence d'arme ou de données d'attaque empêche de satisfaire un seuil obligatoire. L'allocation automatique suit les éléments de l'arme candidate.

Les résultats sont les meilleurs trouvés par cette recherche, sans preuve d’optimalité. L’absence de résultat ne prouve pas l’impossibilité des contraintes. Une recherche en attente est refusée si la version du catalogue a changé avant son exécution.

Les alternatives identiques dont seuls les emplacements des anneaux ou Dofus sont permutés sont regroupées. Deux exemplaires d’un anneau hors panoplie sont autorisés ; les doublons de Dofus ou trophées et les doublons d’anneaux de panoplie sont interdits. Une seule prysmaradite peut être équipée. Les trophées mineur, normal et majeur sont des objets distincts : aucune interdiction par famille de nom n’est ajoutée. Ces règles sont corroborées par les [vérifications publiques de DofusLab](https://github.com/dofuslab/dofuslab/blob/master/client/common/utils.tsx#L1389).

Les totaux utilisables hors combat sont plafonnés à 12 PA, 6 PM et 6 PO, après vérification des prérequis sur les totaux bruts. Les points de base respectent le niveau, les paliers et le parchotage indépendant. En mode automatique, le moteur cherche une répartition et la joint à chaque résultat ; en mode manuel, il valide et conserve la répartition fournie.

## Vérification reproductible

Depuis la racine du dépôt :

```powershell
npm run build -w @dofus/shared
npm run build -w @dofus/api
npm test -w @dofus/api
```

Pour inclure les tests de la stack démarrée sous Linux, indiquer le port `APP_PORT` de `.env` :

```sh
API_URL=http://localhost:8180 npm test -w @dofus/api
```

Équivalent PowerShell :

```powershell
$env:API_URL = 'http://localhost:8180'
npm test -w @dofus/api
Remove-Item Env:API_URL
```

Les tests de la stack vérifient les requêtes invalides, l’accès HTTP sans jeton, l’isolation des abonnements WebSocket, la progression réelle du worker, les résultats publiés via Redis, la récupération HTTP, la reconnexion WebSocket et l’annulation. Ils vérifient aussi le parchotage, les exos globaux avec supplément explicite et plafonds de 0, 1 ou 2, la répartition automatique des points après un changement de niveau, ainsi que deux contraintes distinctes de dégâts et de chance de critique sur le même sort. Ils créent leurs recherches sans effacer les recherches existantes.

## Contrôle des plafonds Redis

Les limites concurrentes disposent aussi d'un contrôle utilisant le vrai Redis de la stack, avec un espace de clés aléatoire isolé et nettoyé à la fin. Depuis la racine sous Linux :

```sh
docker compose exec -T api node --input-type=module < apps/api/test/redis.security.mjs
```

Sous PowerShell, transmettre le fichier avec `Get-Content -Raw apps/api/test/redis.security.mjs | docker compose exec -T api node --input-type=module`. Ce contrôle vérifie les quotas partagés, le plafond global de file, les places par client et leur libération, ainsi que les limites de connexions par client et au total.

## Variables du service

| Variable | Valeur usuelle |
| --- | --- |
| `ROLE` | `api` ou `worker` |
| `REDIS_URL` | `redis://dofus-stuffer-redis:6379` (alias interne dérivé de `COMPOSE_PROJECT_NAME`) |
| `REDIS_PASSWORD` | Mot de passe privé défini dans `.env` |
| `TRUSTED_PROXY_ADDRESSES` | Adresse exacte du Traefik local |
| `TRUSTED_PROXY_HOSTS` | Nom Docker du Traefik existant sur VPS |
| `ALLOWED_ORIGINS` | Origines locales et les deux domaines publics |
| `CATALOG_PATH` | `/app/data/catalog.json` |
| `PORT` | `3000` |
| `MAX_CANDIDATES` | `10000000` |

Le serveur et le worker utilisent le catalogue au démarrage. Après un import, reconstruire et relancer les conteneurs pour utiliser les nouvelles données.
