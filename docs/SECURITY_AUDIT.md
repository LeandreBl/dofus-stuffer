# Audit de sécurité de Dofus Stuffer

Audit initial du 8 octobre 2026, sur le commit `f751c4dbf77b6937d692ec884a50c2ec6c8e7c41` et le service local `http://127.0.0.1:8180`. Les cinq constats ont ensuite été corrigés, dans l'ordre S01 à S05, et la stack locale a été reconstruite et redémarrée. La configuration du VPS réutilise le Traefik existant pour `dofus-stuffer.notdotio.com` et `dofus-stuffer.api.notdotio.com`. Son activation et les certificats publics restent à vérifier après le lancement sur ce serveur par l'opérateur.

Les dépendances npm verrouillées ne présentent aucun avis de vulnérabilité connu dans le résultat obtenu pendant l’audit. Ce résultat ne couvre pas les images Docker, leurs bibliothèques système ou l’ensemble du code du renderer embarqué.

## Corrections et vérification finale

| Référence | Correction appliquée | Vérification |
| --- | --- | --- |
| S01 | Image du proxy local fixée à 3.7.14 dans `.env.example` ; le proxy partagé du VPS reste administré séparément | Binaire local 3.7.14 / Go 1.26.8, routage HTTP et Socket.IO fonctionnels ; version du VPS à vérifier par son administrateur |
| S02 | Proxy de confiance défini par adresse exacte ou nom Docker résolu ; quotas partagés dans Redis | Faux `X-Forwarded-For` ignoré dans un essai passant par Traefik ; 60 tentatives concurrentes donnent exactement 20 admissions pour un client, sans affecter un autre client |
| S03 | Réservation atomique de capacité Redis et réservation des abonnements en cours | File simulée avec 99 entrées dans le vrai Redis : une seule admission parmi 20 concurrentes ; 5 abonnements admis parmi 7 simultanés |
| S04 | Origines contrôlées, connexions et événements limités par client dans Redis, plafonds globaux et budgets de ressources | Origine étrangère refusée sur la stack ; origine locale acceptée ; 10 connexions admises parmi 15 réservations d'un client, 200 parmi 220 clients distincts |
| S05 | Nginx 1.29.8 avec héritage fusionné, CSP, protection contre le cadrage et politique de confidentialité | En-têtes présents sur HTML, JavaScript, manifeste, ressources du personnage et icônes ; personnage équipé visible, aucune erreur ou alerte dans la console du navigateur |

La version Traefik choisie intègre les correctifs publiés dans la [release officielle 3.7.14](https://github.com/traefik/traefik/releases/tag/v3.7.14). Le lancement standard ne démarre pas Traefik et ne modifie pas le proxy partagé : sa version et ses certificats restent à vérifier par l’administrateur du VPS.

Les protections complémentaires demandées sont également appliquées :

- Lecture et annulation par `Authorization: Bearer <token>` ; aucune capacité dans les URL du frontend. L'ancienne capacité dans le corps JSON d'annulation reste compatible. Une URL contenant un jeton valide ne donne plus accès à un instantané.
- Au plus 3 recherches en attente ou actives par client, 20 tentatives de création par minute et 1 800 secondes de calcul demandées sur 10 minutes. Les réservations client sont libérées sur succès, échec et annulation ; une erreur d'ajout à la file libère aussi sa place. Les IPv6 d'un même /64 partagent ces budgets.
- Au plus 10 connexions temps réel par client et 200 au total, 30 ouvertures par minute et 60 événements d'abonnement par minute et par client, en complément du quota propre à chaque socket. Les baux expirent si une instance disparaît et leur renouvellement ne recrée pas une connexion déjà libérée.
- Redis authentifié par `REDIS_PASSWORD`, défini dans `.env` et transmis seulement aux services Redis, API, worker et maintenance. `.env` est ignoré par Git et exclu des images. Aucun fichier de secret ni initialisation séparée n’est nécessaire. Redis reste sans port publié et sur un réseau interne distinct.
- Conteneurs en lecture seule, capacités supprimées, `no-new-privileges`, limites mémoire, CPU et processus. Le front utilise un utilisateur non privilégié ; seule la maintenance dispose d'un réseau de sortie pour les fournisseurs de données.
- Flux externes obligatoirement en HTTPS, y compris après chaque redirection ; refus des identifiants dans l'URL et des redirections vers HTTP. Les limites de taille et de durée sont conservées.
- Mode VPS sans deuxième Traefik : labels Docker pour les deux domaines, redirection HTTP vers HTTPS et HSTS, réseau externe partagé uniquement par le front et l'API. Les services internes portent `traefik.enable=false`.

Contrôles finaux : compilation complète et construction des images réussies ; **119 tests partagés et 75 tests API réussis**, les 10 tests réseau restent ignorés dans la commande hors ligne. Le test réseau ciblé d'isolation, récupération HTTP, reconnexion, progression et annulation réussit sur la stack corrigée. Il vérifie aussi le refus du jeton dans l'URL et d'un autre jeton au format valide. Les essais Redis utilisent des clés temporaires propres au contrôle, supprimées à sa fin. Une commande Redis sans secret retourne `NOAUTH`. Le corps JSON trop grand retourne 413 avec les en-têtes de protection. La configuration Compose standard contient exactement cinq services, sans Traefik ni secret fichier. Le test ajouté vérifie le mot de passe Redis dans l’environnement, y compris les caractères spéciaux d’URL.

Les preuves des corrections figurent dans `.local/security-audit/` : `corrections-build.log`, `corrections-docker-build.log`, `env-compose-start.log`, `env-compose-ready.log`, `env-tests.log`, `env-live.log`, `env-runtime.json` et `env-redis-regressions.json`. Le [contrôle Redis reproductible](../apps/api/test/redis.security.mjs) est conservé dans le dépôt ; son lancement est documenté dans le guide API. L'observation du navigateur confirme le chargement de l'atelier et le rendu du personnage sans erreur CSP. Les en-têtes et origines ont été contrôlés à nouveau après le passage à `.env`.

### Incident d'authentification Redis au déploiement

Après le déploiement, seule l'API signalait `WRONGPASS`. Le contrôle DNS transmis depuis le VPS montrait que `redis` résolvait encore vers `172.18.0.4` alors qu'aucun conteneur Redis du projet n'existait. L'API, reliée au réseau interne et au réseau Traefik partagé, pouvait donc joindre le Redis d'une autre application. Les alias Docker sont propres à chaque réseau, mais un nom peut désigner plusieurs conteneurs ; la résolution n'est alors pas garantie. [Documentation Docker](https://docs.docker.com/reference/compose-file/services/#aliases).

Le service Redis possède maintenant l'alias interne `${COMPOSE_PROJECT_NAME}-redis`, et `.env.example` utilise `REDIS_URL=redis://${COMPOSE_PROJECT_NAME}-redis:6379`. Une installation existante doit aussi modifier sa ligne `REDIS_URL` dans `.env`, puis recréer les conteneurs avec la commande habituelle. Il n'est pas nécessaire d'effacer les volumes.

Le contrôle de santé Redis exige explicitement la réponse `PONG` : `redis-cli` peut retourner un code de sortie nul malgré un refus d'authentification. Le gateway attend désormais l'événement Redis `ready`, rétablit son abonnement à chaque reconnexion et traite les rejets sans afficher l'objet d'erreur, qui peut contenir le mot de passe.

Vérifications : compilation API et image réussies ; **78 tests API réussis**, dont trois nouveaux contrôles de reconnexion et de masquage des identifiants. Une stack temporaire avec deux Redis reproduit le refus avec le nom générique lorsque le Redis du projet est arrêté ; la connexion avec l'alias propre au projet et un mot de passe contenant des caractères spéciaux réussit. Avec un mauvais mot de passe, le nouveau contrôle Redis échoue, l'API reste active sans redémarrage, répond 503 et ses journaux ne contiennent ni identifiant ni erreur d'authentification brute. La stack locale rétablie utilise l'alias propre au projet, avec ses volumes conservés.

## Lancement sur le VPS

Après clonage du dépôt :

```sh
docker compose up --build -d
```

Préparer `.env` à partir de `.env.example`, renseigner `REDIS_PASSWORD` et les noms de réseau, de proxy, de points d’entrée et de resolver déjà configurés sur le VPS. Les domaines, images et ressources sont également dans `.env`. Le provider Docker doit être actif. Les certificats restent gérés par le proxy existant. Aucun accès SSH ni changement sur le VPS n’a été effectué pendant cette correction. Après le lancement, vérifier le certificat des domaines de `.env`, la redirection HTTP et `/api/health` en HTTPS.

## Constats initiaux et priorités

Les descriptions et numéros de lignes ci-dessous se rapportent à la version auditée avant correction.

| Référence | Priorité | Constat | Évidence |
| --- | --- | --- | --- |
| S01 | Élevée | Traefik 3.6.2 est concerné par un déni de service connu | Version active confirmée et avis de l’éditeur |
| S02 | Élevée | Le quota de recherches est partagé entre les visiteurs derrière Traefik | Configuration Express et reproduction isolée |
| S03 | Moyenne | Les plafonds de file et d’abonnements sont contournables par simultanéité | Reproductions sur le code compilé, avec services simulés |
| S04 | Moyenne | Les connexions WebSocket acceptent toute origine et les quotas restent propres à chaque socket | Connexion locale avec origine étrangère acceptée |
| S05 | Moyenne | Les protections du navigateur manquent sur l’interface et certains fichiers statiques | En-têtes HTTP observés et configuration Nginx |

### S01 Traefik expose une version concernée par un déni de service

**Emplacement :** [compose.yaml](../compose.yaml), ligne 4. Le binaire actif confirme la version 3.6.2, compilée avec Go 1.24.10.

L’avis **CVE-2026-25949 / GHSA-89p3-4642-cr2w** concerne Traefik 3.0.0 à 3.6.7 et indique une correction en 3.6.8. Une demande de négociation STARTTLS peut supprimer le délai de lecture et immobiliser des connexions. Le traitement intervient avant le routage : un point d’entrée HTTP est concerné même sans route PostgreSQL. L’accumulation de connexions peut rendre tous les services derrière le proxy indisponibles. La version et le type de point d’entrée correspondent au déploiement ; aucun essai de saturation n’a été effectué. [Avis officiel Traefik](https://github.com/traefik/traefik/security/advisories/GHSA-89p3-4642-cr2w).

**Correction :** remplacer l’image par une version maintenue intégrant les correctifs actuels, puis reconstruire et vérifier le routage HTTP et WebSocket. La version 3.6.8 représente seulement le minimum pour cet avis précis. Le risque réseau augmente si `APP_BIND_ADDRESS` publie le service au-delà de la boucle locale.

L’autre avis [GHSA-gm3x-23wp-hc2c](https://github.com/traefik/traefik/security/advisories/GHSA-gm3x-23wp-hc2c) concerne également cette version et les règles de chemin. Aucun contournement d’authentification applicative n’est établi ici : les routes observées pointent vers des services distincts et n’utilisent pas de middleware d’authentification Traefik.

### S02 Une adresse de proxy partage le quota de tous les visiteurs

**Emplacements :** [app.controller.ts](../apps/api/src/app.controller.ts), lignes 44 à 55 ; [main.ts](../apps/api/src/main.ts), lignes 14 à 19.

Le compteur utilise `request.ip`. L’application ne configure pas `trust proxy`, donc Express utilise l’adresse du pair TCP, qui est Traefik pour le parcours standard. Les visiteurs de ce proxy partagent ainsi les 20 créations autorisées par minute. Express documente cette distinction dans son [guide des proxys](https://expressjs.com/en/guide/behind-proxies/).

Le compteur est consommé avant la validation. Dans une reproduction isolée, vingt corps invalides produisent vingt réponses 400 ; la demande suivante reçoit 429, malgré des adresses `X-Forwarded-For` distinctes. Ces essais utilisent un pair de proxy simulé et ne consomment pas le quota du service actif.

**Impact :** un visiteur peut bloquer temporairement les créations pour les autres avec de petites requêtes invalides. Même un usage normal partagé peut épuiser ce quota global.

**Correction :** définir précisément les proxys de confiance, obtenir l’adresse cliente depuis cette chaîne contrôlée, et stocker les quotas dans Redis pour les partager entre instances. Éviter une confiance générale dans les en-têtes fournis par le client. Conserver un quota sur les tentatives invalides, mais attribuer ce quota au bon client ; ajouter un budget par client pour les recherches simultanées et le temps de calcul demandé.

### S03 Les vérifications des plafonds ne réservent pas les places

**Emplacements :** [jobs.service.ts](../apps/api/src/jobs.service.ts), lignes 32 à 49 ; [jobs.gateway.ts](../apps/api/src/jobs.gateway.ts), lignes 57 à 63.

La file est comptée avant plusieurs opérations asynchrones puis l’ajout du travail. Deux créations peuvent constater chacune 99 travaux, réussir toutes les deux et aboutir à 101, au-delà du plafond de 100. Une reproduction avec Redis et la file simulés confirme ce comportement sur le code compilé.

Le même défaut affecte les abonnements : le nombre de salons est contrôlé avant l’autorisation asynchrone. Sept abonnements envoyés ensemble sur un socket sont acceptés dans la reproduction, alors que le maximum annoncé est cinq. Les capacités sont simulées comme valides ; ce constat ne permet pas d’accéder aux recherches d’un autre utilisateur.

**Correction :** réserver atomiquement la capacité de la file dans Redis et la libérer sur chaque issue du travail, y compris les erreurs. Pour les sockets, sérialiser les abonnements ou compter les réservations en cours, puis les libérer si l’autorisation échoue. Vérifier que les limites restent respectées lorsque les demandes arrivent simultanément.

### S04 Les sockets anonymes échappent à une limite globale

**Emplacement :** [jobs.gateway.ts](../apps/api/src/jobs.gateway.ts), lignes 13 à 17 et 46 à 53 ; [compose.yaml](../compose.yaml), service `api`.

Une connexion WebSocket au service actif avec `Origin: https://audit.invalid` est acceptée. L’abonnement avec un jeton invalide est ensuite refusé, ce qui préserve l’isolation des recherches. Le gateway ne définit aucun contrôle `allowRequest` ; les trente tentatives par minute sont comptées séparément sur chaque socket. Ouvrir une nouvelle connexion fournit donc un nouveau compteur, et aucun plafond de connexions par client n’est défini. Le conteneur API n’a pas de limite mémoire configurée.

**Impact :** accumulation possible de connexions et de demandes d’autorisation, indépendamment des limites de calcul du worker. L’exploitation par un site tiers dépend aussi des restrictions réseau du navigateur ; l’acceptation de l’origine est confirmée avec un client Node. Aucune fuite de résultats par jeton invalide n’a été observée.

**Correction :** valider les origines attendues avec `allowRequest`, limiter les connexions et tentatives par client au niveau du proxy ou dans un compteur partagé, et fixer un budget mémoire pour l’API. Une restriction d’origine complète les quotas ; elle ne remplace pas l’autorisation par jeton. Socket.IO précise que les restrictions CORS ne protègent pas le transport WebSocket. [Documentation Socket.IO](https://socket.io/docs/v4/handling-cors/).

### S05 Nginx perd les en-têtes de protection dans ses locations

**Emplacement :** [nginx.conf](../infra/nginx.conf), lignes 9 à 35.

Le serveur définit `X-Content-Type-Options` et `Referrer-Policy`, mais plusieurs blocs `location` ajoutent leur propre `Cache-Control`. Ces directives remplacent l’héritage des `add_header` du serveur. Les réponses de `/` et du fichier JavaScript principal ne contiennent effectivement ni `nosniff` ni `Referrer-Policy` ; `/game/stat-icons.png`, qui n’a pas cette redéfinition, les conserve. [Règles officielles Nginx](https://nginx.org/en/docs/http/ngx_http_headers_module.html).

La page HTML ne contient pas non plus de politique CSP ou de protection contre son intégration dans un cadre. Helmet protège les réponses de l’API, mais ces en-têtes ne s’appliquent pas au document servi par Nginx. Une injection de script n’est pas établie ; le manque de protection contre le cadrage permet de présenter l’interface dans une page tierce.

**Correction :** utiliser `add_header_inherit merge` avec une version Nginx compatible, ou inclure explicitement les en-têtes dans chaque location concernée. Ajouter une CSP adaptée à l’interface, comprenant `frame-ancestors 'none'` ou une liste d’origines autorisées, et vérifier le renderer, les styles et les sockets. La version active 1.29.8 prend en charge la directive d’héritage introduite en 1.29.3.

## Conditions identifiées avant correction

Le Compose fournit HTTP uniquement. Si le service est publié sur une IP ou un domaine, terminer TLS avec un proxy de confiance et rediriger HTTP vers HTTPS. Les jetons donnent accès aux résultats et à l’annulation ; un transport non chiffré permet leur interception sur un réseau non fiable.

Déplacer également les jetons des URL de récupération vers un en-tête d’autorisation. [api.ts](../apps/web/src/api.ts), ligne 70, les place actuellement dans la query string, ce qui facilite leur collecte par de futurs journaux d’accès ou outils de supervision. Les journaux d’accès Traefik ne sont pas activés dans la configuration auditée.

Pour limiter les conséquences d’une compromission, séparer les réseaux des services et examiner les capacités Docker, `no-new-privileges` et les systèmes de fichiers en lecture seule. Redis n’est pas publié, mais son URL ne comporte aucune authentification et tous les services partagent le réseau Compose par défaut. Les flux de maintenance acceptent HTTP et HTTPS ; imposer HTTPS pour les fournisseurs externes de catalogue et de prix. Ces URL sont une configuration opérateur, et aucun endpoint public ne permet de les modifier : aucun SSRF contrôlable par un visiteur n’est établi.

## Vérifications de l'audit initial

- `npm audit --json` : aucune vulnérabilité signalée, 241 dépendances dans les métadonnées du contrôle.
- `npm test` : 119 tests du moteur partagés et 69 tests de l’API réussis ; 10 tests réseau ignorés dans cette exécution.
- Test réseau ciblé d’isolation des capacités : réussi sur le service actif, avec deux recherches temporaires, récupération, reconnexion et annulation. Il confirme aussi le refus des accès HTTP et WebSocket sans capacité valide.
- Compilation de l’API : réussie avant les reproductions isolées.
- Requête JSON de plus de 512 Kio : rejetée avec HTTP 413. Identifiant valide sans jeton : HTTP 404.
- Inspection des conteneurs : API, worker et maintenance exécutés avec l’utilisateur `node`, aucun conteneur privilégié, Redis non publié et volumes du catalogue montés en lecture seule pour l’API et le worker.
- Revue des entrées Zod, des capacités aléatoires de 256 bits, de la comparaison d’empreintes en temps constant, des appels de maintenance et du rendu React. Aucune exécution de commande contrôlable par une entrée HTTP ni insertion de HTML brut n’a été identifiée dans les chemins examinés.
- Recherche ciblée de formats de clés privées et de jetons connus dans les sources : aucune correspondance. Parmi les fichiers de configuration sensibles recherchés suivis par Git, seul `.env.example` apparaît.

Les preuves locales sont dans `.local/security-audit/` : `npm-audit.json`, `tests-workspace.log`, `live-capabilities.log`, `isolated-probes.json`, `runtime-probes.json` et les scripts de reproduction. Ce dossier est ignoré par Git. La première exécution des tests avait rencontré des restrictions de renommage dans le répertoire temporaire du bac à sable ; l’exécution avec un répertoire temporaire dans le projet réussit.

L’audit comprend une revue manuelle et des essais locaux limités. Il ne constitue pas un scan exhaustif des images et bibliothèques système, une recherche complète de secrets dans l’historique Git ou un test de charge. Les constats initiaux de concurrence utilisent des services simulés pour éviter de remplir la file réelle ; les corrections ont ensuite été testées dans Redis avec des clés isolées. `RTK.md`, référencé par les consignes, n’a pas été trouvé dans le projet ou les emplacements de consignes consultés. Les correctifs applicatifs et le redémarrage local sont décrits en tête de ce rapport ; le déploiement public reste à effectuer par l'opérateur.
