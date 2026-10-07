# Icône Dofus Stuffer

Icône originale créée avec l'outil **imagegen intégré**, puis exportée en différentes résolutions sans modifier le dessin. L'œuf-bouclier évoque l'univers du jeu et l'équipement ; l'épée centrale évoque la progression. Les verts reprennent la palette de l'interface. Le fond transparent est conservé.

| Usage | Fichier |
| --- | --- |
| Source PNG | [dofus-stuffer-icon-source.png](dofus-stuffer-icon-source.png) |
| En-tête et raccourci 192 px | [dofus-stuffer-icon-192.png](../../apps/web/public/brand/dofus-stuffer-icon-192.png) |
| Icône 512 px | [dofus-stuffer-icon-512.png](../../apps/web/public/brand/dofus-stuffer-icon-512.png) |
| Favicon 16 px | [favicon-16.png](../../apps/web/public/favicon-16.png) |
| Favicon 32 px | [favicon-32.png](../../apps/web/public/favicon-32.png) |
| Favicon ICO 16 / 32 / 48 / 64 px | [favicon.ico](../../apps/web/public/favicon.ico) |
| Raccourci Apple 180 px | [apple-touch-icon.png](../../apps/web/public/apple-touch-icon.png) |

Les fichiers sont locaux et inclus dans l'image Docker web. Le document HTML déclare les favicons, l'icône Apple et le manifeste. L'en-tête React utilise la version 192 px. Le manifeste fournit aussi la version 512 px ; aucun appel au générateur n'est effectué par le site.

Pour réexporter les tailles, exécuter `scripts/export-site-icon.py` avec Python et Pillow. Le script vérifie le format carré et la transparence du fichier source avant l'export.

## Prompt final

```text
Use case: logo-brand. Create one finished original website/app icon for Dofus Stuffer, a dark green French fantasy RPG equipment optimizer. Subject: a bold lime-green dragon egg shaped shield, with a single upward-pointing sword silhouette integrated as a clean dark negative-space cutout through its center; the sword also suggests progression/optimization. Style: premium minimal fantasy game emblem, crisp vector-like edges, broad readable shapes, very restrained two-tone faceting, strong silhouette that remains recognizable at 16 and 32 pixels. Color palette: warm chartreuse #cde182 and muted olive #8ca957, dark forest #131817 outlines and cutout. Composition: square canvas, emblem centered, occupying about 88 percent of the canvas, balanced and compact, with a little breathing room on all sides. Background: genuinely transparent outside the emblem, no backdrop or presentation mockup. Constraints: exactly one standalone emblem, no words, no letters, no watermark, no tiny decorative ornaments, no crossed swords, no elaborate texture, no surrounding frame. Original design inspired by a fantasy equipment workshop, not a reproduction of Ankama's official logo. Deliver a clean polished icon asset suitable for the site header and browser favicon.
```
