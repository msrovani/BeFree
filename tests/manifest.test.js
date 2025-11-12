const test = require('node:test');
const assert = require('node:assert/strict');

let loadManifest;
let tsRuntimeAvailable = true;

try {
  require('ts-node/register');
  loadManifest = require('../apps/frontend/app/manifest.ts').default;
} catch (error) {
  tsRuntimeAvailable = false;
}

if (!tsRuntimeAvailable) {
  test.skip('manifest exige runtime TypeScript para importação', () => {});
} else {
  test('manifest expõe metadados da PWA BEFREE', async () => {
    const manifest = await loadManifest();

    assert.equal(manifest.name, 'BEFREE — Rede Viva');
    assert.equal(manifest.short_name, 'BeFree');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.theme_color, '#38bdf8');

    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'espera ao menos dois ícones');
    const svgIcon = manifest.icons.find((icon) => icon.type === 'image/svg+xml');
    assert.ok(svgIcon, 'manifest deve incluir ícone SVG');
  });
}
