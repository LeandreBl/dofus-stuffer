# Catalogue du jeu

## Snapshot livré : client Ankama 3.7.4.4

Le catalogue livré provient des données statiques du **client DOFUS PC 3.7.4.4**, construit le 6 octobre 2026 à 18:25:51 UTC, lu le 7 octobre 2026. Les données ont été extraites en lecture seule des bundles Unity et des traductions françaises et anglaises du client installé. Aucun compte, paquet réseau, prix de marché ou script du jeu n'a été exécuté. Le serveur Linux utilise directement le snapshot livré et n'a besoin ni de ce client ni de Python.

`catalog.json` contient **19 classes, 120 caractéristiques nommées, 849 sorts jouables, 1 762 rangs, 3 831 équipements et 521 panoplies**. Les variantes et 13 sorts communs sont inclus ; les sorts internes et de monstres restent exclus de la sélection du personnage. Les identifiants, noms français, jets, conditions, effets, délais et bonus de panoplies sont natifs 3.7.4.4. Les cinq nouveaux trophées Dresseur, Dompteur, Mule mineure, Mule et Mule majeure sont présents, avec leurs icônes locales.

Les **84 passifs d’équipement** référencés par l’action 1175 sont également résolus : nom, description traduite et effets natifs des branches. Ces sorts internes restent attachés aux objets, sans apparaître comme sorts lançables dans le grimoire. Le normaliseur les récupère aussi lors des réimports hebdomadaires ; ils ne sont jamais ajoutés aux statistiques permanentes d’un objet.

L'API publique [DofusDB](https://api.dofusdb.fr/version) était encore en 3.6.12.16 lors de l'audit ; [l'API bêta DofusDB](https://api.beta.dofusdb.fr/version), documentée par [leur organisation](https://github.com/DofusDB), indiquait 3.7.1.1. Ces versions ne sont pas présentées comme la version native du catalogue. Le correctif de secours `patches/3.7.mjs`, limité explicitement à la base 3.6.12.16, n'est **pas appliqué** au snapshot natif ; `patch-3.7-report.json` le confirme.

Le [changelog officiel final 3.7](https://www.dofus.com/fr/mmorpg/actualites/maj/1772037-mise-jour-3-7/details) a été lu et comparé aux données : condition des trophées, rééquilibrages, nouveaux trophées, équipements légendaires, armes Maudites et sorts concernés. Le devblog prospectif sur une refonte des caractéristiques ne remplace pas ces données effectivement livrées.

## Réimport reproductible

Le déploiement dispose aussi d'une **vérification hebdomadaire automatique** via les [releases DofusDude](https://github.com/dofusdude/dofus3-main/releases), sans client du jeu installé. `scripts/refresh-catalog.mjs` résout leurs exports Unity et réutilise le normaliseur ci-dessous. Il prépare un candidat isolé ; le service de maintenance le valide avant publication et refuse les retours de version. Les serveurs et les icônes locales déjà disponibles sont conservés ; une nouvelle icône absente utilise un repère neutre jusqu'à une mise à jour des visuels. Les détails sont dans [le guide de maintenance](../docs/MAINTENANCE.md).

Avec Python et UnityPy 1.25.4, exporter les fichiers statiques d'une installation autorisée du jeu. Les chemins suivants sont des arguments à adapter, pas des dépendances de l'application :

```sh
python -m venv .venv-data
.venv-data/bin/pip install UnityPy==1.25.4
.venv-data/bin/python scripts/extract-local-game-data.py /chemin/vers/Dofus \
  --output data/.cache/local-client.json --unity-version 6000.3.16f1
node scripts/import-game-data.mjs \
  --local-client-data=data/.cache/local-client.json --expected-version=3.7.4.4
node scripts/verify-game-data.mjs
```

Sous Windows, utiliser les exécutables du dossier `.venv-data/Scripts/`. L'extracteur attend `Dofus_Data/StreamingAssets/Content` sous le chemin indiqué. La version Unity 6000.3.16f1 a été relevée dans la version du moteur installé, car certains en-têtes de bundles sont dépourvus de cette information. Les références sérialisées 64 bits sont résolues en Python avant leur passage en JSON afin d'éviter une perte de précision JavaScript.

Le JSON intermédiaire contient les ressources complètes et leurs traductions. `--local-client-data` remplace entièrement la récupération des valeurs par API. `--offline` interdit les téléchargements et réutilise les icônes locales ; `--expected-version` refuse un changement inattendu. Pour réimporter depuis l'API publique : `node scripts/import-game-data.mjs --refresh --expected-version=VERSION_VERIFIEE`. Ne pas remplacer un snapshot récent par une source plus ancienne sans consulter le manifeste.

`data/.cache/` est régénérable et ignoré par Git. Il n'est pas nécessaire pour lancer l'application. L'import normalise les effets `actionId`, les drapeaux de visibilité, de portée modifiable et de forgemagie, puis vérifie les identifiants, les rangs et les statistiques numériques.

## Traçabilité et limites

- `source-manifest.json` contient la version, les comptes, le SHA-256 du catalogue, les empreintes des onze ressources natives et des deux fichiers de langue.
- `asset-sources.json` répertorie les 4 541 images utilisées et leurs sources publiques ; les images sont servies localement sous `/game/`.
- `effects-map.json` associe les identifiants d'actions natifs aux descriptions, caractéristiques, signes et éléments. La caractéristique technique 0 des effets ne constitue pas automatiquement un bonus de PV.
- `punitive-fixture.json` conserve le sort natif 32456 avec ses rangs et effets différés.
- `simulation-limitations.json` conserve les limites connues du moteur, indépendamment de la fraîcheur des valeurs. 25 objets et 22 sorts gardent des avertissements explicites. Un catalogue actuel ne signifie pas que chaque mécanique du jeu est simulée.

Les caractéristiques des objets sont les **meilleurs jets naturels** : maximum d'un bonus, plus faible malus possible. Les bonus exotiques PA/PM sont ajoutés ensuite à l'échelle du stuff, chacun au plus une fois, sans choisir de pièce support. Le drapeau natif `enhanceable` correspond au bit 64 de `m_flags`. Les deux armes Maudites deviennent bien forgeables ; les objets de classe ne le sont pas. Cette donnée reste conservée à titre documentaire : le modèle d'exos globaux ne certifie pas la forgeabilité d'un objet choisi par le joueur. Les jets réels, overmages, probabilités et coûts d'une tentative de FM ne sont pas inventés ; le budget utilise un supplément estimé par type d'exo.

Les critères sont sensibles à la casse : **`pk` désigne le nombre de panoplies actives**, avec au moins deux pièces ; **`Pk` reste l'ancien compteur de bonus de panoplie**. Les 73 conditions natives simples `pk<2` sont présentées comme « Nombre de panoplies actives < 2 ». Certains trophées ont perdu leur ancienne condition : l'import ne leur en réinvente pas. Les critères statistiques, `&`, `|` et parenthèses sont interprétés. Les 72 objets ayant un critère non pris en charge restent conservés avec une condition `unknown`, refusée par la validation stricte. `PO` n'est jamais confondu avec la portée : il s'agit d'une condition liée à un objet.

Les paliers de panoplie représentent chacun le **total** pour le nombre de pièces, pas des bonus à cumuler entre paliers. Les attaques et soins d'armes ne deviennent pas des statistiques permanentes. Les 179 objets avec un passif ou modificateur de sort non intégré portent `unsupportedEffects`, notamment les 26 objets légendaires et les 95 objets de classe. Une contrainte stricte de dégâts ne peut pas être certifiée si de tels effets interviennent.

**Aucun prix de marché n'est fourni par le catalogue.** Le prix PNJ des ressources brutes est ignoré. Les prix sont renseignés par serveur dans l'application ; un connecteur de flux JSON est prêt pour un fournisseur ultérieur, différé à la demande de l'utilisateur.

## Visuels et droits

Les petites images de classes, sorts et équipements proviennent des chemins publics `img/heads`, `img/breeds`, `img/spells`, `img/items` de DofusDB et de son API bêta. La tête de Forgelance indisponible est remplacée par son emblème. Les silhouettes proviennent du CDN public utilisé par [DofusLab](https://github.com/dofuslab/dofuslab/blob/master/server/oneoff/update_class_list.py), chemin `class/sprite/{NomAnglais}_M.png`. Ce sont des sprites fixes ; leur apparence ne change pas avec le stuff.

La planche `stat-icons.png` vient de [Souchy/DofusDB](https://github.com/Souchy/DofusDB/blob/master/db.ts), image [scraped/common/icons.png](https://cdn.jsdelivr.net/gh/Souchy/DofusDB@master/scraped/common/icons.png), déjà intégrée au prototype. Les caractéristiques sans icône connue ont un indicateur neutre.

DOFUS, les données et les visuels restent la propriété de leurs ayants droit, dont Ankama. La licence du code ne couvre pas ces ressources tierces.
