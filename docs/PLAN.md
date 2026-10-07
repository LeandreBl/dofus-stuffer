# Plan produit et développement

Dofus Stuffer cible Dofus PC, avec le PvM en premier. La base applicative est maintenant une application React et NestJS, dotée d'un catalogue réel, d'un calculateur partagé et d'une recherche asynchrone. L'ancienne maquette est archivée dans `legacy/prototype/`. Le déploiement cible Linux avec Docker Engine et Docker Compose ; `sh scripts/start.sh` lance la stack.

## Parcours retenu

1. Choisir classe, niveau et parchotage ; laisser le moteur répartir les caractéristiques de base selon les objectifs.
2. Ajouter des critères au clic : statistiques, dégâts ou chance de critique d'un sort, budget ou prix à minimiser.
3. Déplacer les critères par importance et réunir ceux de même importance, sans afficher de coefficients.
4. Distinguer les seuils obligatoires des préférences acceptant un compromis.
5. Consulter le stuff autour du personnage, verrouiller des pièces, autoriser ou exclure des objets et catégories, puis autoriser les bonus exos PA/PM souhaités.
6. Choisir le scénario de dégâts et consulter chaque sort, en normal et en critique.
7. Saisir ou importer le carnet de prix du serveur et renseigner les objets possédés.
8. Lancer une recherche, suivre les améliorations et comparer les résultats.

L'interface privilégie boutons, catégories, listes et valeurs proposées. La saisie reste disponible pour un seuil précis, un prix ou une caractéristique de départ.

## Critères et classement

Les caractéristiques sont identifiées par les icônes du jeu et regroupées en catégories. Le catalogue expose aussi ses caractéristiques moins courantes ; les propriétés techniques ne doivent pas encombrer le parcours principal.

Un même groupe donne la même importance à chacun de ses critères. Les poids sont déduits de l'ordre et restent internes au moteur. Le prix suit cette logique et peut figurer au même niveau que les dégâts ou les statistiques.

L'éditeur d'un sort permet d'activer simultanément les dégâts et la chance de critique. Chaque objectif conserve son choix de seuil ou de maximisation et son caractère obligatoire éventuel. Un seul enregistrement produit les deux critères indépendants ; une nouvelle paire commence au même rang et reste réorganisable dans les priorités.

| Intention | Comportement |
|---|---|
| Atteindre 12 PA | Favoriser les candidats atteignant cette cible |
| Au moins 12 PA, obligatoire | Éliminer les candidats sous le seuil |
| Flèche Punitive critique : minimum X | Évaluer le scénario et le tour choisis |
| Flèche Punitive : au moins 75 % de critique | Taux de base du rang disponible + bonus critiques du stuff, borné de 0 à 100 % ; critère indépendant des dégâts |
| Maximiser un dégât | Continuer à valoriser les gains au-delà de la référence |
| Minimiser le prix | Favoriser les économies selon l'importance attribuée |
| Budget maximal obligatoire | Refuser les candidats trop chers ou au coût inconnu |

Le sélecteur **Dégâts & critiques** propose seulement les sorts disponibles au niveau du personnage dont les dégâts dépendent de ses caractéristiques. Il suit les sous-sorts, pièges, glyphes, runes et attaques d'invocations qui héritent de caractéristiques utiles aux dégâts. Il conserve les attaques conditionnelles même si leur aperçu courant vaut zéro, et exclut les boosts purs, les dégâts fixes et les effets dépendant uniquement de la vie de la cible. Le grimoire complet et l'activation des boosts de prévisualisation restent disponibles dans Mes dégâts.

Les unités sont normalisées pour comparer PA, dégâts et kamas. Une priorité élevée n'implique pas qu'un critère domine toujours tous les suivants réunis. Les exigences obligatoires restent distinctes des préférences. Aucun seuil n'est assoupli silencieusement.

Les malus permanents des objets et des bonus actifs de panoplie diminuent automatiquement le score, même pour une caractéristique sans objectif. Une petite perte sur une préférence peut donc être préférable à des pertes importantes ailleurs. La pénalité augmente avec les pertes et utilise des références par caractéristique ; elle ne devient pas une interdiction d'équiper ni un nouveau poids visible. Le détail des malus est consultable dans Mon stuff.

## Catalogue livré

Le snapshot du **client Ankama 3.7.4.4**, importé le 7 octobre 2026, contient 19 classes, 849 sorts jouables et 1 762 rangs, 120 caractéristiques nommées, 3 831 objets et 521 panoplies. Les cinq nouveaux trophées 3.7 sont inclus. Un service de maintenance vérifie chaque semaine les nouvelles données DofusDude et publie un catalogue validé sans retour de version. Il consulte également la dernière note officielle quand son flux est accessible. La connexion à un fournisseur de prix est reportée ; le connecteur est prêt et les saisies/imports manuels restent actifs. Voir [la maintenance](MAINTENANCE.md).

Le catalogue comprend les sorts de classe, variantes et sorts communs de cette source. Le moteur conserve aussi les sorts internes liés, états et caractéristiques d’invocations. Le calcul porte sur un lancer et une cible, avec les situations choisies dans la fiche ; tous les rangs jouables sont parcourus par les tests de couverture.

Les objets représentent les meilleurs jets naturels. Les exos PA/PM sont des bonus globaux du stuff, chacun limité à +1, choisis par la recherche parmi les bonus autorisés. L'utilisateur fixe un maximum total de 0, 1 ou 2 : avec 1, PA et PM peuvent être candidats mais ne sont pas cumulés. La limite n'impose pas d'utiliser un exo ; les PA/PM naturels des équipements ne sont pas comptés et un exo déjà possédé reste compté. L'utilisateur choisit ensuite les pièces sur lesquelles réaliser ses exos ; l'application ne désigne ni ne valide de support. Les jets personnalisés et overmages restent à ajouter.

## Simulateur et équipement

Le calcul immédiat s'exécute dans le navigateur à partir du module partagé avec le worker. Il produit les dégâts minimums, moyens et maximums en normal et critique, leur espérance et les dégâts par PA. Le scénario précise résistances et distance.

La vue d'équipement présente les emplacements autour d'un personnage portant les objets équipés, les statistiques et les bonus de panoplie. Les exos PA/PM y sont modifiables librement ; le maximum et les types autorisés de l'atelier s'appliquent uniquement à la recherche. Les conditions d'objets et les plafonds restent visibles après les modifications. Le prix estimé indique le serveur, les exos, les achats restants ou les prix manquants. L'onglet des sorts permet de cliquer sur leurs icônes pour ouvrir les détails, sans sélection d'une créature nommée.

L'apparence est rendue localement dans le navigateur avec le moteur WebGL PyDofus et les modèles Bones/Skins du jeu. Les correspondances explicites de Barbofus couvrent les 19 classes, les deux apparences et toutes les coiffes/capes/boucliers du catalogue. Quatre modèles récents absents du client installé sont complétés depuis les ressources publiques du moteur. Le manifeste conserve les sources et la révision graphique, indépendamment du catalogue statistique. Le personnage est orientable et suit les changements d'équipement ; familiers et montiliers utilisent leurs points d'attache natifs. Une apparence indisponible est signalée, sans modèle deviné à partir de l'icône. Ces ressources sont incluses dans Docker et se régénèrent au moyen des scripts d'import graphique ; elles ne dépendent pas du cron des statistiques.

Le panneau de caractéristiques distingue base, parchotage, équipement et puissance applicable aux dégâts. Le capital est de 5 points par niveau gagné ; les paliers élémentaires sont 1/2/3/4 points pour les tranches 0–100/100–200/200–300/au-delà. La sagesse coûte 3 points, la vitalité 1. Le parchotage jusqu'à 100 est indépendant. Le moteur explore des répartitions différentes avec les équipements, puis les compare avec les mêmes critères exacts. Chaque résultat transporte sa répartition. Le mode manuel est une option avancée. La puissance ne fournit ni caractéristiques dérivées ni prérequis ; PA/PM/PO utilisables hors combat sont plafonnés à 12/6/6.

Les règles couvrent les doublons d'anneaux de panoplie, les doublons de Dofus/trophées, la prysmaradite unique, les prérequis d'objets et les verrous. Pour les trophées modifiés en 3.7, « moins de 2 » concerne le nombre de panoplies actives, et non la taille d'une panoplie ni le total des anciens bonus.

Pour les sorts à bonus différé pris en charge, la projection indique le résultat d'un lancement initial puis d'un unique lancement au tour choisi, sans lancer intermédiaire. Une rotation complète devra suivre buffs, charges, états, relances, PA disponibles et changements de cible dans un moteur d'état.

Les états, effets périodiques, invocations et sources de dégâts se règlent dans la fiche de chaque sort. Les runes et tirages aléatoires ont leurs choix propres. La situation est conservée dans l’objectif et évaluée par le worker. Une action inconnue dans un futur catalogue ne doit pas satisfaire un seuil obligatoire. Les arrondis et résistances nécessitent des références supplémentaires vérifiées en jeu avant une certification générale du moteur.

## Recherche en temps réel

L'API valide la demande et la place dans BullMQ. Un worker séparé explore les équipements autorisés, construit plusieurs candidats et les améliore par remplacements, y compris des changements de panoplie. Il réutilise les calculs et conserve plusieurs résultats valides.

Le worker enregistre résultats et progression dans Redis, puis publie une notification. La passerelle Socket.IO s'abonne à Redis et transmet les mises à jour aux navigateurs suivant la recherche. Une reconnexion restitue l'état enregistré ; la fin du calcul ne dépend pas de la présence d'un navigateur connecté.

Le temps de recherche est borné et l'annulation conserve les solutions trouvées. Le résultat s'intitule « meilleur stuff trouvé » : l'heuristique ne démontre pas l'optimalité globale. Une absence de résultat n'est pas une preuve d'impossibilité.

## Budget et économie

Le carnet de prix est séparé par serveur, enregistré dans le navigateur et exportable. Il accepte saisies et imports CSV, TSV ou JSON, avec date de dernière modification/import du carnet. Il ne dispose pas d'une cotation HDV en direct ni d'un historique de chaque transaction.

Le coût total et les achats restants sont deux modes explicites. Les objets possédés réduisent le second. Chaque exo utilisé ajoute un supplément estimé par type, séparé des prix des objets normaux. Un exo déclaré déjà disponible ne génère pas ce supplément en mode « achats restants ». Un prix d'objet ou un supplément exo inconnu reste inconnu : un budget obligatoire exige tous les coûts à payer selon le mode choisi. L'estimation globale de l'exo ne garantit pas le prix de l'objet finalement choisi comme support.

Une alimentation automatique dépendra d'une source vérifiée, datée et adaptée au serveur comme aux jets. La saisie et l'import resteront disponibles.

## Validation et suites

| Étape | Résultat attendu et validation |
|---|---|
| Socle applicatif | Compilation React/NestJS, lancement Compose et archive de la maquette |
| Catalogue et légalité | Références d'emplacements, doublons, prérequis, panoplies, exclusions et objets imposés |
| Calcul direct | Tests normaux/critiques, jets, bonus, cibles et relances ; confrontation aux valeurs du client Dofus |
| Recherche complète | HTTP → file → worker → Redis → WebSocket ; arrêt, reconnexion, fin et erreurs |
| Ergonomie | Parcours réels et contrôle visuel sur ordinateur et écran étroit, au clic et au clavier |
| Qualité de recherche | Comparaison exhaustive sur petits catalogues et mesure du gain selon la durée |
| Extension PvM | Plus de mécaniques, effets passifs, jets personnalisés et rotations multi-tours |
| PvP et marché | Scénarios dédiés et connexion à une source de prix si disponible |

Le test interne HTTP/Redis/WebSocket et la disponibilité depuis l'hôte ont été vérifiés pendant l'intégration. La réussite de ces contrôles ne remplace ni les tests visuels ni les références de dégâts en jeu.

Les décisions conservées sont : Dofus PC, PvM d'abord, priorités ordonnées sans poids visibles, égalités explicites, prix comme critère, exigences strictes distinctes, calcul immédiat au front et recherche longue au backend. L'[architecture](ARCHITECTURE.md) décrit leur mise en œuvre.
