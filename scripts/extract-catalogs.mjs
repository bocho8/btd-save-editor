#!/usr/bin/env node
/** Build catalogs.json from local Assets/ (unpacked data.jet). */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, basename } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const ASSETS = join(ROOT, 'Assets', 'JSON');
const OUT = join(ROOT, 'catalogs.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listFiles(dir, pred) {
  return readdirSync(dir).filter(pred).sort();
}

function walkJsonFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkJsonFiles(path, out);
    else if (name.endsWith('.json') && name !== 'CacheList.json') out.push(path);
  }
  return out;
}

function humanize(id) {
  return String(id)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const PLACEABLE_TOWERS = new Set([
  'DartMonkey', 'TackTower', 'SniperMonkey', 'NinjaMonkey', 'BombTower',
  'CobraMonkey', 'BoomerangThrower', 'MonkeyApprentice', 'MonkeyBuccaneer',
  'SpikeFactory', 'GlueGunner', 'IceTower', 'MonkeyAce', 'MortarTower',
  'BananaFarm', 'SuperMonkey', 'MonkeyVillage', 'DartlingGun', 'HeliPilot',
  'MonkeyEngineer', 'Bloonchipper', 'MonkeySub',
]);

const EXTRA_PREMIUMS = [
  { id: 'RemoveAdverts', label: 'Remove Ads' },
  { id: 'BattlesMaster', label: 'Battles Master Pack' },
  { id: 'BattlesChampion', label: 'Battles Champion Pack' },
];

function loadTowerSkins() {
  const dir = join(ASSETS, 'TowerSkinDefinitions');
  return listFiles(dir, (f) => f.endsWith('.json') && f !== 'CacheList.json').map((f) => {
    const j = readJson(join(dir, f));
    return { id: j.ID, label: j.DisplayName || humanize(j.ID), tower: j.RequiresTower };
  });
}

function loadPremiums(skinIds) {
  const items = readJson(join(ASSETS, 'premium_items.json')).Items;
  const byId = new Map();

  for (const item of items) {
    const id = item.ProductID;
    if (!id || byId.has(id)) continue;
    const tags = item.Tags || [];
    if (tags.includes('ENERGY') || tags.includes('MEDALLIONS') || tags.includes('AD')) continue;
    if (tags.includes('INVENTORY')) continue;
    if (/Sale$/.test(id)) continue;
    if (/^(FullTower|PartTower|Restore|Merchandise|Free|Powers_Xp_|Vet_|DeckSlot|Decal|InventoryTower_)/.test(id)) continue;
    if (skinIds.has(id)) continue;
    if (id === 'BundleOfDecals') continue;
    byId.set(id, { id, label: item.Name || humanize(id) });
  }

  for (const extra of EXTRA_PREMIUMS) {
    if (!byId.has(extra.id)) byId.set(extra.id, extra);
  }

  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function flattenDecals(list, out = { decals: [], bundles: [] }) {
  for (const item of list) {
    if (item.IsBundle) {
      out.bundles.push({ id: item.Name, label: item.DisplayName || humanize(item.Name) });
      if (Array.isArray(item.Decals)) flattenDecals(item.Decals, out);
    } else {
      out.decals.push({ id: item.Name, label: item.DisplayName || humanize(item.Name) });
    }
  }
  return out;
}

function loadTowers() {
  const dir = join(ASSETS, 'TowerDefinitions');
  const items = [];
  for (const f of listFiles(dir, (f) => f.endsWith('.tower'))) {
    const j = readJson(join(dir, f));
    if (!PLACEABLE_TOWERS.has(j.TypeName)) continue;
    items.push({
      id: j.TypeName,
      label: humanize(j.TypeName),
      rank: j.RankToUnlock ?? 0,
    });
  }
  return items.sort((a, b) => a.label.localeCompare(b.label));
}

function loadTowerUpgrades() {
  const dir = join(ASSETS, 'UpgradeDefinitions');
  return listFiles(dir, (f) => f.endsWith('.upgrades'))
    .map((f) => f.replace(/\.upgrades$/, ''))
    .filter((id) => PLACEABLE_TOWERS.has(id) || id === 'CobraMonkey')
    .filter((id) => !/Sentry/.test(id))
    .map((id) => ({ id, label: humanize(id), maxTier: 4 }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function loadFarmers() {
  return ['MonkeyFarmer', 'RoboFarmer'].map((id) => {
    const path = join(ASSETS, 'TowerDefinitions', `${id}.tower`);
    let label = humanize(id);
    try {
      const j = readJson(path);
      if (j.Description) label = humanize(id);
    } catch { /* keep default */ }
    return { id, label };
  });
}

function loadProfileSkins() {
  const dir = join(ASSETS, 'ProfileSkinDefinitions');
  return listFiles(dir, (f) => f.endsWith('.json') && f !== 'CacheList.json').map((f) => {
    const j = readJson(join(dir, f));
    return { id: j.ID, label: j.DisplayName || humanize(j.ID) };
  });
}

function loadProjectileSkins() {
  const dir = join(ASSETS, 'ProjectileSkinDefinitions');
  return listFiles(dir, (f) => f.endsWith('.json') && f !== 'CacheList.json').map((f) => {
    const j = readJson(join(dir, f));
    return { id: j.ID, label: j.DisplayName || humanize(j.ID) };
  });
}

function loadCards() {
  const dir = join(ASSETS, 'BattleCardDefinitions');
  return listFiles(dir, (f) => f.endsWith('.json') && f !== 'CacheList.json').map((f) => {
    const j = readJson(join(dir, f));
    const tower = j.Tower?.Type;
    const bloon = j.Bloon?.Type;
    const bits = [tower, bloon].filter(Boolean).join(' / ');
    return {
      id: String(j.Name),
      label: bits ? `Card ${j.Name} (${bits})` : `Card ${j.Name}`,
    };
  }).sort((a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id));
}

function loadChatPacks() {
  const cache = readJson(join(ASSETS, 'ChatPacks', 'CacheList.json'));
  const files = cache.Files || [];
  return files.map((file, index) => {
    const name = basename(file, '.json');
    let label = name;
    try {
      const j = readJson(join(ASSETS, 'ChatPacks', file));
      if (j.PackName) label = j.PackName;
    } catch { /* keep */ }
    return { id: String(index), label: `${label} (index ${index})`, pack: name };
  });
}

function loadGuildSymbols() {
  return walkJsonFiles(join(ASSETS, 'GuildSymbolComponents')).map((path) => {
    const j = readJson(path);
    return {
      id: j.ID,
      label: j.DisplayName ? `${j.DisplayName} (${j.ID})` : humanize(j.ID),
      layer: j.Layer,
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

function main() {
  try {
    statSync(ASSETS);
  } catch {
    console.error('Missing Assets/JSON. Unpack data.jet into Assets/ first.');
    process.exit(1);
  }

  const towerSkins = loadTowerSkins();
  const skinIds = new Set(towerSkins.map((s) => s.id));
  const { decals, bundles } = flattenDecals(readJson(join(ASSETS, 'decals.json')).Decals || []);

  const catalogs = {
    generatedAt: new Date().toISOString(),
    source: 'Assets/JSON (unpacked data.jet)',
    categories: [
      {
        id: 'premiums',
        label: 'Premiums',
        path: 'Items.Premiums',
        kind: 'stringList',
        apply: true,
        items: loadPremiums(skinIds),
      },
      {
        id: 'towers',
        label: 'Towers',
        path: 'Unlocks.Towers',
        kind: 'stringList',
        apply: true,
        items: loadTowers(),
      },
      {
        id: 'towerUpgrades',
        label: 'Tower upgrades',
        path: 'Unlocks.TowerUpgrades',
        kind: 'towerUpgrades',
        apply: true,
        items: loadTowerUpgrades(),
      },
      {
        id: 'decals',
        label: 'Decals',
        path: 'Unlocks.Decals',
        kind: 'stringList',
        apply: true,
        items: decals,
      },
      {
        id: 'decalBundles',
        label: 'Decal bundles',
        path: 'Unlocks.DecalBundles',
        kind: 'stringList',
        apply: true,
        items: bundles,
      },
      {
        id: 'towerSkins',
        label: 'Tower skins',
        path: 'TowerSkinUnlocks',
        kind: 'stringList',
        apply: true,
        items: towerSkins,
      },
      {
        id: 'profileSkins',
        label: 'Profile skins',
        path: 'ProfileSkinUnlocks',
        kind: 'stringList',
        apply: true,
        items: loadProfileSkins(),
      },
      {
        id: 'projectileSkins',
        label: 'Projectile skins',
        path: 'ProjectileSkinUnlocks',
        kind: 'stringList',
        apply: true,
        items: loadProjectileSkins(),
      },
      {
        id: 'cards',
        label: 'Battle cards',
        path: 'UnlockedCards',
        kind: 'stringList',
        apply: true,
        items: loadCards(),
      },
      {
        id: 'chatPacks',
        label: 'Chat packs',
        path: 'ChatPacks',
        kind: 'indexList',
        apply: true,
        items: loadChatPacks(),
      },
      {
        id: 'guildSymbols',
        label: 'Guild symbols',
        path: 'UnlockedGuildSymbolComponents',
        kind: 'stringList',
        apply: true,
        items: loadGuildSymbols(),
      },
      {
        id: 'farmers',
        label: 'Farmers',
        path: 'Items.TowerInventory',
        kind: 'towerInventory',
        apply: true,
        items: loadFarmers(),
      },
    ],
  };

  writeFileSync(OUT, JSON.stringify(catalogs, null, 2) + '\n');
  const counts = catalogs.categories.map((c) => `${c.id}:${c.items.length}`).join(' ');
  console.log(`Wrote ${OUT}`);
  console.log(counts);
}

main();
