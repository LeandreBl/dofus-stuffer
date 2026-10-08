import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../apps/web/src/lib/class-slug.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { classSlug } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

test('every class gets a unique, URL-safe page slug', () => {
  const { classes } = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
  const slugs = classes.map((gameClass) => classSlug(gameClass.name));
  assert.equal(classSlug('Crâ'), 'cra');
  assert.equal(classSlug('Xélor'), 'xelor');
  assert.ok(slugs.every((slug) => /^[a-z]+$/.test(slug)), slugs.join());
  assert.equal(new Set(slugs).size, slugs.length);
});
