# Références de calcul

Audit du 7 octobre 2026, client natif **3.7.4.4**. Les chiffres d'équipements et de sorts du catalogue viennent du client ; les formules ci-dessous indiquent séparément leurs preuves et les limites de validation. Une formule communautaire implémentée ne remplace pas un test de référence en combat.

## Caractéristiques du personnage

Les champs `statsPointsForStrength`, `statsPointsForIntelligence`, `statsPointsForChance`, `statsPointsForAgility` des **19 classes** du client donnent tous les paliers `[0,1], [100,2], [200,3], [300,4]`. Le coût d'achat du point suivant vaut donc 1 jusqu'à 100, 2 de 101 à 200, 3 de 201 à 300, puis 4. La vitalité coûte 1 et la sagesse 3. Ces paliers s'appliquent aux caractéristiques investies, indépendamment des parchemins et équipements.

Le [devblog officiel sur la séparation des points additionnels](https://www.dofus.com/fr/mmorpg/actualites/devblog/billets/426607-amelioration-systeme-caracteristiques) décrit le parchottage séparé, plafonné à 100. Les valeurs actuelles des paliers sont confirmées par les données natives. [DofusLab, StatEditor](https://github.com/dofuslab/dofuslab/blob/master/client/components/common/StatEditor.tsx) calcule le capital avec `5 × (niveau − 1)` et conserve les points additionnels séparément.

Au niveau 200, le moteur dispose donc de **995 points de capital** et choisit leur répartition en même temps que le stuff, en tenant compte des paliers, des prérequis et des priorités. Le parchottage déclaré reste séparé, de 0 à 100 par caractéristique. La répartition proposée fait partie du résultat du candidat ; elle ne demande pas à l'utilisateur de deviner à l'avance les points qui conviendront au stuff retenu.

Le [code DofusLab des statistiques et dégâts](https://github.com/dofuslab/dofuslab/blob/master/client/common/utils.tsx) fournit ces références d'implémentation :

| Valeur | Calcul |
|---|---|
| PV | 50 + 5 × niveau + vitalité |
| PA de base | 6 avant le niveau 100, 7 à partir de 100 |
| PM et invocations de base | 3 PM et 1 invocation |
| Initiative | Bonus directs + force + intelligence + chance + agilité |
| Prospection | 100 + bonus directs + partie entière de chance / 10 |
| Fuite et tacle | Bonus directs + partie entière d'agilité / 10 |
| Retraits et esquives PA/PM | Bonus directs + partie entière de sagesse / 10 |
| Pods | 1 000 + bonus directs + 5 × force |

La **Puissance s'exprime en points**. Pour les dégâts élémentaires, elle s'ajoute à la caractéristique pertinente dans le facteur `1 + (caractéristique + puissance) / 100`. Elle ne donne pas les bonus dérivés de force, chance, agilité ou sagesse : pas de pods, prospection, initiative, tacle, fuite ou esquives supplémentaires. Elle ne devient pas un bonus de soin. L'affichage distingue donc base, parchemins, équipement et puissance. Le [devblog officiel sur les caractéristiques](https://www.dofus.com/en/mmorpg/news/devblog/tickets/1768836-update-3-7-characteristics) explique cette formule existante ; ses propositions de refonte ne sont pas assimilées à des règles effectivement livrées en 3.7.

## Équipements et conditions

L’option **« Avec puissance »** est disponible sur les contraintes de Force, Intelligence, Chance et Agilité. La valeur évaluée pour cette seule contrainte est `base + parchotage + équipements et panoplies + puissance permanente`. Sans cette option, la puissance est exclue. Le seuil minimal, maximal ou la maximisation, le classement des équipements et le calcul des points de base utilisent cette même convention. Les statistiques réelles et les prérequis des objets ne changent pas ; les boosts temporaires de la prévisualisation ne sont pas ajoutés aux objectifs de recherche.

### Malus permanents et classement

Le score des préférences conserve les rangs choisis, puis soustrait une pénalité globale : `25 × somme(perte / référence)`. Chaque ligne négative des caractéristiques permanentes d'un objet est comptée, ainsi que le seul palier de bonus de panoplie effectivement actif. Les deux exemplaires légaux d'un anneau comptent chacun. Les bonus positifs, points de base et parchotage compensent les totaux réels mais ne masquent pas le coût de ces malus. La puissance est comptée une seule fois ; les statistiques dérivées (PV, initiative, tacle…) ne créent pas une deuxième pénalité.

Les références sont des choix de classement internes, pas des coefficients du jeu : 1 000 pour chaque élément et l'initiative, 3 500 pour la vitalité, 300 pour la sagesse, 200 pour la puissance, 12 PA, 6 PM/PO, 3 invocations et 50 % de critique. Les autres caractéristiques utilisent leur référence du catalogue (notamment 20 pour les résistances en pourcentage et 50 pour la fuite/tacle). Les champs techniques et quantités dont le signe n'exprime pas un bonus/malus de caractéristique sont exclus. La pénalité reste linéaire sans plafonnement, indépendante du nombre de critères ; le score peut devenir négatif. Les seuils obligatoires et règles d'équipement continuent d'exclure les candidats invalides. Le préclassement des objets et l'évaluation finale utilisent la même pénalité. Les passifs conditionnels de combat ne sont pas ajoutés au score des équipements par cette règle.

Le [changelog final 3.7](https://www.dofus.com/fr/mmorpg/actualites/maj/1772037-mise-jour-3-7/details) et les critères natifs concordent : `pk<2` signifie au plus **une panoplie active**. Une panoplie devient active à deux objets, quelle que soit la taille de son bonus. Deux panoplies distinctes de deux pièces violent cette condition ; une seule panoplie de trois ou davantage ne la viole pas. Le critère `Pk`, avec P majuscule, n'est pas réinterprété globalement.

Les validations de référence [DofusLab, getErrors](https://github.com/dofuslab/dofuslab/blob/master/client/common/utils.tsx) distinguent un anneau de panoplie en double, interdit, d'un anneau hors panoplie en double. Les Dofus et trophées identiques et plusieurs Prysmaradites ne sont pas autorisés.

Le [devblog Ankama de mars 2011, reproduit intégralement par JeuxOnLine](https://dofus.jeuxonline.info/actualite/30454/devblog-nouvelles-restrictions-pa-pm-po), précise que plusieurs objets avec le même exo restent équipables, mais que les bonus exotiques effectivement comptés sont limités séparément à **+1 PA, +1 PM et +1 PO**. C'est une limite de bonus appliqué, pas une interdiction d'équiper une seconde pièce exotique. L'application modélise les exos PA et PM comme deux bonus globaux facultatifs de +1, sans affectation à un emplacement ; les exos PO ne sont pas encore proposés.

Dans le client, `ItemData.m_flags & 64` représente la forgeabilité ; la comparaison avec le catalogue précédent retrouve, hors familiers, exactement les deux modifications annoncées : **Faux Maudite du Saigneur Guerrier (8992)** et **Épée Maudite du Saigneur Guerrier (8993)** deviennent forgeables. Les objets de classe, par exemple Casque Keutumedi (8619), restent non forgeables. Cette information est conservée dans le catalogue, mais les exos globaux de l'application ne constituent pas une validation de forgemagie sur une pièce. Le joueur choisit son support. Le coût modélisé est un supplément estimé par type d'exo, ajouté aux prix des objets normaux, et non le prix exact d'un objet exo ou d'une tentative de FM.

Ce même devblog fixe **12 PA et 6 PM** et précise que l'excédent des équipements est ignoré sans empêcher de porter les objets. La [mise à jour officielle 2.8, également reproduite par JeuxOnLine](https://dofus.jeuxonline.info/actualite/37112/modifications-apportees-version-28), réduit ensuite le plafond de bonus de portée à **6 PO**. Les bonus temporaires des sorts ne sont pas couverts par ces limites hors combat. La portée propre d'un sort reste distincte du bonus de portée.

Ces plafonds sont documentés par les textes publiés, pas par les 123 définitions de caractéristiques du snapshot qui ne possèdent pas de champ de plafond identifiable. L'ordre retenu par l'application conserve les totaux non plafonnés pour les prérequis, puis plafonne les statistiques affichées et optimisées ; cet ordre est corroboré par l'implémentation DofusLab, sans être explicitement détaillé dans ces deux textes Ankama.

La demande produit fixe également à **50 %** le plafond de chacune des cinq résistances élémentaires du personnage : Terre, Feu, Eau, Air et Neutre. `STAT_CAPS` est partagé par le moteur, l'éditeur et la validation API. Les résistances fixes, critiques, poussée et multiplicateurs de dégâts reçus ne sont pas concernés. La cible du simulateur conserve ses propres résistances, y compris au-delà de 50 % pour les monstres. Un surplus équipé reste visible dans le détail brut mais ne donne aucun avantage de score au-delà du plafond utilisable ; les malus de résistance ne sont pas ramenés à zéro.

## Dégâts, critique et délais

La fonction de dégâts de référence DofusLab additionne caractéristique et puissance, applique le facteur à la base, ajoute les dommages fixes et critiques, puis prend la partie entière. Elle applique ensuite les bonus finaux, sorts/armes et distance/mêlée, avec une seconde partie entière. Pièges et maîtrise d'arme sont des paramètres distincts. [SpellCardContent](https://github.com/dofuslab/dofuslab/blob/master/client/components/common/SpellCardContent.tsx) borne la probabilité critique entre 0 et 100 après ajout du bonus au taux propre au sort.

Un critère de sort `metric: criticalChance` utilise ce taux statique, indépendamment des critères de dégâts du même sort. Le rang est choisi selon le niveau du personnage ; un sort sans taux critique de base conserve 0 %, même avec des bonus d'équipement. Ce calcul fonctionne aussi pour un sort de soutien sans dégâts directs. Les dommages critiques, l'agilité et la puissance ne sont pas des bonus de probabilité. Les bonus temporaires et les modificateurs de sorts non simulés ne sont pas ajoutés. Les seuils obligatoires conservent les contrôles de disponibilité, classe, qualité des données et effets d'équipement non pris en charge.

Cette fonction ne reçoit pas les résistances de la cible. Elle ne confirme donc pas à elle seule les arrondis de réduction fixe, critique et proportionnelle. Un cas de référence en jeu reste nécessaire avant d'annoncer une exactitude au point près pour toute combinaison de résistances ; les limites sont conservées dans les avertissements du moteur.

**Flèche Punitive 32456** est confirmée inchangée dans le client 3.7.4.4 :

| Rang / niveau | Normal Terre | Critique Terre | Bonus différé T+1 | Bonus différé T+2 |
|---|---:|---:|---:|---:|
| 1 / 70 | 23–27 | 28–32 | +17 | +25 |
| 2 / 137 | 30–34 | 36–41 | +24 | +32 |

Les bonus sont des effets 293, de durée 1 tour, ciblant le lanceur et le même sort. Les effets techniques 3793 sont masqués dans le client. `punitive-fixture.json` conserve cet état natif. L'aperçu décrit un lancement initial puis un lancement ultérieur choisi ; une séquence de lancers intermédiaires, buffs ou changements de cible nécessite davantage d'état de combat.

## Calcul natif des sorts et situations de combat

Le catalogue conserve les **849 sorts jouables et leurs 1 762 rangs**, ainsi que **1 892 sorts internes**, **992 états** et **103 invocations** nécessaires à leur calcul. Les actions liées sont suivies au rang indiqué par l’effet natif. L’ordre des effets, les masques de cible, les déclenchements, la dégressivité de zone et la distinction entre les effets exécutés et ceux uniquement destinés à l’affichage sont conservés. Les actions 3792/3793 désignent des animations dans le bundle natif `SpellScriptData` ; elles ne rendent pas un calcul partiel.

La fiche du sort permet de choisir les états du lanceur et de la cible, le type de cible, les seuils de PV, les PA/PM dépensés, les cases de poussée bloquées, les dommages reçus pour un renvoi, les tirages aléatoires et les bonus de base accumulés. Sobre et Armé sont les états initiaux proposés respectivement au Pandawa et au Forgelance. Les branches sur les invocations, le bouclier ou la projection dans un portail sont distinctes : elles ne sont pas additionnées au même coup.

Les pièges et glyphes utilisent leurs sorts déclenchés ; les poisons et dégâts périodiques indiquent leur déclencheur et prennent le nombre d’occurrences choisi. Les dégâts proportionnels aux PV, érosion ou dommages subis et les dégâts fixes ne reçoivent pas artificiellement des caractéristiques et de la puissance. Les poisons par PA/PM utilisé appliquent leur coefficient natif par ressource dépensée. Une invocation propose ses attaques séparément et utilise ses caractéristiques natives avec ses pourcentages d’héritage. La source d’un sort peut être la Lance ou une créature alliée. Les déclenchements de runes utilisent les quatre sorts natifs de runes et les quantités choisies par élément.

La situation est sauvegardée dans chaque contrainte de dégâts et transmise à l’optimiseur. Deux critères du même sort peuvent ainsi être calculés avec des situations différentes. Un sort de soutien qui ne retire aucun PV donne zéro dégât, sans avertissement de calcul. Les anciens avertissements globaux fondés seulement sur les changements du patch sont conservés comme notes d’équilibrage ; ils ne masquent plus un calcul disponible. Une dépendance réellement absente ou une action inconnue conserve une erreur explicite.

Les tests exécutent tous les rangs jouables et vérifient des résultats chiffrés pour les sous-sorts, branches de cible, états, runes, héritage d’invocations, poisons, dégâts proportionnels et tirages Ecaflip. Il s’agit du calcul d’un lancer sur une cible dans la situation déclarée. Le placement sur une carte, les déplacements automatiques, l’IA des invocations et une rotation complète avec les événements de tout le combat ne sont pas simulés automatiquement. Les résultats ne constituent pas une validation en jeu au point près de toutes les combinaisons possibles.

### Passifs et boosts dans la prévisualisation

L’onglet « Mes dégâts » permet de déclarer des passifs **déjà déclenchés** sur les objets équipés et des sorts de boost **déjà lancés** sur le personnage. Les valeurs viennent des effets natifs 3.7.4.4. Pour les dommages finaux, les bonus d’une même caractéristique s’additionnent avant les multiplicateurs sorts/armes et mêlée/distance, conformément à la référence [DofusLab, getStatsFromAppliedBuffs et combineStatsWithBuffs](https://github.com/dofuslab/dofuslab/blob/master/client/common/utils.tsx). La puissance reste un ajout en points au facteur élémentaire ; Maîtrise d’Arme modifie uniquement la puissance d’arme.

Les Pourpre, Turquoise et Dofoozbz utilisent leurs cumuls, plafonnés à dix ; Vulbis et Argenté Scintillant leurs bonus conditionnels. Tacheté ajoute ses dommages fixes, Domakuro utilise le total déjà accumulé, Sylvestre le nombre de PM déjà utilisés. Le Cauchemar ne double pas ses 100 de Puissance lorsque ses deux effets sont sélectionnés. L’Ébène conserve des cumuls séparés en mêlée et à distance. Les tours de combat commandent le Nébuleux, le cycle Chance/Force/Agilité/Intelligence de Dofusteuse et les trois premiers tours de Prynyang. Des bonus d’équipements légendaires sont aussi disponibles, notamment Trompe-la-Mort et la Couronne de Brâm Barbe-Monde.

Les boosts déterministes sont extraits du rang disponible, en distinguant le lancer normal et critique, les cumuls et le temps écoulé. À 200, **Tirs Puissants** donne 250 Puissance et 15 % Critique en normal, 300 Puissance et 17 % Critique en critique, pendant un tour ; le bonus Poussée n’est pas transformé en dommages élémentaires. Les relances recalculent leurs dégâts et leur chance critique après expiration des bonus. Aucun redéclenchement ou relancement de boost n’est supposé.

La sélection des passifs et boosts est sauvegardée séparément du profil de recherche et concerne les aperçus de sorts et d’armes. Les situations propres à un sort, décrites ci-dessus, sont en revanche conservées dans ses objectifs. Un passif défensif n’augmente pas les dégâts sortants. Un passif dont les branches ne sont pas modélisées reste désactivé avec ses conditions lisibles.

### Limites du moteur hors combat

Le catalogue contient **72 objets** avec un critère inconnu et **179 objets** avec `unsupportedEffects`. Ce dernier groupe couvre les passifs légendaires 1175 et les modificateurs de sorts de classe 280 à 299, y compris portée, PA et relance. Les 25 avertissements d’objets restent distincts des 22 notes d’équilibrage de sorts de `simulation-limitations.json`.

Les dégâts directs et vols de vie d'armes sont calculés par coup avec leurs éléments naturels. Le bonus critique natif est ajouté à la base de chaque ligne avant les caractéristiques et les dommages fixes. Le calcul utilise le multiplicateur d'armes, pas celui des sorts, et respecte la situation mêlée/distance choisie pour la cible. La puissance d'arme s'ajoute aux caractéristiques de dégâts sans augmenter les caractéristiques réelles. Aucun buff de maîtrise externe n'est supposé.

Les soins d’armes, la récupération de PV d’un vol de vie, les conversions de forgemagie d’armes et les modificateurs d’objets de classe ne sont pas tous modélisés. Un effet d’arme non pris en charge conserve un aperçu partiel et ne certifie pas un seuil obligatoire. Les paramètres natifs sont nécessaires : leur absence ne produit pas une estimation inventée. Le champ `useInFight` des définitions natives distingue les retraits PA/PM sur la cible des malus permanents de l’équipement ; les lignes d’attaque ne sont pas ajoutées aux caractéristiques permanentes. Un objet de classe n’accorde pas des milliers de PV parce que l’identifiant d’un sort figure dans son effet.

Les définitions dans `effects-map.json` distinguent les dégâts fixes et proportionnels des dégâts élémentaires ordinaires. Les vols de caractéristiques (266, 268, 269, 271), bonus élémentaires/puissance (118, 119, 123, 126, 138), malus de résistance (215–219) et dommages critiques (418–419) sont appliqués selon leur ordre et leur cible.
