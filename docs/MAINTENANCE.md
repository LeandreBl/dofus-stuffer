# Actualisation des données

Le service Docker `maintenance` consomme une file BullMQ séparée des recherches. Le planificateur persiste dans Redis et déclenche une vérification chaque lundi à 03:00, heure de Paris, ainsi qu'au démarrage du service. Une seule maintenance peut s'exécuter à la fois. Linux n'a besoin que de Docker Engine et Compose.

## Configuration

Dans `.env` :

```dotenv
MAINTENANCE_CRON="0 3 * * 1"
MAINTENANCE_TIMEZONE=Europe/Paris
CATALOG_FEED_URL=
PRICE_FEED_URL=
PATCH_FEED_URL=https://www.dofus.com/fr/rss/changelog.xml
```

Relancer `docker compose up --build -d` après une modification de `.env`. Les URL de fournisseurs doivent utiliser HTTPS ; une redirection vers HTTP est également refusée. `MAINTENANCE_TIMEZONE` pilote les changements d'heure ; le fuseau horaire de l'hôte ne remplace pas ce réglage.

## Catalogue

Sans `CATALOG_FEED_URL`, `scripts/refresh-catalog.mjs` vérifie les [releases des données DofusDude](https://github.com/dofusdude/dofus3-main/releases). Les exports bruts Unity sont normalisés par le même importeur que les données du client. Les identifiants de référence 64 bits sont conservés sans arrondi. La liste des serveurs est conservée depuis le catalogue actif, car cette source ne la fournit pas.

Une URL personnalisée doit retourner un JSON conforme au type `Catalog` de `packages/shared/src/types.ts`, avec version numérique, date, classes, caractéristiques, sorts et leurs rangs, équipements, panoplies et serveurs. Elle permet notamment de fournir une correction du même numéro de version ; le contenu reçoit une empreinte SHA-256 distincte.

La maintenance refuse un catalogue plus ancien, malformé ou massivement incomplet. Elle écrit d'abord un candidat puis le publie par remplacement atomique. Une copie précédente est conservée. L'API et les workers relisent le fichier entre les demandes ; une optimisation démarrée conserve son snapshot. Une recherche en attente dont le catalogue a changé est interrompue explicitement et doit être relancée, pour éviter de mélanger deux révisions.

Le volume Docker `game-data` contient le catalogue actif et les rapports. Le snapshot inclus dans l'image reste un secours. La mise à jour des données ne met pas à jour le code des formules : toute nouvelle mécanique exige une adaptation du simulateur et une validation.

## Prix par serveur

Il n'y a **aucun fournisseur de prix HDV branché par défaut**. `PRICE_FEED_URL` doit pointer vers un export réel que le déploiement peut consulter. Un simple catalogue d'objets ne contient pas les prix du marché. Tant qu'aucune URL n'est configurée, l'interface indique cet état et conserve les saisies/imports manuels.

Format attendu (valeurs d'illustration, pas des cotations réelles) :

```json
{
  "updatedAt": "2026-10-07T10:00:00.000Z",
  "servers": {
    "Draconiros": {
      "values": { "123": 250000 },
      "exoCosts": { "actionPoints": 1000000, "movementPoints": 700000 }
    }
  }
}
```

Les clés de `values` sont des identifiants d'équipements présents dans le catalogue actif ; remplacer `123` par un identifiant réel avant utilisation. Les noms des serveurs doivent correspondre à ceux du catalogue. Les prix sont des entiers positifs ou nuls en kamas. `updatedAt` doit être la date de relevé du fournisseur, pas une date inventée à chaque téléchargement. Une observation plus ancienne ne remplace pas une observation récente.

Chaque serveur transmis remplace son précédent relevé automatique ; les serveurs absents conservent le leur. Les prix absents restent inconnus. `exoCosts`, facultatif, contient uniquement le supplément estimé pour un bonus PA ou PM, indépendamment du support choisi par le joueur. La qualité et les jets des objets cotés doivent correspondre au scénario optimisé : les jets naturels maximums du catalogue.

Le navigateur conserve séparément les valeurs automatiques et les corrections manuelles. Une correction manuelle, même à zéro, reste prioritaire lors des actualisations. La possession d'objets/exos ne change pas. Le coût utilisé par le moteur et les aperçus suit la même règle.

## Patch notes

Le flux RSS officiel est lu pour conserver le titre, le lien, la date et un extrait de la dernière publication. Le contenu est traité comme du texte, jamais exécuté ni converti arbitrairement en statistiques. Les chiffres effectivement appliqués viennent du catalogue structuré.

Le 7 octobre 2026, le flux officiel refusait les requêtes automatisées avec HTTP 403 dans l'environnement de développement. Ce cas est enregistré comme échec de la source ; il ne bloque ni le catalogue ni les prix et n'efface pas la dernière note valide. `PATCH_FEED_URL` permet de choisir un autre flux RSS/Atom accessible. Chaque note doit renvoyer vers son annonce officielle en HTTPS sur `dofus.com` ou `ankama.com`, ou un de leurs sous-domaines.

## Vérifier et déclencher une actualisation

```sh
docker compose logs --tail=30 maintenance
docker compose exec maintenance node apps/api/dist/main.js --once
```

La commande manuelle rejoint la même file séquentielle que le cron ; elle ne crée pas une seconde écriture concurrente. Aucune route HTTP publique ne déclenche les imports.

Routes de lecture :

- `GET /api/maintenance` : état du passage, fuseau, horaire configuré et résultat de chacune des sources.
- `GET /api/prices?server=Draconiros` : dernier relevé automatique de ce serveur, date, source et disponibilité.
- `GET /api/catalog` : catalogue actif avec sa version et son empreinte.

Une source indisponible conserve son dernier résultat valide. Les échecs des trois sources sont indépendants. Les fichiers de rapport se trouvent dans `/var/lib/dofus-stuffer` à l'intérieur du conteneur. Les paramètres et identifiants d'accès des URL de fournisseurs ne sont pas affichés dans les réponses publiques.

`docker compose down` conserve les volumes. `docker compose down -v` les supprime : sauvegarder les données avant une suppression volontaire.
