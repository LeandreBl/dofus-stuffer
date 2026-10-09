# Dofus Stuffer

Application web pour préparer et rechercher des stuffs Dofus PC, avec priorité au PvM. Le navigateur affiche les caractéristiques et dégâts ; les recherches longues tournent dans un processus séparé et transmettent leur progression en temps réel.

## Le projet en un coup d'œil

| Fonction | Ce que l'application permet |
|---|---|
| Personnage | Choisir parmi 19 classes, régler niveau et parchotage, optimiser automatiquement les points de base |
| Atelier de recherche | Combiner statistiques, dégâts de sorts ou d'arme, chance de critique et budget ; ordonner les priorités et imposer des seuils obligatoires |
| Équipements | Construire un stuff, verrouiller sa base, exclure des objets et rechercher avec 0, 1 ou 2 exos PA/PM maximum |
| Simulateur | Comparer dégâts normaux et critiques, résistances, états et effets liés dans une situation choisie |
| Apparence | Voir le personnage équipé et orientable, rendu en WebGL dans le navigateur avec les ressources du jeu |
| Prix | Saisir ou importer un carnet par serveur, estimer le coût complet du stuff et les suppléments des exos |
| Recherche dans le navigateur | Explorer des millions de combinaisons sur plusieurs cœurs, suivre les propositions en direct et arrêter à tout moment |
| Données | Utiliser un catalogue livré avec le projet et vérifier automatiquement ses mises à jour chaque semaine |

Le projet est un **monorepo TypeScript avec npm workspaces** : React 19 et Vite pour l'interface, NestJS 11 pour l'API de données, BullMQ et Redis pour la maintenance. La recherche de stuff tourne dans le navigateur, dans des Web Workers, avec le moteur partagé `@dofus/shared`. Le déploiement principal utilise Docker Compose sur Linux.

**Repères :** [lancement Linux](#lancer-sur-linux) · [utilisation](#utilisation) · [périmètre et limites](#périmètre-et-limites) · [architecture et Graphify](#architecture-et-graphify) · [développement](#développement-et-vérifications) · [organisation](#organisation) · [documentation](#documentation).

## Lancer sur Linux

Installer Docker Engine et le plugin Docker Compose, puis cloner le dépôt sur le VPS. Le Traefik déjà installé reste le point d'entrée de l'application.

Préparer une seule fois `.env` à partir de [`.env.example`](.env.example). Renseigner `REDIS_PASSWORD`, puis adapter les noms du réseau Docker, du conteneur proxy, des points d'entrée et du resolver aux paramètres de Traefik existants. Les domaines, images, ports internes, limites de ressources et fournisseurs sont également regroupés dans ce fichier. Les valeurs entre guillemets simples restent littérales, notamment pour un mot de passe contenant des caractères spéciaux.

`TRAEFIK_NETWORK` désigne son réseau Docker partagé et `TRAEFIK_PROXY_HOST` son nom accessible sur ce réseau. Laisser `TRAEFIK_CERT_RESOLVER` vide si Traefik fournit déjà les certificats ; sinon, renseigner le nom de son resolver ACME. Aucun script de lancement, Node.js ou Python n'est nécessaire sur le VPS.

Depuis la racine :

```sh
docker compose up --build -d
```

Compose démarre **quatre services** : `web`, `api`, `maintenance` et `redis`. Il ne lance pas Traefik et ne publie aucun nouveau port. Le front et l'API rejoignent le réseau du proxy existant avec leurs labels de routage. Redis reste sur un réseau interne distinct. Redis utilise le mot de passe de `.env`, conservé hors du dépôt et des images Docker.

`REDIS_URL` doit cibler le nom Redis propre au projet : `redis://${COMPOSE_PROJECT_NAME}-redis:6379`. Ce nom est enregistré uniquement sur le réseau interne et évite qu'une API également reliée à Traefik joigne le Redis d'une autre application. Pour une installation existante utilisant `redis://redis:6379`, modifier cette ligne dans `.env`, puis relancer `docker compose up --build -d` ; les volumes peuvent être conservés.

Avec les domaines fournis, l'interface sera accessible à **https://dofus-stuffer.notdotio.com** et l'API à **https://dofus-stuffer.api.notdotio.com**. Le domaine de l'interface sert aussi `/api`. Les labels prévoient HTTPS, la redirection depuis HTTP et HSTS. Le provider Docker de Traefik doit être actif et ses certificats couvrir les domaines de `.env`. Sa mise à jour reste sous le contrôle de l'administrateur du VPS ; le [rapport de sécurité](docs/SECURITY_AUDIT.md) indique la version vérifiée.

Pour contrôler puis arrêter l'application en conservant les volumes :

```sh
docker compose ps
docker compose logs --tail=100 api maintenance redis
docker compose down
```

Fermer le navigateur ne stoppe pas les conteneurs. Les services redémarrent avec Docker selon `RESTART_POLICY`. Les profils et corrections manuelles de prix sont conservés dans le navigateur.

### Développement local facultatif

Le fichier `compose.local.yaml` ajoute un proxy HTTP local uniquement lorsqu'il est explicitement sélectionné :

```sh
docker compose -f compose.yaml -f compose.local.yaml up --build -d
```

Pour que `docker compose` et `npm start` l'utilisent par défaut, ajouter `COMPOSE_FILE=compose.yaml:compose.local.yaml` dans le `.env` local. Dans ce mode, `web` est un serveur Vite avec rechargement à chaud (sources montées depuis le dépôt) au lieu de nginx. Ce mode est indépendant du Traefik du VPS. Il expose l'interface sur `http://localhost:APP_PORT` ; le poste de développement utilise actuellement le port 8180. Pour arrêter ce mode, utiliser les mêmes deux fichiers avec `down`.

## Utilisation

- Choisir une classe, son niveau et son parchotage. Le moteur répartit automatiquement les points de base pendant la recherche, selon les priorités et les prérequis des objets.
- Ajouter des contraintes au clic parmi les catégories de caractéristiques, les sorts et le prix.
- Dans **Dégâts & critiques**, seuls les sorts disponibles au niveau du personnage dont les dégâts dépendent de ses caractéristiques sont proposés, y compris leurs dégâts indirects. Les boosts restent activables dans la prévisualisation de **Mes dégâts**.
- Les malus permanents diminuent automatiquement le classement, même sur les statistiques sans objectif. Le moteur peut privilégier une petite perte sur une préférence pour éviter de gros malus ailleurs ; le détail reste accessible dans Mon stuff.
- Survoler un objet dans le catalogue ou sur le mannequin affiche son récapitulatif en lecture seule. Cliquer ouvre sa fiche complète pour l'équiper, le remplacer ou modifier ses informations.
- Pour un même sort, activer ensemble les objectifs **Dégâts** et **Chance de critique** dans la même fenêtre : viser le plus de dégâts et un taux critique (0 à 100 %), ou maximiser les deux. Les deux critères restent ensuite classables ensemble ou à des priorités différentes.
- Ordonner les critères et regrouper ceux de même importance. **Les coefficients ne sont pas affichés** : l'ordre et les groupes pilotent le classement.
- Activer « obligatoire » pour les seuils que tout résultat doit respecter.
- Consulter ou construire le stuff autour du personnage, verrouiller des pièces et exclure des objets, types ou catégories.
- Dans **Mon stuff**, cliquer sur le cadenas de chaque objet à conserver puis **Relancer avec ma base** : les pièces verrouillées restent imposées pendant toute la recherche, qui optimise les autres emplacements. Les actions **Tout verrouiller** et **Tout déverrouiller** permettent de gérer la base en un clic ; retirer tous les objets efface aussi les verrous.
- Les prérequis Force, Intelligence, Chance et Agilité utilisent **base + parchotage + équipements et panoplies, sans puissance**. La fiche affiche la valeur réelle comparée au seuil : `Force > 199` exige au moins 200 Force.
- Choisir **0, 1 ou 2 exos maximum** pour l'ensemble du stuff, puis les types autorisés (PA et/ou PM). Avec un maximum de 1 et les deux types autorisés, le moteur choisit PA ou PM selon les priorités. Le joueur choisit ensuite les pièces sur lesquelles réaliser les exos.
- Dans **Mon stuff**, les boutons PA et PM exotique restent toujours cliquables pour tester des modifications, indépendamment de cette limite de recherche. Les incompatibilités réelles restent indiquées ; ces clics ne changent pas les réglages de l'atelier.
- Ouvrir un sort pour comparer dégâts normaux et critiques, minimums, moyens et maximums. Les relances prises en charge sont détaillées par tour.
- Dans « Situation du sort », choisir les états, les PV, les déclenchements, les tirages, les attaques d’invocations ou les runes utiles au calcul. Ces réglages sont conservés quand le sort devient un objectif de recherche.
- Le choix d'une créature nommée a été retiré de la prévisualisation et des objectifs. Les anciens identifiants de créatures sont retirés des situations enregistrées au chargement.
- Filtrer le grimoire par Terre, Feu, Eau, Air ou Neutre, en cumulant les éléments avec la recherche et la classe. Un sort multiélément apparaît dès qu'il correspond à l'un des éléments choisis.
- Renseigner le carnet de prix du serveur, lancer la recherche, suivre sa progression et comparer les stuffs trouvés.
- **Mon stuff** affiche le prix total estimé de la panoplie sur le serveur sélectionné, exos compris. Le détail des prix se déplie au clic ; cliquer sur une pièce ouvre sa fiche. Si des prix manquent, le montant reste un sous-total connu et ne valide pas un budget obligatoire. Les objets et exos déjà possédés ne sont pas distingués : le budget porte sur le stuff complet.

L'onglet des prix accepte un fichier CSV/TSV `id;prix` ou un JSON contenant `values` et éventuellement `exoCosts` (`"actionPoints": 1000000`, par exemple). Les identifiants sont affichés sur les fiches d'objets. Chaque serveur conserve son carnet, avec date de dernière modification ou d'import. Le coût d'un exo est un supplément estimé pour le stuff, séparé du prix des objets normaux. Les anciens profils reprennent le calcul du coût total sans déduction d'inventaire. Pour conserver une pièce pendant la recherche, seul le cadenas est utilisé ; la fiche d'objet n'a plus de case dédiée.

### Personnage et légalité des équipements

Le personnage gagne 5 points de caractéristiques par niveau après le premier. Les quatre caractéristiques élémentaires coûtent 1 point jusqu'à 100, 2 jusqu'à 200, 3 jusqu'à 300, puis 4. La vitalité coûte 1 point et la sagesse 3. Le parchotage, de 0 à 100 par caractéristique, ne consomme pas ce capital et ne décale pas les paliers. **La répartition de base fait partie de l'optimisation**, avec les objets et les bonus exos autorisés. Chaque résultat conserve sa propre répartition, visible dans les caractéristiques. Une option avancée permet de fixer manuellement une répartition légale.

Le tableau à gauche du stuff sépare base, parchotage et équipement. La puissance est affichée en points, entre parenthèses pour les caractéristiques élémentaires : elle intervient dans les dégâts mais ne fournit pas de prospection, initiative, tacle, fuite, soins ou prérequis supplémentaires.

Les anneaux identiques de panoplie sont interdits ; deux exemplaires d'un anneau hors panoplie sont possibles. Les Dofus et trophées identiques ne sont pas cumulables ; une seule prysmaradite est admise. L'évaluation vérifie aussi niveau, emplacements, prérequis, exclusions et verrous. Un stuff peut recevoir au plus +1 PA et +1 PM exotiques parmi les bonus autorisés. Ces bonus restent globaux : aucune pièce n'est désignée ni certifiée compatible pour la réalisation de l'exo. Les totaux utilisables hors combat sont plafonnés à **12 PA, 6 PM, 6 PO et 50 % par résistance élémentaire**, avec un avertissement en cas de surplus équipé. L'éditeur et le serveur bornent également les seuils demandés. Le surplus n'améliore pas le score. Les résistances fixes et les résistances de la cible PvM restent distinctes.

Depuis la [mise à jour 3.7](https://www.dofus.com/fr/mmorpg/actualites/maj/1772037-mise-jour-3-7/details), les trophées concernés demandent **moins de deux panoplies actives**, soit au plus une panoplie d'au moins deux objets, quelle que soit sa taille. Ce compteur est distinct de l'ancienne condition sur le nombre de bonus de panoplie.

Dans **Mon stuff**, les pièces incompatibles sont entourées de rouge et leurs raisons sont accessibles au clic. Les conditions non vérifiables sont distinguées en ambre. Le panneau **Compatibilité du stuff** montre les conditions PA/PM des objets, les plafonds du jeu et les maximums obligatoires demandés. Par exemple, une condition `PA < 10` s'affiche « PA : au plus 9 », même si le plafond général est de 12. Les cartes, fiches et messages de vérification affichent les caractéristiques en français et les groupes ET/OU en clair. La fiche détaille « Toutes ces conditions » et « Au moins une de ces conditions », avec les valeurs du stuff ; un code non interprété est signalé comme une condition particulière à vérifier en jeu.

Les boutons d'exo indiquent si l'ajout est possible, bloqué par une condition ou sans gain utilisable. Un exo déjà actif reste retirable pour corriger un conflit. Cette vérification porte sur le stuff et la répartition actuellement affichés ; elle n'empêche pas l'optimiseur de chercher une autre combinaison légale.

Dans **Mes dégâts**, l'arme équipée dispose de son aperçu : dégâts normaux et critiques par ligne élémentaire, taux critique, coût en PA et moyenne par PA. Les résistances et la situation mêlée/distance sont communes au grimoire. Un objectif **Arme équipée** peut maximiser les dégâts ou imposer un seuil, avec une cible de chance de critique indépendante. Il suit l'arme de chaque stuff candidat ; verrouiller l'emplacement arme permet d'optimiser autour d'une arme précise. Le moteur adapte également la répartition des points à ses éléments de dégâts.

## Périmètre et limites

Le snapshot livré vient des données statiques du **client Ankama 3.7.4.4**, importées le 7 octobre 2026 : 19 classes, 849 sorts jouables, 1 762 rangs, 120 caractéristiques nommées, 3 831 équipements et 521 panoplies, dont les cinq nouveaux trophées 3.7. Le grimoire contient les sorts de classe, variantes et sorts communs. Le moteur charge aussi 1 892 sorts internes, 992 états et 103 invocations pour résoudre leurs effets liés. Les modifications ont été recoupées avec le patch officiel. La maintenance vérifie les exports DofusDude chaque semaine et au démarrage, puis remplace le catalogue uniquement après validation, sans rétrograder sa version.

Les calculs utilisent les meilleurs jets naturels des objets, avec des bonus exos PA/PM à l’échelle du stuff, sans overmage ni jets naturels personnalisés. Le budget des exos est une estimation supplémentaire, indépendante du choix final de leurs supports. Les 1 762 rangs jouables disposent d’un calcul natif dans la situation choisie : effets liés, états, invocations, poisons, pièges, glyphes, runes, dégâts fixes ou proportionnels et branches aléatoires. Les effets uniquement destinés à l’affichage ne sont pas exécutés une seconde fois. Une nouvelle action inconnue ou une donnée manquante reste signalée explicitement. Les prérequis d’équipement inconnus restent non validés.

La table de relance représente un lancement initial puis un unique lancement au tour choisi, sans lancement intermédiaire ni buff externe. Ce n'est pas encore un simulateur complet de rotation.

Dans **Mon stuff**, le personnage porte désormais la coiffe, la cape et le bouclier équipés, avec les modèles du jeu. Les boutons Femme/Homme et les flèches changent son apparence et son orientation. Les familiers et montiliers disponibles sont également représentés. Le rendu WebGL se fait dans le navigateur et les modèles sont inclus dans l'image Docker : aucun service de composition externe n'est appelé à l'ouverture du stuff. Les apparences manquantes, notamment certaines montures, sont signalées explicitement.

Les 19 classes et leurs deux apparences, les 382 coiffes, 311 capes et 129 boucliers du catalogue sont couverts. Les correspondances explicites proviennent des données publiques de [Barbofus](https://barbofus.com/skinator). Les modèles viennent du client local ; quatre modèles absents sont complétés depuis les ressources publiques du moteur [PyDofus](https://github.com/PyDofus/d3-ts-renderer). Leur provenance est conservée dans le manifeste. La version des ressources graphiques reste indépendante de la version des statistiques.

Pour régénérer les apparences après une mise à jour du jeu, exécuter `node scripts/update-character-mapping.mjs`, puis `python scripts/extract-character-assets.py /chemin/vers/Dofus` avec UnityPy 1.25.4. Le complément facultatif `node scripts/complete-character-assets.mjs` récupère les modèles récemment ajoutés absents de ce client. Reconstruire ensuite le service web. Le déploiement Linux utilise les fichiers déjà inclus et ne nécessite ni le client Dofus ni Python. Les mises à jour hebdomadaires de statistiques ne téléchargent pas les modèles graphiques.

La recherche est **heuristique** : elle retourne les meilleurs stuffs trouvés pendant la durée choisie, sans preuve d'optimum global. L'interface propose jusqu'à **10 minutes**, avec un plafond de **10 millions de candidats évalués** par défaut. Le serveur peut ajuster ce plafond via `MAX_CANDIDATES` dans `.env` (1 000 à 50 millions). La durée peut arrêter la recherche avant ce plafond ; le compteur indique les évaluations réalisées, pas une garantie de combinaisons toutes distinctes. Une recherche sans résultat ne démontre pas que les contraintes sont impossibles.

**Aucun fournisseur HDV n'est configuré par défaut.** La maintenance peut importer un flux JSON de prix par serveur via `PRICE_FEED_URL` ; tant qu'il n'est pas renseigné, les prix proviennent des saisies et imports de l'utilisateur. Les corrections manuelles restent prioritaires sur le flux. Un prix inconnu ne vaut jamais zéro ; il empêche de garantir un budget obligatoire. Les calculs et arrondis demandent encore une validation élargie sur des cas de référence en jeu, notamment pour les mécaniques spéciales et les résistances.

## Actualisation hebdomadaire

Le service `maintenance` vérifie catalogue, prix configurés et dernière note officielle **chaque lundi à 03:00, heure de Paris**, ainsi qu'au démarrage. Le planificateur BullMQ utilise Redis ; aucun cron supplémentaire n'est à installer sur Linux. Le volume `game-data` conserve les résultats, même après reconstruction des images. L'API relit les nouveaux catalogues entre les demandes.

Les patch notes servent à identifier la dernière publication. Les chiffres sont importés depuis les données structurées du jeu : le texte d'une annonce ne suffit pas à modifier automatiquement une formule ou une mécanique du simulateur. Le flux officiel peut refuser la lecture automatisée ; l'échec est affiché, sans effacer les données existantes.

Configuration, format des prix et vérification manuelle : [guide de maintenance](docs/MAINTENANCE.md).

## Architecture et Graphify

La cartographie Graphify regroupe notamment l'orchestration de l'interface, les vues du personnage, les critères, l'optimiseur et la maintenance du catalogue. Elle relie la recherche (**interface → Web Workers → moteur partagé**) à ses dimensions d'optimisation (**statistiques, dégâts, critiques, exos et répartition des points**). Le schéma ci-dessous reprend ces relations et les complète avec les services définis dans `compose.yaml` et les dépendances du code.

```mermaid
flowchart LR
    browser["Navigateur<br/>React + WebGL"] <-->|HTTP| traefik["Traefik<br/>Point d'entrée"]
    browser <-->|Recherche par îles| islands["Web Workers<br/>Moteur de recherche"]
    traefik -->|Interface et ressources| web["web / Nginx"]
    traefik <-->|Catalogue, prix, admin| api["api / NestJS"]
    api <-->|Limites de débit, file de maintenance| redis["Redis"]
    maintenance["maintenance<br/>Actualisation des données"] <-->|Planification BullMQ| redis
    maintenance -->|Publication validée| data["Volume game-data<br/>Catalogue et relevés de prix"]
    data -->|Catalogue actif| api
    shared["@dofus/shared<br/>Statistiques, dégâts, contraintes et recherche"] -.-> browser
    shared -.-> islands
    renderer["@dofus/renderer<br/>Moteur de rendu du personnage"] -.-> browser
```

Les flèches en pointillés représentent les modules intégrés au code du navigateur. Compose lance **quatre services** : `web`, `api`, `maintenance` et `redis`. Traefik est fourni par le VPS ; le mode local facultatif dispose de son propre proxy.

### Du critère au résultat

1. Le navigateur calcule les aperçus immédiatement avec `@dofus/shared`.
2. Au lancement, il démarre jusqu'à quatre Web Workers (« îles ») qui reçoivent le catalogue déjà chargé, les critères, le scénario, les prix, les exclusions et les verrous. Rien n'est envoyé au serveur.
3. Chaque île mène un recuit simulé sur un modèle vectoriel exact de `evaluateBuild` : remplacements de pièces et de panoplies, allocations de caractéristiques et exos autorisés. Les îles partagent régulièrement leur meilleur stuff.
4. L'interface fusionne les meilleurs résultats, revalidés par `evaluateBuild`, et applique en direct celui qui est sélectionné.

Fermer l'onglet arrête la recherche ; les résultats appliqués restent dans le profil.

### Consulter la cartographie générée

| Fichier Graphify | Contenu |
|---|---|
| [`GRAPH_REPORT.md`](graphify-out/GRAPH_REPORT.md) | Synthèse des communautés, composants centraux et relations entre fichiers |
| [`graph.html`](graphify-out/graph.html) | Visualisation interactive à ouvrir dans un navigateur |
| [`graph.json`](graphify-out/graph.json) | Nœuds, relations, communautés et références aux fichiers sources |
| [`manifest.json`](graphify-out/manifest.json) | Inventaire et empreintes des fichiers analysés |

La génération du **8 octobre 2026** couvre le dossier `apps/` et contient **926 nœuds, 1 683 relations et 81 communautés**. Elle inclut les ressources graphiques et les tests ; les communautés ne correspondent donc pas toutes à des modules applicatifs. Les chemins `api/…` et `web/…` du graphe se lisent depuis `apps/`. Les packages, l'infrastructure et les scripts situés hors de ce périmètre ont été examinés directement pour compléter ce README.

Les principales communautés donnent ces points d'entrée pour explorer le code :

| Communauté Graphify | Sources et responsabilité |
|---|---|
| `Workspace UI Actions` | [`App.tsx`](apps/web/src/App.tsx) : état du profil, équipement, lancement et annulation |
| `Constraints & Criteria` | [`Constraints.tsx`](apps/web/src/Constraints.tsx) : objectifs et priorités de recherche |
| `Character Look Rendering` | [`CharacterPreview.tsx`](apps/web/src/CharacterPreview.tsx) et [`character-look.ts`](apps/web/src/character-look.ts) : apparence et rendu du personnage |
| `Build Optimizer` | [`search.ts`](packages/shared/src/search.ts), lancé par [`useOptimization.ts`](apps/web/src/workspace/useOptimization.ts) dans des Web Workers : exploration et classement des candidats |
| `Catalog & Maintenance` | [`maintenance.ts`](apps/api/src/maintenance.ts) et [`catalog.service.ts`](apps/api/src/catalog.service.ts) : actualisation et chargement du catalogue |

Pour les détails des contrats, de la persistance et des calculs : [architecture complète](docs/ARCHITECTURE.md) et [API](apps/api/README.md).

## Développement et vérifications

Avec **Node.js 22.12 ou supérieur** et npm (Docker utilise Node.js 24) :

```sh
npm ci
npm run build
npm test
```

La compilation couvre le module partagé, NestJS et React. Les tests couvrent calculs, contraintes, moteur de recherche, maintenance et sécurité de l'API. Les tests réseau sont ignorés tant que `API_URL` n'est pas défini.

Une fois les services disponibles, activer les tests HTTP avec le port configuré :

```sh
API_URL=http://localhost:8080 npm test
```

Les contrôles couvrent les routes de données de la stack démarrée. Le [rapport de vérification](docs/VALIDATION.md) détaille les résultats et leur portée ; ils ne certifient pas toutes les mécaniques du jeu.

Pour travailler avec le rechargement du front, `npm run dev:web` lance Vite sur le port 5173. Il attend une API locale sur le port 3000 et lui transmet `/api`. L'API démarre avec `npm run dev:api` et utilise `REDIS_URL`, par défaut `redis://127.0.0.1:6379`. Redis n'est pas publié sur l'hôte par le Compose standard : ce mode nécessite une instance Redis locale accessible ou une configuration Compose de développement adaptée.

## Panel d'administration

`/admin/` affiche l'état de Redis, du catalogue et de la maintenance des données, et permet de lancer cette maintenance. Il est désactivé tant que `ADMIN_TOKEN` (32 caractères minimum, par exemple `openssl rand -base64 32`) n'est pas défini dans `.env`. Les mauvais jetons sont limités à 10 essais par quart d'heure et par adresse. En développement, `npm run dev:admin` lance le panel sur le port 5174 avec la même API locale sur le port 3000.

## Actualiser les données

Le snapshot fourni suffit au démarrage : le serveur Linux n'a besoin ni du jeu ni de Python. Pour régénérer les valeurs depuis une installation du client Dofus, sur le poste d'import uniquement, installer UnityPy 1.25.4 puis utiliser :

```sh
python scripts/extract-local-game-data.py /chemin/vers/Dofus --output data/.cache/local-client.json
npm run data:import -- --local-client-data=data/.cache/local-client.json --expected-version=3.7.4.4
docker compose up --build -d
```

L'import lit uniquement les fichiers statiques du jeu et conserve la provenance, les effets, les icônes et les empreintes. Adapter la version attendue lors d'une future mise à jour vérifiée. DofusDB reste une source d'import alternative, mais renvoyait encore la 3.6 lors de cet audit. Les options sont décrites dans [data/README.md](data/README.md). Après un changement de catalogue, les profils doivent être vérifiés.

## Organisation

| Chemin | Contenu |
|---|---|
| `apps/web/` | Interface React, profils locaux et icônes du jeu |
| `apps/api/` | API NestJS (catalogue, prix, administration) et service de maintenance |
| `packages/shared/` | Contrats, dégâts, statistiques, évaluation des contraintes et moteur de recherche |
| `packages/renderer/` | Moteur WebGL du personnage, avec provenance et références amont |
| `data/` | Catalogue versionné, provenance, effets et cas de référence |
| `infra/` et `compose.yaml` | Images Docker, Nginx et routage Traefik |
| `scripts/` | Import du catalogue et des ressources |
| `tests/` et `apps/api/test/` | Tests du moteur, de l'API et de l'intégration |
| `docs/` | Plan produit, architecture, maintenance et rapports de vérification |
| `graphify-out/` | Inventaire et extraction des relations du projet générés par Graphify |


## Documentation

| Guide | À consulter pour… |
|---|---|
| [Plan produit](docs/PLAN.md) | Comprendre les parcours, les choix fonctionnels et les prochaines extensions |
| [Architecture](docs/ARCHITECTURE.md) | Suivre les services, les flux de recherche, les contrats et la persistance |
| [API](apps/api/README.md) | Intégrer les routes HTTP et configurer le service |
| [Maintenance](docs/MAINTENANCE.md) | Configurer les mises à jour, les flux de prix et les vérifications manuelles |
| [Catalogue et provenance](data/README.md) | Reproduire un import, connaître les sources et leurs limites |
| [Références de calcul](data/CALCULATION_NOTES.md) | Examiner les conventions de simulation et les cas de référence |
| [Rapport de vérification](docs/VALIDATION.md) | Consulter les campagnes de tests et les parcours déjà vérifiés |
| [Audit et corrections de sécurité](docs/SECURITY_AUDIT.md) | Examiner les protections appliquées et le lancement sur VPS avec Traefik |
| [Provenance du renderer](packages/renderer/PROVENANCE.md) | Identifier la source et les adaptations du moteur d'apparence |

## Dépannage Linux

```sh
docker compose logs --tail=100 api maintenance redis
curl https://dofus-stuffer.api.notdotio.com/api/health
```

Le point de santé doit indiquer `redis: true`. Adapter le port à `.env`. Si Docker ne répond pas, vérifier que son service est démarré et que l'utilisateur dispose des droits pour l'utiliser. Les fichiers de configuration sont chargés directement par Compose ; les fins de ligne sont fixées à LF par `.gitattributes`.
