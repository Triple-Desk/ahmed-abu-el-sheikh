// Unit tests for the costing engine (pure functions). Run: node test/engine-tests.js
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const ctx = { module: { exports: {} }, console, JSON, Math, Number, String, Array, Object, isFinite, Error };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Engine.gs'), 'utf8'), ctx);
const E = ctx.module.exports;

let passed = 0, failed = 0;
function t(name, fn) { try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + (e && e.stack || e)); } }
const near = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(Number(a) - Number(b)) < eps, (msg || '') + ` expected ${b} got ${a}`);

// sample materials (prices from the project brief, used only to check math)
const PLY = { id: 'PLY', name: 'كونتر أرو 18 مم', mtype: 'sheet', category: 'ألواح', sheet_len: 244, sheet_wid: 122, avg_cost: 1560 / (244 * 122) };
const HDF = { id: 'HDF', name: 'HDF 3 مم', mtype: 'sheet', category: 'ألواح', sheet_len: 244, sheet_wid: 122, avg_cost: 300 / (244 * 122), waste_pct: 5 };
const MUS = { id: 'MUS', name: 'موسكي', mtype: 'solid', category: 'خشب', avg_cost: 19000 / 1e6 };
const EDGE = { id: 'EDGE', name: 'شريط حرف', mtype: 'linear', category: 'إكسسوار', avg_cost: 2.5 / 100 };
const HINGE = { id: 'HNG', name: 'مفصلة', mtype: 'count', category: 'حدايد', avg_cost: 15, pack_qty: 10 };
const VARN = { id: 'VRN', name: 'ورنيش', mtype: 'liquid', base_unit: 'ml', category: 'دهانات', avg_cost: 600 / 4000, pack_qty: 4000 };
const GLUE = { id: 'GLU', name: 'غراء', mtype: 'liquid', base_unit: 'g', category: 'دهانات', avg_cost: 80 / 1000 };
const M = { PLY, HDF, MUS, EDGE, HNG: HINGE, VRN: VARN, GLU: GLUE };
const SET = { waste_sheet: 10, waste_solid: 20, waste_linear: 5, waste_count: 0, waste_liquid: 5 };

console.log('\nUnits & conversion');
t('sheet unit = sheet area of THAT material', () => {
  near(E.unitFactor_('sheet', PLY), 29768);
  near(E.unitFactor_('sheet', { mtype: 'sheet', sheet_len: 280, sheet_wid: 207 }), 57960);
  near(E.unitFactor_('m2', PLY), 10000);
  near(E.toBase_(0.5, 'sheet', PLY), 14884, 'half sheet allowed');
});
t('solid m³ / linear m / count dozen & box / liquid l & can / weight kg', () => {
  near(E.toBase_(0.12, 'm3', MUS), 120000);
  near(E.toBase_(12, 'm', EDGE), 1200);
  near(E.toBase_(2, 'dozen', HINGE), 24);
  near(E.toBase_(3, 'pack', HINGE), 30, 'box of 10');
  near(E.toBase_(1.5, 'l', VARN), 1500);
  near(E.toBase_(1, 'pack', VARN), 4000, 'can of 4 L');
  near(E.toBase_(2, 'kg', GLUE), 2000);
});
t('wrong unit for a material is refused', () => {
  assert.throws(() => E.unitFactor_('m3', PLY));
  assert.throws(() => E.unitFactor_('sheet', MUS));
  assert.throws(() => E.unitFactor_('l', GLUE));
  assert.throws(() => E.unitFactor_('pack', EDGE), 'no roll size set → pack not allowed');
  assert.throws(() => E.unitFactor_('xx', PLY));
});
t('price per base unit (sheet / m³ / meter / box / can)', () => {
  near(E.pricePerBase_(1560, 1, 'sheet', PLY), 1560 / 29768);
  near(E.pricePerBase_(19000, 1, 'm3', MUS), 0.019);
  near(E.pricePerBase_(25, 10, 'm', EDGE), 0.025);
  near(E.pricePerBase_(150, 1, 'pack', HINGE), 15);
  near(E.pricePerBase_(600, 1, 'pack', VARN), 0.15);
  assert.throws(() => E.pricePerBase_(10, 0, 'sheet', PLY));
  assert.throws(() => E.pricePerBase_(-1, 1, 'sheet', PLY));
});
t('board volume by dimensions: 3 × 400 × 20 × 5 cm = 0.12 m³', () => { near(E.boardVolume_(3, 400, 20, 5), 120000); });
t('display quantities and prices', () => {
  const d = E.displayQty_(14884, PLY); near(d.v, 0.5); assert.strictEqual(d.u, 'لوح');
  near(E.displayPrice_(PLY.avg_cost, PLY).v, 1560);
  near(E.displayPrice_(MUS.avg_cost, MUS).v, 19000);
  near(E.displayQty_(120000, MUS).v, 0.12);
  near(E.displayPrice_(GLUE.avg_cost, GLUE).v, 80);
});

console.log('\nPieces → material quantities');
t('sheet piece: area = count × L × W (thickness from the material)', () => {
  near(E.lineNet_({ ltype: 'piece', count: 2, length: 220, width: 60, thickness: 99 }, PLY).net, 26400);
});
t('solid piece: volume = count × L × W × T', () => {
  near(E.lineNet_({ ltype: 'piece', count: 4, length: 75, width: 5, thickness: 5 }, MUS).net, 7500);
});
t('linear piece: count × L; count piece: count', () => {
  near(E.lineNet_({ ltype: 'piece', count: 4, length: 210 }, EDGE).net, 840);
  near(E.lineNet_({ ltype: 'piece', count: 3 }, HINGE).net, 3);
});
t('accessory line: qty × unit', () => {
  near(E.lineNet_({ ltype: 'item', qty: 1.5, unit: 'l' }, VARN).net, 1500);
  near(E.lineNet_({ ltype: 'item', qty: 2, unit: 'pack' }, HINGE).net, 20);
});
t('missing dimensions / material are reported, not silently zero', () => {
  assert.ok(E.lineNet_({ ltype: 'piece', count: 2, length: 220 }, PLY).error);
  assert.ok(E.lineNet_({ ltype: 'piece', count: 2, length: 220, width: 60 }, MUS).error, 'solid needs thickness');
  assert.ok(E.lineNet_({ ltype: 'piece', count: 0, length: 220, width: 60 }, PLY).error);
  assert.ok(E.lineNet_({ ltype: 'piece', count: 1, length: 1, width: 1 }, null).error);
  assert.ok(E.lineNet_({ ltype: 'item', qty: 1, unit: 'm3' }, PLY).error);
  assert.ok(E.lineNet_({ ltype: 'piece', count: 1, length: 1, width: 1 }, VARN).error, 'liquid cannot be a piece');
});

console.log('\nWaste, sheets and cost');
t('wardrobe side: 2 × 220 × 60 كونتر 18 + 10% هالك', () => {
  const c = E.costGroups_([{ key: 'a', qty: 1, lines: [{ ltype: 'piece', material_id: 'PLY', count: 2, length: 220, width: 60 }] }], { materials: M, settings: SET });
  const r = c.materials[0];
  near(r.net, 26400); near(r.gross, 29040); near(r.waste_pct, 10);
  near(r.cost, 1521.85, 'cost', 0.006);                      // 29040 / 29768 × 1560
  assert.strictEqual(r.sheets, 1);
  near(c.material_cost, 1521.85, '', 0.006);
});
t('"احسب ألواح كاملة" costs whole sheets', () => {
  const lines = [{ ltype: 'piece', material_id: 'PLY', count: 2, length: 220, width: 60 }, { ltype: 'piece', material_id: 'PLY', count: 3, length: 97, width: 58 }];
  const a = E.costGroups_([{ key: 'a', qty: 1, lines }], { materials: M, settings: SET });
  const f = E.costGroups_([{ key: 'a', qty: 1, lines }], { materials: M, settings: SET, fullSheets: true });
  // net = 26400 + 16878 = 43278 ; gross = 47605.8 ; sheets = 2
  near(a.materials[0].net, 43278); near(a.materials[0].gross, 47605.8); assert.strictEqual(a.materials[0].sheets, 2);
  near(a.material_cost, 47605.8 / 29768 * 1560, '', 0.006);
  near(f.material_cost, 3120);
  near(f.groups.a.material_cost, 3120, 'item gets the full-sheet cost');
});
t('exactly one sheet of area needs 1 sheet (no float overshoot)', () => {
  const c = E.costGroups_([{ key: 'a', qty: 1, lines: [{ ltype: 'piece', material_id: 'PLY', count: 1, length: 244, width: 122 }] }], { materials: M, settings: SET, waste: { PLY: 0 } });
  assert.strictEqual(c.materials[0].sheets, 1);
  near(c.material_cost, 1560);
});
t('waste: material value beats type default; order override beats both', () => {
  const g = [{ key: 'a', qty: 1, lines: [{ ltype: 'piece', material_id: 'HDF', count: 1, length: 100, width: 100 }] }];
  near(E.costGroups_(g, { materials: M, settings: SET }).materials[0].gross, 10500, 'HDF own 5%');
  near(E.costGroups_(g, { materials: M, settings: SET, waste: { HDF: 0 } }).materials[0].gross, 10000, 'override 0%');
  near(E.costGroups_([{ key: 'a', qty: 1, lines: [{ ltype: 'piece', material_id: 'MUS', count: 1, length: 100, width: 10, thickness: 10 }] }],
    { materials: M, settings: { waste_solid: 25 } }).materials[0].gross, 12500, 'settings default 25% for solid');
});
t('solid wood legs: 4 × 75×5×5 موسكي +20% = 9000 cm³ = 171 EGP', () => {
  const c = E.costGroups_([{ key: 'a', qty: 1, lines: [{ ltype: 'piece', material_id: 'MUS', count: 4, length: 75, width: 5, thickness: 5 }] }], { materials: M, settings: SET });
  near(c.materials[0].gross, 9000); near(c.material_cost, 171);
});
t('missing price → warning and zero cost (never a hidden guess)', () => {
  const X = Object.assign({}, PLY, { id: 'X', avg_cost: 0 });
  const c = E.costGroups_([{ key: 'a', qty: 1, lines: [{ ltype: 'piece', material_id: 'X', count: 1, length: 10, width: 10 }] }], { materials: { X }, settings: SET });
  assert.ok(c.warnings.some(w => w.includes('سعر'))); near(c.material_cost, 0);
});

console.log('\nProducts (catalog)');
const WARDROBE = [
  { ltype: 'piece', name: 'جنب', material_id: 'PLY', count: 2, length: 220, width: 60 },
  { ltype: 'piece', name: 'سقف وأرضية', material_id: 'PLY', count: 2, length: 100, width: 60 },
  { ltype: 'piece', name: 'ظهر', material_id: 'HDF', count: 1, length: 220, width: 100 },
  { ltype: 'item', name: 'مفصلات', material_id: 'HNG', qty: 8, unit: 'pcs' },
  { ltype: 'item', name: 'ورنيش', material_id: 'VRN', qty: 1, unit: 'l' },
  { ltype: 'item', name: 'شريط حرف', material_id: 'EDGE', qty: 12, unit: 'm' }
];
t('wardrobe template: materials + accessories + labor; profit & margin', () => {
  const c = E.productCost_({ selling_price: 9000, labor: [{ kind: 'مصنعية', amount: 1500 }, { kind: 'دهان', amount: 800 }] }, WARDROBE, M, SET);
  const ply = (26400 + 12000) * 1.1 / 29768 * 1560;   // 2213.0…
  const hdf = 22000 * 1.05 / 29768 * 300;             // 232.80…
  const exp = Math.round(ply * 100) / 100 + Math.round(hdf * 100) / 100 + 120 + 157.5 + 31.5;
  near(c.material_cost, Math.round(exp * 100) / 100, 'material', 0.011);
  near(c.labor_cost, 2300);
  near(c.total, c.material_cost + 2300, '', 0.011);
  near(c.profit, 9000 - c.total, '', 0.011);
  near(c.margin, (9000 - c.total) / 9000, '', 1e-4);
  assert.ok(c.by_cat['ألواح'] > 0 && c.by_cat['حدايد'] === 120 && c.by_cat['دهانات'] === 157.5);
});
t('suggested price for target margin', () => {
  near(E.suggestedPrice_(7000, 30), 10000);
  near(E.suggestedPrice_(1000, 0), 1000);
  near(E.suggestedPrice_(1000, 100), 0);
});
t('product with no lines warns', () => { assert.ok(E.productCost_({ selling_price: 1 }, [], M, SET).warnings.length); });

console.log('\nOrders');
t('mixed order: 2 wardrobes + 1 custom door; totals, discount, extras, allocation', () => {
  const items = [
    { id: 'i1', name: 'دولاب', qty: 2, unit_price: 9000, labor: [{ amount: 1500 }] },
    { id: 'i2', name: 'باب', qty: 1, unit_price: 4000, labor: [{ amount: 600 }] }
  ];
  const lines = {
    i1: WARDROBE.slice(0, 2),
    i2: [{ ltype: 'piece', material_id: 'MUS', count: 2, length: 210, width: 10, thickness: 4 }, { ltype: 'piece', material_id: 'PLY', count: 1, length: 200, width: 80 }]
  };
  const e = E.orderEstimate_({ discount: 500, extras: [{ label: 'نقل', amount: 300 }] }, items, lines, M, SET);
  near(e.items_total, 22000); near(e.total, 21500); near(e.extra_cost, 300); near(e.labor_cost, 3600);
  const ply = e.materials.find(x => x.material_id === 'PLY');
  near(ply.net, (26400 + 12000) * 2 + 16000);   // edited door uses the same sheet → pooled
  near(e.items.i1.material_cost + e.items.i2.material_cost, e.material_cost, 'allocation adds up', 0.02);
  near(e.total_cost, e.material_cost + 3600 + 300, '', 0.011);
  near(e.profit, 21500 - e.total_cost, '', 0.011);
  near(e.qty, 3);
});
t('frozen prices: later price change does not change a confirmed estimate', () => {
  const items = [{ id: 'i1', qty: 1, unit_price: 5000, labor: [] }], lines = { i1: WARDROBE.slice(0, 1) };
  const frozen = { PLY: PLY.avg_cost };
  const before = E.orderEstimate_({}, items, lines, M, SET, frozen);
  const M2 = Object.assign({}, M, { PLY: Object.assign({}, PLY, { avg_cost: 2000 / 29768 }) });
  const live = E.orderEstimate_({}, items, lines, M2, SET);
  const after = E.orderEstimate_({}, items, lines, M2, SET, frozen);
  near(after.total_cost, before.total_cost); assert.ok(live.total_cost > before.total_cost + 1);
});
t('zero selling price → margin null; empty order safe', () => {
  const e = E.orderEstimate_({}, [{ id: 'a', qty: 1, unit_price: 0 }], { a: WARDROBE.slice(0, 1) }, M, SET);
  assert.strictEqual(e.margin, null); assert.ok(e.profit < 0);
  const z = E.orderEstimate_({}, [], {}, M, SET); near(z.total, 0); assert.strictEqual(z.margin, null);
});
t('materials to issue for k units include waste', () => {
  const r = E.materialsForUnits_(WARDROBE.slice(0, 1), 3, M, SET);
  near(r[0].qty, 26400 * 3 * 1.1);
});

console.log('\nWeighted average & WhatsApp');
t('weighted average: 2 sheets @1500 + 3 sheets for 4800 → 1560 per sheet', () => {
  const A = 29768;
  const avg = E.weightedAvg_(2 * A, 1500 / A, 3 * A, 4800);
  near(avg * A, 1560);
  near(E.weightedAvg_(0, 5, 10, 200), 20, 'empty stock → new price');
  near(E.weightedAvg_(-3, 5, 10, 200), 20, 'negative stock → new price');
  near(E.weightedAvg_(10, 5, 0, 0), 5, 'nothing added → unchanged');
});
t('WhatsApp numbers', () => {
  assert.strictEqual(E.waNumber_('01004649365'), '201004649365');
  assert.strictEqual(E.waNumber_('+20 100 464 9365'), '201004649365');
  assert.strictEqual(E.waNumber_('٠١٠٠٤٦٤٩٣٦٥'), '201004649365');
  assert.strictEqual(E.waNumber_('00201004649365'), '201004649365');
});

t('browser copy js/engine.js is identical to apps-script/Engine.gs', () => {
  assert.strictEqual(fs.readFileSync(path.join(__dirname, '..', 'js', 'engine.js'), 'utf8'), fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Engine.gs'), 'utf8'));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
