# Vérifications du 7 octobre 2026

Application disponible sur http://localhost:8180. Stack reconstruite après les dernières corrections ; six services démarrés, API, maintenance, Redis et Traefik sains, un worker disponible.

## Contrôles automatisés

- Construction de production des modules partagés, de l'API NestJS et du front React réussie, dans Docker.
- Dernière campagne locale : **176 tests réussis** (110 tests du moteur partagé et des imports, 66 tests API), dont six nouveaux tests de sélection des sorts. Les dix intégrations HTTP/Redis/WebSocket sont ignorées dans cette exécution sans `API_URL` ; elles ont réussi lors de la campagne précédente de 180 tests après la modification du classement des malus. Le dernier front a été construit dans Docker et déployé. Sur Windows, les fichiers temporaires de maintenance sont placés dans `data/.cache/test-tmp` et les intégrations nécessitent l'accès au réseau local.
- `node scripts/verify-game-data.mjs` : contrôle du catalogue natif **3.7.4.4** réussi, avec empreintes, traductions, cinq nouveaux trophées, conditions `pk`/`Pk`, forgeabilité, passifs, Flèche Punitive, Flèche Explosive et présence de toutes les icônes locales.
- Calcul normal/critique, résistances selon la convention documentée, charges réelles de Flèche Punitive, bonus de panoplies et effets non pris en charge.
- Budget inconnu distinct de zéro, inventaire, seuils obligatoires, exclusions, pièces verrouillées, prysmaradites et doubles anneaux hors panoplie.
- Recherche réelle, transition entre panoplies, annulation et alternatives distinctes malgré les permutations des emplacements.
- Coûts 1/2/3/4 des caractéristiques élémentaires, capital par niveau, sagesse/vitalité et parchotage indépendant ; détail base/parcho/stuff/puissance sans effet indu de la puissance sur les caractéristiques secondaires.
- Allocation automatique en fonction des critères, éléments des sorts et prérequis ; mutations de répartition au-delà de la proposition initiale ; mode manuel inchangé. Les points peuvent rester inutilisés si des plafonds obligatoires l'exigent.
- Test live automatique sans base saisie : 398 Force et 3 Vitalité au niveau 200 ; baisse au niveau 100 puis recalcul valide de 265 Force pour 495 points.
- Exos globaux uniques : +1 PA et/ou +1 PM sans attribution à un objet, y compris lorsque tous les équipements sont verrouillés. Les doublons et bonus non autorisés sont refusés. Les suppléments estimés sont ajoutés aux prix normaux des pièces ; un supplément inconnu bloque un budget obligatoire et la possession d'une pièce ne vaut pas possession d'un exo.
- Intégration HTTP/WebSocket : recherche avec une coiffe verrouillée conservée, exo PA global obtenu sans emplacement associé et supplément de 500 000 kamas compté dans le budget.
- Précondition 3.7 : une panoplie complète acceptée, deux panoplies actives refusées pour le trophée concerné. PA/PM/PO utilisables plafonnés à 12/6/6, sans rendre le surplus équipé illégal.
- Validation des requêtes, isolation des recherches par jeton, progression et résultat via Redis/WebSocket, récupération HTTP et reconnexion.
- Critère de chance de critique propre au sort : taux du rang disponible + bonus critiques, bornes 0–100 %, indépendance des dommages critiques et des caractéristiques élémentaires, absence de critique si le taux de base est nul. Le calcul partagé reste utilisable pour les sorts de soutien ; le sélecteur Dégâts & critiques les exclut désormais.
- Coexistence de seuils de dégâts et de probabilité pour un même sort, même priorité ou rang distinct ; validation API des bornes et rejet des options de dégâts incompatibles. Recherche parmi 200 équipements favorisant les dégâts : la probabilité est guidée par les bonus critiques. Intégration réelle du couple de critères via HTTP, Redis, WebSocket et récupération du résultat.
- `DofusStuffer.exe --check` : code 0. Lecture de `.env` : port 8180. Ce contrôle n'est pas un test de clic sur la fenêtre du lanceur.

## Dégâts et objectifs de l'arme équipée

- 769 armes enrichies avec les six paramètres natifs d'attaque, 6 635 effets classifiés par usage en combat. Correction des caractéristiques permanentes de 57 armes : les retraits de PA/PM sur la cible ne sont plus des malus du porteur. Les objets hors armes, sorts, panoplies et caractéristiques du catalogue sont conservés. Manifeste et catalogue vérifiés.
- Calcul par ligne testé : bonus critique de base, caractéristiques et puissance d'arme, dommages fixes et critiques, résistances, multiplicateur armes distinct des sorts, situation mêlée/distance, absence de critique, niveau et données manquantes. Les soins, effets conditionnels ou inconnus ne peuvent pas certifier un seuil de dégâts.
- Deux contraintes d'arme peuvent coexister pour dégâts et probabilité critique. Tests de recherche : allocation Eau et Neutre, changement d'arme avec réallocation vers le nouvel élément, choix respectant simultanément les deux seuils. Les faux identifiants de sort, tours de relance et chances supérieures à 100 sont rejetés.
- Intégration réelle : arme sélectionnée par le worker, dégâts critiques et taux attendus transmis par HTTP, Redis et WebSocket, sans identifiant d'arme figé dans les critères.
- Navigateur sur le profil de test séparé : absence d'arme avec bouton de choix, puis Harpelle équipée. Avec ses seuls bonus et aucun point de base/parcho, aperçu **88–104 normal**, **146–162 critique**, **22 % critique**, deux lignes Feu, 4 PA et 1 utilisation par tour ; contexte de cible à distance affiché. Présentation vérifiée visuellement.
- Enregistrement simultané de dégâts critiques maximisés et d'au moins 75 % critique obligatoire : deux critères distincts à la priorité 5, conservés après rechargement et ajoutés aux sept critères précédents. Réglages du profil utilisateur sur `localhost` inchangés ; profil de test nettoyé après vérification.

## Capacité de recherche augmentée

- Plafond relevé de 100 000 à 10 000 000 candidats par défaut ; `MAX_CANDIDATES` est maintenant transmis par Compose et borné entre 1 000 et 50 000 000. Les caches restent bornés indépendamment de ce plafond.
- Durées de 5 et 10 minutes ajoutées. L'API accepte jusqu'à 600 secondes et refuse 601, les valeurs fractionnaires et les entrées malformées. L'intégration HTTP/Redis/WebSocket vérifie une demande de 600 secondes puis son annulation ; une recherche terminée par la durée l'indique dans son message.
- Recherche réelle distincte sur le catalogue 3.7.4.4, Crâ niveau 200, Intelligence maximisée, allocation automatique, parchotage Intelligence 100 et deux exos autorisés : **159 640 candidats évalués en 13 326 ms**, cinq propositions valides conservées après annulation volontaire. La progression montrait encore l'état `running` à 131 540 candidats. Cette mesure prouve le dépassement de l'ancienne limite, sans garantir un débit constant ni des candidats tous distincts.
- Navigateur : choix de 10 minutes et conservation après rechargement vérifiés dans le profil de test séparé ; durée initiale de 15 secondes restaurée. Les réglages du profil utilisateur n'ont pas été modifiés.

## Conditions d'équipement et limites PA/PM

- Affichage en français commun aux cartes, fiches, diagnostics et violations de recherche. Les seuils des caractéristiques entières deviennent inclusifs (`> 299` donne « au moins 300 », `< 12` donne « au plus 11 »), sans modifier leur évaluation. Les descriptions techniques inconnues sont remplacées par une condition à vérifier en jeu ; leur statut reste non vérifié.
- Bâton Beau vérifié dans le navigateur : « Force : au moins 300 ET (Intelligence : au moins 300 OU Chance : au moins 300 OU Agilité : au moins 300) ». La fiche sépare les groupes « Toutes ces conditions » et « Au moins une de ces conditions », avec la valeur actuelle pour chaque caractéristique. Aucun code `CS`/`CI`/`CC`/`CA` affiché. Tests de frontière à 299/300 et des conditions inconnues réussis.
- Diagnostics testés sur les valeurs brutes avant plafonnement, conditions ET/OU et conditions inconnues, contributeurs aux conflits, doublons d'anneaux de panoplie/Dofus/prysmaradites, bonus de panoplie et bornes PA/PM. Une branche OU non vérifiable n'accuse pas à tort un équipement.
- Aperçu des exos avec la répartition actuelle : conditions des objets, maximum obligatoire demandé, plafond du jeu et autorisations d'exos. Les prix manquants et les objectifs de dégâts non atteints ne rendent pas les pièces incompatibles. Un exo actif reste retirable.
- Profil navigateur de test séparé : Cape Fulgurante et Ceinture Fulgurante, chacune avec `PA < 10`. À 10 PA avec un exo, les deux pièces sont entourées de rouge et le détail donne la valeur en échec. Retirer l'exo rétablit 9 PA et retire les contours rouges ; son ajout est alors bloqué avec l'aperçu explicite « Avec cet exo » à 10 PA.
- Le panneau affiche 12 PA comme plafond du jeu et 9 PA maximum avec ces objets, ainsi que leurs deux conditions. L'exo PM reste proposé de 3 à 4 PM.
- Sélection d'un Anneau de Bouze le Clerc pour le second emplacement alors qu'il occupe déjà le premier : l'aperçu signale le doublon et ne propose pas de retirer ou remplacer l'anneau du premier emplacement. L'action d'équipement refuse le doublon avec une explication.

## Édition simultanée des objectifs d'un sort

- Les deux sections Dégâts et Chance de critique sont activables ensemble ; elles ont chacune leurs réglages et un enregistrement commun. Construction React/TypeScript et images Docker réussies après cette modification de l'interface.
- Profil de test séparé : réouverture de la paire Flèche Punitive, maximisation des dégâts avec seuil critique obligatoire de 75 %, puis maximisation des deux. Les deux lignes restent distinctes et à la priorité 3, sans doublons après rechargement.
- Flèche Explosive sans objectif existant : activation des deux sections puis enregistrement de dégâts maximisés et de 75 % critique. Deux critères ajoutés ensemble à la priorité 4 ; les cinq critères précédents restent présents.
- Aperçu visuel des deux sections vérifié ; aucune erreur JavaScript relevée. Relecture : mise à jour des seuls IDs affichés, conservation des autres variantes/priorités, champs obligatoires désactivés pour les objectifs de maximisation et contrôle de la limite de 40 critères.

## Plafond global d'exos

- Limites 0/1/2 vérifiées dans l'évaluation partagée, la validation des demandes et la recherche. Le plafond peut être sous-utilisé ; les PA/PM naturels ne comptent pas, les exos déjà possédés comptent toujours. Une requête ancienne sans plafond conserve le comportement antérieur.
- Équipements verrouillés : avec un plafond de 1, les priorités choisissent PA ou PM ; deux seuils exigeant simultanément les deux exos ne produisent aucun résultat. Les coûts restent des suppléments distincts.
- Intégration HTTP/Redis/WebSocket : plafonds 0, 1 et 2, respectivement aucun exo, PA et PA+PM dans le scénario testé, avec coûts de 0, 500 000 et 600 000 kamas.
- Navigateur, profil de test séparé : migration sans exos vers un plafond de 0, sélection de 1 avec PA et PM autorisés ; activation d'un PA sur le mannequin puis ajout PM désactivé. Baisse du plafond à 0 : l'exo existant reste visible avec une violation explicite, et son retrait reste possible.
- Après rechargement, le plafond de 1 et les deux types autorisés sont conservés. Aucune erreur JavaScript relevée pendant ce parcours.

## Filtres d'éléments du grimoire

- Construction TypeScript/Vite et reconstruction du service web réussies. Cette évolution ne modifie pas les calculs partagés ni l'API.
- Identification à partir des effets normaux et critiques du rang actuel, ou du premier rang pour les sorts non encore disponibles : les soins et bonus élémentaires ne sont pas classés comme dégâts. Le filtre suit maintenant les sous-sorts et attaques d’invocations, ainsi que les éléments possibles des actions « meilleur élément ».
- Contrôle des données : Punitive Terre, Explosive Feu, Persécutrice Air, Rekop quatre éléments, Tirs Puissants sans dégâts élémentaires identifiés ; catalogue non modifié.
- Contrôle navigateur au niveau 200, Crâ : 57 sorts sans filtre, 10 avec Feu, 19 avec Feu ou Terre. Recherche « punitive » : un résultat avec Feu ou Terre, aucun avec Feu seul ; la fiche hors filtre disparaît aussi.
- Boomerang Perfide reste visible sous Feu et sous Air. « Tous » et l'effacement de la recherche rétablissent les 57 sorts. Les icônes, états de sélection et aperçu ont été vérifiés visuellement ; aucune erreur JavaScript relevée.

## Contrôles dans le navigateur après l'ajout des chances de critique par sort

- Profil de test séparé sur `http://127.0.0.1:8180/`, sans modifier le profil de l'utilisateur sur `localhost`.
- « Mes dégâts » → Flèche Punitive → « Viser un % de critique » : cible initiale 75 %, choix rapides 50/75/100 %, aperçu à 20 % (base 20 + bonus 0). Aucun sélecteur de jet de dégâts ni de relance dans ce mode.
- Choix 100 %, puis bouton d'augmentation : la cible reste plafonnée à 100 %.
- Ajout de 75 % de critique et de 1 000 dégâts minimums en critique sur le même sort : deux lignes distinctes, regroupées à la priorité 3. Les deux critères et leur rang sont conservés après rechargement.
- Aperçu visuel de l'éditeur vérifié ; aucune erreur JavaScript relevée dans ce profil de test.

## Contrôles dans le navigateur après le passage aux exos globaux

- Migration du profil enregistrée : les anciens exos deviennent des bonus globaux, la répartition de 398 Intelligence et 3 Vitalité ainsi que le parchotage sont conservés. Une sauvegarde du profil précédent est conservée localement.
- Dans « Mon stuff », les contrôles « +1 PA exotique » et « +1 PM exotique » sont affichés avec la mention « Objet au choix ».
- Le bandeau de migration demande de renseigner les suppléments dans le Marché : les anciens prix complets des objets FM ne sont pas convertis arbitrairement en suppléments.
- Après rechargement de la version reconstruite : 18 montants à renseigner pour 16 équipements et deux suppléments exo inconnus.

## Contrôles dans le navigateur lors de l'intégration de la répartition automatique

- Migration de l'ancien profil vers l'allocation automatique, sans confirmation de répartition bloquante ; niveau, parchotage, exclusions et priorités conservés.
- Interface : aucune base à saisir en mode automatique, six caractéristiques de parchotage disponibles, mode manuel dans les options avancées.
- Recherche avec le profil affiché (niveau 200, Intelligence prioritaire et parchotage 100) : **100 000 candidats évalués, 89 728 valides, cinq propositions**, en 12,8 secondes jusqu'à la borne de candidats. Ces valeurs décrivent ce lancement et ne constituent pas un engagement de performance.
- Résultat : **398 Intelligence et 3 Vitalité**, soit **995/995 points**, avec les prérequis d'objets respectés. L'interface affiche la base choisie et les coûts par caractéristique après la recherche.
- Tableau à gauche : base, parchotage, stuff, total et total pour les dégâts entre parenthèses ; puissance affichée en points. Exemple du résultat : 398 + 100 + 700 = 1 198 Intelligence, 1 543 avec 345 Puissance pour les dégâts.
- Contrôle visuel du mannequin, des icônes et des PA/PM/PO nommés.
- Rechargement après reconstruction du front : répartition et résultat conservés, aucune erreur dans la console de la page lors de ce contrôle.

## Parcours également vérifiés lors de l'intégration précédente

- Ajout d'un budget de 20 M, déplacement au même niveau que la Force : critères regroupés, aucun coefficient numérique affiché.
- Ajout d'une cible de 1 000 dégâts minimum en critique sur Flèche Punitive, relance à T+2.
- Recherche de cinq secondes : 75 260 combinaisons évaluées, cinq propositions reçues. Ces nombres décrivent ce lancement, sans engagement de performance ni d'optimalité.
- Rechargement de la page et récupération de la recherche terminée.
- Équipement complet autour du personnage, icônes locales, portrait Crâ réel, statistiques et bonus de panoplie visibles.
- Ouverture d'une pièce : caractéristiques, prix, inventaire, retrait et remplacement présents.
- Grimoire et recherche de Flèche Punitive : normal/critique côte à côte, tableau T, T+1, T+2, T+3 et scénario de relance indiqué.
- Affichage des avertissements lorsque le stuff comporte des effets conditionnels non simulés.
- Saisie puis effacement d'un prix de test : compteur revenu à zéro, aucune valeur fictive conservée.
- Version finale : libellé « X / Y objectifs atteints », portrait à jour, aucune erreur JavaScript relevée dans la console de la page.

## Plafonds et maintenance hebdomadaire

- Plafonds effectifs : 12 PA, 6 PM, 6 PO et 50 % pour chacune des cinq résistances élémentaires. Les tests vérifient l'absence de gain de score au-delà du plafond, les seuils API, le détail brut et l'indépendance des résistances fixes et des cibles PvM.
- Navigateur sur un profil de test séparé : saisir 80 % dans une contrainte Terre ramène la cible à 50 %, désactive le bouton d'augmentation et affiche le plafond. Saisir 13 PA conserve la cible à 12. Aucun prix ni critère de test n'a été enregistré ; aucune erreur JavaScript relevée.
- Nouvelle file BullMQ de maintenance, état persistant et lecture des derniers relevés. Tests de refus des régressions, erreurs indépendantes des sources, conservation des prix récents, catalogue corrompu, rechargement et rejet d'une révision client périmée.
- Import réel isolé des exports DofusDude 3.7.4.4 : 19 classes, 120 caractéristiques, 849 sorts, 3 831 objets, 521 panoplies. Candidat accepté par la validation de production. Statistiques d'objets et panoplies identiques au snapshot natif ; écarts sur neuf sorts limités aux espaces insécables et aux représentations de probabilités float32.
- Exécution réelle de `--once` dans le conteneur Linux : catalogue à jour en 3.7.4.4, prix non configurés comme convenu, flux officiel de patch notes refusé en HTTP 403. Ces trois états apparaissent dans Marché.
- Planification lue dans Redis : `0 3 * * 1`, `Europe/Paris`, prochaine exécution le **12 octobre 2026 à 03:00** (01:00 UTC). Le cron fonctionne tant que la stack et son service de maintenance tournent.
- Le flux de prix réel est reporté à la demande de l'utilisateur ; l'adaptateur a uniquement été testé sur des fixtures isolées. Les formules du simulateur ne sont pas réécrites automatiquement à partir du texte d'une annonce.

## Limites de portée

Ces contrôles valident le fonctionnement de cette version, pas l’exactitude exhaustive de toutes les mécaniques Dofus. Les arrondis avec résistances demandent des fixtures en jeu ; le placement sur une carte, l’IA des invocations et les rotations complètes ne sont pas déroulés automatiquement. Les situations déclarées sont utilisées par les calculs décrits ci-dessous. Les prix sont saisis ou importés. Les exos PA/PM sont des bonus globaux et leurs coûts sont des suppléments estimés : le joueur choisit le support, dont la compatibilité FM n’est pas validée par ce modèle. Les jets naturels personnalisés, exos PO et overmages ne sont pas modélisés. Les plafonds PA/PM/PO appliqués concernent l’équipement hors combat. La recherche, y compris la répartition des points, reste heuristique sans preuve d’optimum global.

## Calcul natif de tous les rangs de sorts — 7 octobre 2026

- Tests de couverture : **849 sorts, 1 762 rangs**, tous calculés avec des nombres finis et sans action inconnue dans les cas parcourus. Une dépendance volontairement absente produit un refus explicite.
- Catalogue enrichi : **1 892 sorts internes, 992 états, 103 invocations**, masques de cible, ordre, zones et marqueurs d’effets destinés seulement à l’affichage.
- **98 tests du moteur/imports** et **73 tests API**, dont les neuf parcours sur les services Linux réels : aucune erreur ni test ignoré lors de la vérification avec les services.
- Résultats chiffrés vérifiés : seuils de PV d’Attaque Mortelle, Sobre/Saoul, monstre/invocation, bouclier, portail, dégâts de pièges, coefficients par PA/PM dépensé, dégâts fixes et proportionnels, runes, héritage du Tofu, charges de Glas et tirages natifs de Bluff.
- Épidémie : propagation récursive exclue du total sur une même cible. Piège à Fragmentation : sélection du centre ou de l’anneau concerné, sans additionner les quatre zones.
- Deux situations de Glas restent distinctes dans les critères, puis après passage par le worker, Redis, WebSocket et récupération HTTP du résultat.
- Navigateur : les PV de la cible font varier Attaque Mortelle ; le choix est repris dans « Situation de calcul enregistrée ». Le Tofu propose ses attaques et leurs dégâts normaux/critiques. Le profil utilisateur sur `localhost` est conservé.
- Pandatak : le choix Sobre/Saoul recalcule immédiatement les deux jets (38–42 / 46–50, puis 46–50 / 54–58 sans équipement). Les quatre tirages de Bluff peuvent être sélectionnés séparément ; quatre cartes Pique distinctes donnent 56 en normal et 60 en critique dans le scénario vérifié.
- Contrôle mobile en 390 × 844 : les états, distances de zone et résultats restent accessibles, sans débordement horizontal. Aucune erreur JavaScript relevée. Réglages temporaires du profil de test restaurés après vérification.
- Captures de la version déployée : [bureau](screenshots/sorts-calcul-natif.jpg) et [mobile](screenshots/sorts-calcul-natif-mobile.jpg).

Les sources et limites détaillées sont dans `data/README.md`, `data/CALCULATION_NOTES.md` et le plan produit.

## Préparation du déploiement Linux

Linux est désormais la cible principale. Les scripts `scripts/start.sh` et `scripts/stop.sh` ont passé `sh -n` dans un conteneur Linux sans accès réseau, avec le projet monté en lecture seule. Compose valide les configurations `APP_BIND_ADDRESS=127.0.0.1` et `APP_BIND_ADDRESS=0.0.0.0`. Le service API rapporte `process.platform=linux`, architecture `x64`, et son point de santé confirme Redis et un worker disponibles.

Le démarrage sur un hôte Linux natif distinct n'a pas été effectué : aucun serveur distant n'est raccordé à cette session. Les vérifications portent sur les scripts, la configuration et les services Linux conteneurisés locaux. Aucun port supplémentaire n'a été ouvert sur le poste actuel.

## Bouton de recherche flottant

- Un seul bouton « Trouver mon stuff », fixé en bas à droite, commun aux quatre onglets. Les états de démarrage et de recherche ainsi que les conditions de désactivation sont conservés.
- Vérification dans un profil de navigateur séparé : bouton visible avant et après défilement, sur les quatre onglets en 1 280 × 720, puis en 390 × 844 en haut et en bas de l'atelier. Aucun message d'erreur JavaScript relevé.
- Espace réservé sous le pied de page, notifications remontées au-dessus du bouton, fenêtres de dialogue au-dessus de son calque.
- Compilation TypeScript/Vite réussie et service web Linux reconstruit et démarré avec Docker Compose.

## Passifs et boosts de la prévisualisation

- Onze tests de calcul : présence des métadonnées natives, absence de doublage des bonus permanents, cumul et retrait des objets, tours pairs/impairs du Nébuleux, expiration, Tirs Puissants normal/critique et rang disponible, puissance d’arme distincte des sorts, Cauchemar, Domakuro, Ébène, boosts différés, Dofusteuse, Prynyang et bonus légendaires. Un test API supplémentaire vérifie la validation des métadonnées de passifs.
- Réimport natif isolé avec le normaliseur : 84 descriptions et groupes d’effets de passifs, sans modification des statistiques permanentes, du nombre d’objets ou de sorts jouables. Vérification du manifeste et du catalogue réussie.
- Profil de navigateur séparé : Pourpre, Turquoise, Vulbis et Nébuleux équipés. Pourpre à dix cumuls fait passer Punitive de 54–61 à 59–67 en normal. Avec les quatre passifs et Tirs Puissants normal : 187–211 normal, 223–255 critique, 45 % de critique. Le boost critique donne 208–236 normal, 249–284 critique et 47 %.
- Les relances montrent 30 % de critique dès T+1, après expiration de Tirs Puissants. Les autres bonus expirent suivant les tours restants, et le Nébuleux change de phase.
- Harpelle équipée : Maîtrise d’Arme normale fait passer son aperçu normal de 358–426 à 542–642 dans ce scénario. Les six activations et les dégâts sont conservés après rechargement.
- Affichage mobile en 390 × 844 : cartes sur une colonne, cases accessibles et aucun débordement horizontal. Décocher le Pourpre recalcule immédiatement les aperçus ; retirer l’objet supprime sa carte et son bonus du total. Aucune erreur JavaScript relevée. Le profil de test séparé a été restauré après les vérifications.
- Capture de l’interface avec les six activations : `docs/screenshots/passifs-boosts.jpg`.
- Suite de tests locale réussie et sept tests d’intégration HTTP/Redis/WebSocket réussis sur la stack Linux démarrée, après la fin du déploiement. Les activations de prévisualisation ne sont pas envoyées à l’optimiseur.

## Ordre des points et caractéristiques essentielles

- Répartition des points et tableau base/parcho/stuff : ordre partagé, Vitalité en premier, puis Force, Intelligence, Chance, Agilité et Sagesse.
- Dans « Mon stuff », bloc de synthèse avec Points de vie, PA, PM, Portée, Invocation, Critique et Puissance, icônes natives et totaux effectifs du stuff. Le détail des six caractéristiques de base reste visible juste en dessous.
- Compilation TypeScript/Vite réussie, service web Linux reconstruit et sain. Contrôle navigateur : ordre des six lignes confirmé, sept statistiques essentielles visibles, aucune erreur JavaScript.
- En 390 × 844, les blocs occupent la largeur disponible et le tableau base/parcho/stuff reste lisible sans débordement horizontal. Le profil de test n’a pas été modifié. Capture bureau : `docs/screenshots/caracteristiques-essentielles.jpg`.

## Contraintes de caractéristiques avec puissance

- Option « Avec puissance » sur Force, Intelligence, Chance et Agilité, disponible pour un minimum, un maximum et une maximisation. La mention apparaît dans les priorités et les objectifs du stuff ; le formulaire affiche le total courant et garde la case après rechargement.
- Six nouveaux tests de calcul/validation/recherche : somme base + parcho + équipement + puissance comptée une seule fois, indépendance des contraintes sans puissance, seuils et maximisation, puissance négative, rejet sur les autres caractéristiques, classement d’un objet à puissance et minima d’allocation automatiques. Les prérequis et statistiques utilitaires continuent d’utiliser les vraies caractéristiques.
- Suite locale réussie avec les fichiers temporaires de maintenance dans `data/.cache/test-tmp`. Huit tests d’intégration réussis sur la stack Linux, dont le nouveau test de deux objectifs de Force distincts, avec et sans puissance, conservés via HTTP, Redis, WebSocket et récupération du résultat.
- Navigateur sur profil séparé : Dofus Pourpre équipé, 0 Force + 80 Puissance = 80 pour l’objectif coché ; décocher ramène l’objectif à 0 Force. Case absente sur Vitalité. Réglages d’origine restaurés et objet de test retiré, aucune erreur JavaScript relevée.
- Contrôle en 390 × 844 : case et actions du formulaire accessibles. Largeur de l’atelier corrigée pour éviter qu’une colonne impose sa largeur minimale à la page mobile. Compilation et déploiement réussis. Capture : `docs/screenshots/contrainte-avec-puissance.jpg`.

## Malus permanents dans le classement

- Six tests partagés : une légère baisse de Force surclassée par l'évitement d'un gros malus de Fuite, petit malus compatible avec un gain utile, compensation par équipements/parchotage/base sans effacement de la pénalité, palier de panoplie actif, anneau légal en double, absence de doublage des statistiques dérivées ou de la puissance, échelles PA/PM/PO/critiques/résistances, pénalité indépendante du nombre de critères, maintien des exigences obligatoires et classement sans objectif.
- Deux tests de recherche confirment ces choix dans l'optimiseur. Le dixième test d'intégration vérifie le score diminué et le détail des malus du worker, via Redis, abonnement WebSocket puis récupération HTTP.
- Navigateur sur un profil séparé : Casque du Chafer équipé, quatre malus élémentaires de −50 affichés dans « Malus pris en compte dans la recherche », sans coefficient visible. Retirer l'objet supprime le détail. Aucune erreur JavaScript ; profil restauré après le contrôle.
- Mobile en 390 × 844 : icônes et libellés passent à la ligne sans débordement horizontal. Captures : [bureau](screenshots/malus-classement.jpg), [mobile](screenshots/malus-classement-mobile.jpg).
- Les malus restent autorisés si le compromis est utile ou nécessaire pour un seuil obligatoire. La pénalité concerne les caractéristiques permanentes importées, pas une simulation de tous les risques des passifs conditionnels de combat.

## Aperçu des objets au survol

- Fiche en lecture seule sur les objets du catalogue et les emplacements équipés du mannequin : icône, niveau/type, panoplie, caractéristiques avec unités et malus, conditions en français, effets passifs, paramètres/effets d'arme et prix du serveur quand disponibles. Aucun champ de saisie ni bouton dans le composant d'aperçu.
- Vérification navigateur avec Abracaska : aperçu affiché à l'entrée du pointeur dans la carte du catalogue, quatre caractéristiques complètes dont −20 Fuite et +1 PA, condition « PA : au plus 8 ». Le contenu de l'aperçu contient zéro contrôle interactif ; le clic Équiper conserve son comportement.
- Sur le mannequin, la fiche apparaît aussi lors de la navigation clavier. Échap ferme l'aperçu sans fermer le catalogue. Le clic sur l'objet ouvre la fenêtre d'édition avec ses contrôles et retire l'aperçu. Les emplacements vides ne déclenchent aucune fiche.
- Positionnement dans l'écran, fermeture au défilement/redimensionnement, fiche survolable et défilable pour les objets longs. Contrôle en 390 × 844 : contenu visible et aucun débordement horizontal. Aucune erreur JavaScript. Objet de test retiré et profil restauré.
- Compilation TypeScript/Vite et construction Docker réussies ; dernier service web déployé. Captures : [mannequin](screenshots/objet-survol-stuff.jpg), [catalogue](screenshots/objet-survol-catalogue.jpg), [mobile](screenshots/objet-survol-mobile.jpg).

## Sorts proposés dans Dégâts & critiques

- Six tests de classification : exclusion des boosts natifs et des dégâts indépendants des caractéristiques, rang disponible selon le niveau, dégâts critiques seuls, attaques conditionnelles actuellement nulles, pièges et runes, héritage pertinent des invocations, et terminaison des dépendances cycliques.
- Navigateur sur profil séparé, Crâ niveau 200 : 41 sorts proposés ; Flèche Punitive, Flèche Explosive et Flèche Assaillante sont présents. Rechercher Tirs Puissants avec Toutes les classes donne zéro résultat. Piège Sournois reste proposé dans cette même sélection globale.
- Mes dégâts conserve le grimoire complet de 57 sorts du Crâ et la case Activer le boost Tirs Puissants. Aucun objectif, équipement ou boost de test ajouté, aucune erreur JavaScript relevée.
- Construction Docker web et déploiement réussis. Capture du sélecteur : [contraintes de sorts](screenshots/contraintes-sorts-degats.jpg).

## Prérequis élémentaires sans puissance

- Le moteur de validation, les diagnostics et l'allocation automatique utilisent déjà les caractéristiques réelles pour les conditions d'objets. La puissance reste séparée ; l'option Avec puissance ne concerne que l'objectif utilisateur qui l'active.
- Test de frontière sur Force, Intelligence, Chance et Agilité : base 100 + parchotage 50 + objet 25 + bonus de panoplie 24 donnent 199 et échouent pour `> 199`. Un bonus de panoplie de 25 donne 200 et satisfait la condition. Les résultats restent identiques avec +1 000 ou −1 000 puissance, même en présence d'un objectif Avec puissance.
- Campagne ciblée : 21 tests partagés de diagnostics/prérequis/puissance et 32 tests de recherche réussis, dont l'allocation automatique avec puissance et les prérequis réels. Construction TypeScript/Vite et image Docker web réussies ; front déployé.
- Navigateur, profil séparé : Dofus Pourpre équipé (+80 puissance), aperçu de Pelle Aigante avec 199 Force réelle et 200 Intelligence réelle. La Force échoue et l'Intelligence réussit ; passer la Force réelle à 200 rend les deux prérequis respectés. Mention Valeur réelle, sans puissance affichée dans la fiche. Aucune erreur JavaScript ; objet temporaire retiré, points réinitialisés et mode automatique restauré.
- Capture : [prérequis sans puissance](screenshots/prerequis-sans-puissance.jpg).

## Modifications libres des exos dans Mon stuff

- Les boutons PA et PM exotique restent cliquables, même avec un maximum de recherche à zéro ou un, et même quand leurs types sont désactivés dans l'atelier. Ajouter ou retirer un exo modifie uniquement le mannequin. L'évaluation locale ne crée plus d'incompatibilité liée à ces filtres de recherche.
- Les prérequis d'objets, plafonds du jeu et objectifs obligatoires restent vérifiés. Contrôle avec Abracaska : l'exo PA fait passer de 8 à 9 PA ; la coiffe devient rouge et sa condition « PA : au plus 8 » est affichée. Le bouton peut retirer l'exo, puis le réactiver avec son avertissement « À vérifier ».
- Profil séparé : les deux exos activés avec recherche à zéro, puis conservés après rechargement avec recherche à un. Les réglages de l'atelier restent inchangés par les clics sur les exos. Trois tests ciblés de l'optimiseur réussis ; test d'intégration HTTP/Redis/WebSocket des plafonds 0/1/2 réussi sur les services Linux déployés.
- TypeScript et construction Docker web/API réussis. Capture : [exos libres et coût du stuff](screenshots/exos-prix-stuff.jpg).

## Prix estimé et retrait du choix de créature

- Un bloc visible dans Mon stuff affiche le serveur et le total estimé, exos compris, ou les achats restants selon le carnet. Un coût incomplet reste un sous-total identifié, avec nombre de prix manquants et accès au carnet. Quand aucun prix n'est connu, le montant affiche « À compléter » ; un prix explicitement nul reste accepté.
- Cinq tests ciblés des prix réussis, dont le nouveau cas de sous-total : deux exemplaires d'un anneau sont comptés, un prix manuel remplace le relevé automatique, prix d'objet/exo manquants empêchent toujours de satisfaire un budget obligatoire, et les objets/exos possédés sont déduits en mode achats restants.
- Navigateur : Abracaska à 50 000 kamas et exo PA à 100 000, exo PM inconnu → sous-total 150 000 et un prix manquant ; PM à 200 000 → total 350 000 ; Abracaska déclaré possédé → reste à acheter 300 000. Valeurs saisies uniquement pour ce contrôle, pas des relevés HDV.
- Les sélecteurs « Créature ciblée », « Type de cible » et « Classe de la cible » sont retirés du panneau de situation, dans le grimoire et les objectifs. Les anciens `targetMonsterId`, `targetKind` et `targetClassId` sont supprimés au chargement des aperçus et des objectifs, ainsi qu'à l'enregistrement d'un objectif. Les autres réglages de situation restent disponibles ; le calcul utilise la cible générique par défaut.
- Flèche Harcelante vérifiée dans le grimoire : dégâts normaux 17–19, critiques 20–23, nombre de déclenchements accessible, aucun sélecteur de créature. Le moteur natif conserve ses règles de cible, avec le scénario générique choisi.
- Après redémarrage, un worker de maintenance et le scheduler `weekly-data-refresh` sont présents : lundi 03:00, Europe/Paris, prochaine exécution le 12 octobre 2026. Aucun fournisseur HDV n'a été ajouté.
- Contrôle final après rechargement : les deux exos restent actifs et cliquables avec maximum de recherche à un. Profil de test restauré (aucun objet/exo, aucun prix personnel, mode total, maximum un) ; aucune erreur JavaScript relevée. L'onglet utilisateur sur localhost a été conservé.

## Dommages dans les caractéristiques secondaires

- Ajout de Dommages et Dommages Critiques dans la carte Caractéristiques secondaires de Mon stuff, avec les icônes natives et les totaux de l'évaluation actuelle.
- Compilation TypeScript/Vite et construction Docker réussies ; interface Linux déployée. Navigateur sur profil séparé : valeurs initiales 0/0, puis 5 dommages et 10 dommages critiques après avoir équipé La Mokette. Retirer la cape remet les deux lignes à zéro. Aucun autre réglage modifié, aucune erreur JavaScript relevée.
- Capture : [carte des caractéristiques secondaires](screenshots/caracteristiques-secondaires-dommages.jpg).

## Retrait complet du choix de créature

- Construction Docker web réussie (TypeScript et Vite), service web actualisé.
- Navigateur sur un profil séparé : Remblai, qui possède une branche pour les invocations, affiche 20–22 dégâts normaux et 24–26 critiques sur la cible générique. Aucun sélecteur de créature, de type ou de classe de cible ; le réglage de distance dans la zone reste disponible. Aucune erreur JavaScript, aucun équipement ni objectif modifié.
- Capture : [sort sans choix de créature](screenshots/sorts-sans-selection-creature.jpg).

## Apparence des équipements portés

- Les correspondances d'apparence sont explicites, issues du dataset public de Barbofus : aucune déduction depuis les icônes d'inventaire. 1 696 objets ont leurs modèles inclus, avec les deux apparences des 19 classes. Toutes les coiffes (382), capes (311) et tous les boucliers (129) du catalogue sont couverts. Quatre modèles récents et leurs règles de masquage ont été complétés depuis les ressources publiques du moteur ; leurs sources figurent dans le manifeste.
- Quatre tests réussis : modèles masculins/féminins, changement/retrait d'une pièce, signalement des modèles inconnus, points d'attache familier/montilier et contrôle des fichiers graphiques, textures et animations publiés. Les metadata natifs sont résolus avant JSON, avec gestion des références 64 bits et des bornes non finies.
- TypeScript/Vite et Docker web compilent ; le serveur NestJS compile également et la configuration Compose est valide. Les modèles sont des fichiers statiques inclus dans l'image Linux ; aucun client Dofus, Python ou service de rendu externe n'est nécessaire en production.
- Contrôle navigateur sur le profil séparé 127.0.0.1 : coiffe du Bouftou, Cape Bouffante et Bouclier du Bouftou portés ; Bwak de Terre visible à ses pieds. Changement Femme/Homme et rotation vérifiés. Siroko utilise le squelette monté natif (2) pour une posture assise ; le familier conserve le squelette debout (1). Le Heaume des Gardiens du Sanctuaire, absent du client local, s'affiche correctement. Le passage Crâ → Forgelance actualise le personnage ; aucune erreur ou alerte JavaScript relevée.
- Les apparences inconnues de certaines autres montures sont signalées, en conservant le rendu des équipements disponibles. Les nouveaux imports statistiques ne reconstruisent pas automatiquement ces ressources graphiques ; trois scripts d'import et leurs instructions sont livrés.
- Capture : [tenue portée dans Mon stuff](screenshots/tenue-equipee.png).

## Prix total de la panoplie et achats restants

- La carte Mon stuff affiche toujours la valeur complète des objets et des exos équipés, indépendamment du mode du carnet. Les achats restants figurent sur une ligne distincte ; les montants principaux sont affichés en kamas sans arrondi en millions. Le détail se déplie, avec les icônes et un accès direct à la fiche de chaque pièce.
- Le moteur de recherche et la carte utilisent le même calcul des prix : priorité aux valeurs manuelles, comptage par exemplaire, suppléments exotiques et prix manquants. Les tests ciblés de prix/budgets passent ; les compilations TypeScript du simulateur, du front et de l'API réussissent, ainsi que la construction Docker web.
- Navigateur sur le profil de test séparé : coiffe et cape à 50 000 kamas chacune, exo PA à 1 000 000 → total 1 100 000. La cape déjà possédée ramène les achats restants à 1 050 000, même en mode achats restants. Supprimer le prix de cette cape rend le total incomplet sans invalider les achats restants connus. Les prix saisis servent uniquement à vérifier l'interface, sans constituer des relevés HDV.
- Interface Docker actualisée, aucune erreur JavaScript. Capture : [prix de la panoplie](screenshots/prix-total-panoplie.jpg).

## Relance avec une base verrouillée

- Cadenas directement cliquables sur chaque emplacement équipé, état actif distinct, compteur de pièces conservées et actions Tout verrouiller / Tout déverrouiller. Le bouton flottant devient Relancer avec ma base dès qu'une pièce est imposée. Les verrous ne se modifient pas depuis ces nouveaux contrôles pendant une recherche en cours ; les alternatives qui changeraient la base sont désactivées.
- Le verrouillage retire les exclusions contradictoires et complète une éventuelle liste explicite d'objets autorisés. Retirer tous les objets libère également les verrous. Les limites d'exos, priorités, prix et points de caractéristiques restent indépendants des pièces conservées.
- Trois tests du helper frontend et huit tests ciblés du moteur passent : conservation malgré un stuff initial contradictoire, amélioration des emplacements libres, anneau et Dofus gardés dans leurs emplacements exacts, refus d'une base incompatible avec un seuil obligatoire, exclusions et exos globaux. Vérification TypeScript et construction Docker Linux web réussies.
- Navigateur sur le profil séparé 127.0.0.1 : coiffe du Bouftou et Cape Bouffante verrouillées sans ouvrir de fiche ; recherche de 5 secondes, 18 864 combinaisons évaluées et cinq propositions qui conservent ces deux pièces. Changement d'alternative, déverrouillage groupé, verrouillage des 16 pièces, refus d'une ancienne alternative incompatible et rechargement avec les deux verrous persistants vérifiés. Retirer tous les objets remet le mannequin et les verrous à zéro. Aucune erreur ou alerte JavaScript.
- Captures : [aperçu des cadenas et de la relance](screenshots/base-verrouillee-apercu.png), [page complète](screenshots/base-verrouillee.png). Service web actualisé.

## Fiches d'objets simplifiées et coût total

- Retrait des cases Je possède déjà cet objet et Conserver cet objet pendant la recherche dans les fiches. Les cadenas du mannequin et du catalogue assurent le verrouillage des pièces.
- Retrait du suivi de possession des objets et des exos dans Marché, du mode achats restants et de la ligne Reste à acheter dans Mon stuff. Le prix et les budgets portent sur tous les objets et suppléments du stuff.
- Migration exécutée sur un ancien profil : mode total, listes de possession vidées et exos possédés retirés dans le carnet courant et tous les carnets de serveurs ; prix manuels, prix automatiques, suppléments et personnage conservés. Un reçu de recherche effectué en mode achats restants est détaché pour ne pas restaurer un résultat calculé avec l'ancien budget.
- TypeScript et construction Docker web réussis ; huit tests ciblés du calcul des prix et trois tests des verrous passent. Service web déployé.
- Navigateur sur le profil de test séparé : cadenas de la coiffe fonctionnel, fiche équipée sans aucune case à cocher, prix et actions Équiper / Remplacer / Retirer disponibles. Marché sans cases de possession ni mode de coût, avec un seul sélecteur de serveur, 24 champs de prix d'objets et les deux suppléments exotiques. Aucune erreur ou alerte JavaScript.
- Capture : [fiche d'objet simplifiée](screenshots/fiche-objet-simplifiee.png).

## Icône du site

- Icône originale créée avec imagegen intégré : œuf-bouclier vert et épée centrale, avec transparence native. Source et prompt exact conservés dans [docs/branding](branding/README.md).
- Exports PNG 16, 32, 180, 192 et 512 pixels et ICO 16 / 32 / 48 / 64 pixels vérifiés par décodage : dimensions conformes et alpha conservé. Les fichiers du manifeste existent ; le logo React utilise le PNG 192 pixels, les favicons et l'icône Apple sont déclarés dans le HTML.
- TypeScript et construction Docker Linux réussis. Les sept chemins d'icônes/manifeste répondent en HTTP 200 ; formats image/png et image/x-icon conformes. Le manifeste est servi en application/manifest+json. Configuration Nginx validée et service web actualisé.
- Navigateur sur le profil séparé : nouvelle icône chargée dans l'en-tête, image complète en 192 × 192, trois déclarations de favicon et manifeste présents. Aucune erreur ou alerte JavaScript ; aucun réglage du profil modifié.
- Capture : [icône intégrée au site](screenshots/icone-site.png).

## Vérification avant livraison V1

- `npm test` : 188 tests réussis. Les dix tests d'intégration, ignorés sans URL de service dans cette commande, ont ensuite été exécutés contre les services Docker locaux : dix réussites, aucun échec.
- `npm run build` : compilations du simulateur partagé, de NestJS et du front React réussies.
- Les fichiers de configuration privés, dépendances installées, données temporaires et rapports d'analyse générés restent exclus du dépôt. Le catalogue et les ressources graphiques nécessaires au fonctionnement sous Linux sont inclus.
