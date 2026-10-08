import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import type { Catalog, GameClass, Spell } from "@dofus/shared";
import { classSlug } from "./src/class-slug.ts";

// Static, crawlable text outside #root: React never replaces it, so it survives rendering.
const SITE = "https://dofus-stuffer.notdotio.com";
const HOME_TITLE = "Dofus Stuffer · L’atelier du stuff";
const HOME_DESCRIPTION = "Composez vos priorités, comparez vos équipements et simulez les dégâts de vos sorts Dofus.";

const escape = (text: string) => text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);
// Game descriptions embed links like {{spell,24510,1::<color=#ebc304>Téléfrag</color>}}.
const plainText = (text: string) => text.replace(/\{\{[^}]*::(.*?)\}\}/g, "$1").replace(/<[^>]+>/g, "");

let catalog: Pick<Catalog, "classes" | "spells"> | undefined;
const loadCatalog = (): Pick<Catalog, "classes" | "spells"> =>
  (catalog ??= JSON.parse(readFileSync(new URL("../../data/catalog.json", import.meta.url), "utf8")));

const classLinks = (classes: GameClass[]) =>
  `<ul class="seo-classes">${classes
    .map((gameClass) => `<li><a href="/classe/${classSlug(gameClass.name)}/">Stuff ${escape(gameClass.name)}</a></li>`)
    .join("")}</ul>`;

const homeSection = (classes: GameClass[]) => `<section class="seo-content">
  <h1>Dofus Stuffer : l’optimiseur de stuff Dofus</h1>
  <p>Dofus Stuffer cherche le meilleur équipement pour ton personnage Dofus selon tes priorités : PA, PM, caractéristiques, dégâts de sorts ou budget. Fixe tes objectifs, verrouille les objets que tu veux garder, et l’optimiseur parcourt tout le catalogue d’équipements, de panoplies et d’exos pour proposer les meilleures combinaisons.</p>
  <h2>Comparer les équipements et simuler les dégâts</h2>
  <p>Compare les objets emplacement par emplacement, vérifie les conditions d’équipement et les bonus de panoplie, puis simule les dégâts de tes sorts et de ton arme avec ton stuff, tes passifs et l’état de la cible. Le marché reprend les prix de ton serveur pour estimer le coût d’un stuff.</p>
  <h2>Optimiseur de stuff par classe</h2>
  ${classLinks(classes)}
</section>`;

const classSection = (gameClass: GameClass, spells: Spell[], classes: GameClass[]) => {
  const name = escape(gameClass.name);
  return `<section class="seo-content">
  <h1>Stuff ${name} Dofus : optimiseur d’équipement et simulateur de dégâts</h1>
  <p>Trouve le meilleur stuff ${name} pour ton niveau et ton mode de jeu. Dofus Stuffer optimise ton équipement ${name} selon tes objectifs de PA, PM et caractéristiques, puis calcule les dégâts de chacun des ${spells.length} sorts ${name} avec ton stuff.</p>
  <h2>Les sorts ${name}</h2>
  <dl class="seo-spells">${spells
    .map((spell) => `<dt>${escape(spell.name)}</dt><dd>${escape(plainText(spell.description))}</dd>`)
    .join("")}</dl>
  <h2>Les autres classes</h2>
  ${classLinks(classes.filter((other) => other.id !== gameClass.id))}
  <p><a href="/">Retour à l’optimiseur de stuff Dofus</a></p>
</section>`;
};

const replaceRequired = (html: string, from: string, to: string) => {
  if (!html.includes(from)) throw new Error(`seo-pages: "${from}" introuvable dans index.html`);
  return html.replaceAll(from, to);
};

export function seoPages(): Plugin {
  return {
    name: "dofus-seo-pages",
    enforce: "post",
    transformIndexHtml: (html) => replaceRequired(html, "<!--seo-->", homeSection(loadCatalog().classes)),
    generateBundle(_, bundle) {
      const index = bundle["index.html"];
      if (index?.type !== "asset") throw new Error("seo-pages: index.html absent du build");
      const { classes, spells } = loadCatalog();
      const home = String(index.source);
      const urls = [`${SITE}/`];
      for (const gameClass of classes) {
        const url = `${SITE}/classe/${classSlug(gameClass.name)}/`;
        const classSpells = spells.filter((spell) => spell.classIds.includes(gameClass.id));
        let html = replaceRequired(home, homeSection(classes), classSection(gameClass, classSpells, classes));
        html = replaceRequired(html, HOME_TITLE, `Stuff ${escape(gameClass.name)} Dofus · Optimiseur et dégâts | Dofus Stuffer`);
        html = replaceRequired(html, HOME_DESCRIPTION, `Optimise ton stuff ${escape(gameClass.name)} sur Dofus : objectifs PA, PM et caractéristiques, comparaison d’équipements et simulation des dégâts des ${classSpells.length} sorts ${escape(gameClass.name)}.`);
        html = replaceRequired(html, `"${SITE}/"`, `"${url}"`);
        this.emitFile({ type: "asset", fileName: `classe/${classSlug(gameClass.name)}/index.html`, source: html });
        urls.push(url);
      }
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}\n</urlset>\n`,
      });
    },
  };
}
