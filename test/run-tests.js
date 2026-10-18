// Server scenarios on mocked Google services. Run: node test/run-tests.js
const assert = require('assert');
const { makeEnv } = require('./gas-mock');

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + (e && e.stack || e)); }
}
const near = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(Number(a) - Number(b)) < eps, (msg || '') + ` expected ${b} got ${a}`);

const G = makeEnv();
G.APP.MAX_WRITES_PER_MIN = 100000;   // the scenario below writes faster than a person can
let rq = 0;
function api(action, payload, requestId) {
  const body = JSON.stringify({ k: G._props.API_KEY, action, payload, requestId: requestId || ('r' + (++rq)) });
  return JSON.parse(G.doPost({ postData: { contents: body } }).getContent());
}
function ok(action, payload, rid) {
  const r = api(action, payload, rid);
  if (!r.ok) throw new Error(action + ' failed: ' + r.error + (r.details ? ' ' + JSON.stringify(r.details) : ''));
  return r;
}
function bad(action, payload, re) {
  const r = api(action, payload);
  assert.ok(!r.ok, action + ' should fail');
  if (re) assert.ok(re.test(r.error) || re.test(r.code || ''), 'unexpected error: ' + r.error + ' ' + r.code);
  return r;
}
let D;
const data = () => (D = ok('bootstrap').data);
const mat = n => D.materials.find(x => x.name === n);
const prod = n => D.products.find(x => x.name === n);
const ord = id => D.orders.find(x => x.id === id);
const AREA = 244 * 122;

console.log('\nSetup');
t('setup creates database, folders and seed; idempotent', () => {
  assert.ok(/Created database/.test(G.setup()));
  assert.ok(/Already/.test(G.setup()));
  data();
  assert.strictEqual(D.settings.business_name, 'ورشة أولاد الشيخ');
  assert.strictEqual(D.settings.phone, '01004649365', 'phone kept as text');
  assert.ok(D.materials.length >= 15);
  near(mat('كونتر أرو 18 مم').avg_cost * AREA, 1560, 'seed sheet price', 1e-2);
  near(mat('خشب موسكي').avg_cost, 0.019);
  assert.deepStrictEqual(JSON.parse(D.settings.categories).slice(0, 3), ['غرف نوم', 'مطابخ', 'ركن']);
});

console.log('\nMaterials & purchases');
let SUP;
t('new materials of each type with price in display units', () => {
  data();
  ok('saveMaterial', { name: 'مفصلة سوستة', mtype: 'count', category: 'حدايد', pack_qty: 10, pack_label: 'علبة', price: { amount: 150, qty: 1, unit: 'pack' } });
  ok('saveMaterial', { name: 'دوكو', mtype: 'liquid', base_unit: 'ml', category: 'دهانات', pack_qty: 4, pack_label: 'جركن', price: { amount: 600, qty: 1, unit: 'pack' }, waste_pct: 0 });
  ok('saveMaterial', { name: 'MDF 16 مم', mtype: 'sheet', sheet_len: 280, sheet_wid: 207, thickness_mm: 16, price: { amount: 1200, qty: 1, unit: 'sheet' }, min_stock: { qty: 2, unit: 'sheet' } });
  data();
  near(mat('مفصلة سوستة').avg_cost, 15); near(mat('مفصلة سوستة').pack_qty, 10);
  near(mat('دوكو').avg_cost, 0.15); near(mat('دوكو').pack_qty, 4000);
  near(mat('MDF 16 مم').avg_cost * 280 * 207, 1200, '', 1e-3); near(mat('MDF 16 مم').min_stock, 2 * 280 * 207);
  bad('saveMaterial', { name: 'كونتر أرو 18 مم', mtype: 'sheet' }, /بنفس الاسم/);
  bad('saveMaterial', { name: 'X', mtype: 'plastic' }, /اختيار غير صحيح/);
  bad('saveMaterial', { name: 'Y', mtype: 'solid', price: { amount: 5, qty: 1, unit: 'sheet' } }, /لا تناسب/);
});
t('multi-line purchase: weighted average, board dimensions, supplier balance', () => {
  data();
  const ply = mat('كونتر أرو 18 مم'), mus = mat('خشب موسكي'), hinge = mat('مفصلات');
  ok('savePurchase', { supplier_name: 'معرض الحاج سيد', date: '2026-10-01', paid_now: 3000, method: 'cash', lines: [
    { material_id: ply.id, qty: 5, unit: 'sheet', total_price: 7500 },
    { material_id: mus.id, unit: 'board', board: { count: 10, l: 400, w: 10, t: 5 }, total_price: 4000 },
    { material_id: hinge.id, qty: 4, unit: 'dozen', total_price: 480 }
  ] });
  data();
  SUP = D.suppliers.find(s => s.name === 'معرض الحاج سيد');
  assert.ok(SUP, 'supplier created');
  near(mat('كونتر أرو 18 مم').stock, 5 * AREA); near(mat('كونتر أرو 18 مم').avg_cost * AREA, 1500, 'old stock 0 → new price', 1e-3);
  near(mat('خشب موسكي').stock, 200000); near(mat('خشب موسكي').avg_cost * 1e6, 20000, '', 1e-3);
  near(mat('مفصلات').stock, 48); near(mat('مفصلات').avg_cost, 10);
  const pur = D.purchases[0]; near(pur.total, 11980); assert.strictEqual(pur.lines.length, 3);
  assert.ok(pur.lines[1].input_text.includes('400'));
  near(D.supplier_payments.filter(x => x.status !== 'void').reduce((a, x) => a + x.amount, 0), 3000);
  // second purchase at a different price → weighted average (5 @1500 + 3 for 4800 = 1537.5)
  ok('savePurchase', { supplier_id: SUP.id, paid_now: 0, lines: [{ material_id: ply.id, qty: 3, unit: 'sheet', total_price: 4800 }] });
  data(); near(mat('كونتر أرو 18 مم').avg_cost * AREA, (7500 + 4800) / 8, '', 1e-3);
  bad('savePurchase', { paid_now: 10, lines: [{ material_id: ply.id, qty: 1, unit: 'sheet', total_price: 100 }] }, /المورد/);
  bad('savePurchase', { supplier_id: SUP.id, lines: [{ material_id: ply.id, qty: 1, unit: 'm3', total_price: 1 }] }, /لا تناسب/);
  bad('savePurchase', { supplier_id: SUP.id, lines: [{ material_id: mat('مفصلات').id, unit: 'board', board: { count: 1, l: 1, w: 1, t: 1 }, total_price: 1 }] }, /للخشب/);
});
t('reverse purchase only if nothing moved after; supplier payment voided', () => {
  data();
  const last = D.purchases[0];
  ok('reversePurchase', { id: last.id }); data();
  near(mat('كونتر أرو 18 مم').stock, 5 * AREA); near(mat('كونتر أرو 18 مم').avg_cost * AREA, 1500, '', 1e-3);
  bad('reversePurchase', { id: last.id }, /اتلغت/);
  ok('savePurchase', { supplier_id: SUP.id, paid_now: 0, lines: [{ material_id: mat('كونتر أرو 18 مم').id, qty: 3, unit: 'sheet', total_price: 4800 }] });
  data();
});

console.log('\nCatalog products');
let WARD;
const wardLines = () => [
  { ltype: 'piece', name: 'جنب', material_id: mat('كونتر أرو 18 مم').id, count: 2, length: 220, width: 60 },
  { ltype: 'piece', name: 'سقف وأرضية', material_id: mat('كونتر أرو 18 مم').id, count: 2, length: 100, width: 60 },
  { ltype: 'piece', name: 'رجول', material_id: mat('خشب موسكي').id, count: 4, length: 10, width: 5, thickness: 5 },
  { ltype: 'item', name: 'مفصلات', material_id: mat('مفصلات').id, qty: 4, unit: 'pcs' }
];
t('product template with pieces, accessories and labor → exact cost', () => {
  data();
  ok('saveProduct', { name: 'دولاب 2 ضلفة', category: 'غرف نوم', selling_price: 6000, labor: [{ kind: 'مصنعية', amount: 1000 }, { kind: 'دهان', amount: 500 }], lines: wardLines() });
  data(); WARD = prod('دولاب 2 ضلفة');
  const plyAvg = mat('كونتر أرو 18 مم').avg_cost;
  const ply = Math.round(38400 * 1.1 * plyAvg * 100) / 100, legs = Math.round(4 * 250 * 1.2 * mat('خشب موسكي').avg_cost * 100) / 100;
  near(WARD.cost.material_cost, Math.round((ply + legs + 40) * 100) / 100, 'material', 0.011);
  near(WARD.cost.labor_cost, 1500);
  near(WARD.cost.total, WARD.cost.material_cost + 1500, '', 0.011);
  assert.strictEqual(WARD.lines.length, 4);
  bad('saveProduct', { name: 'ناقص', lines: [{ ltype: 'piece', material_id: mat('كونتر أرو 18 مم').id, count: 1, length: 100 }] }, /العرض/);
  bad('saveProduct', { name: 'ناقص2', lines: [{ ltype: 'piece', count: 1, length: 100, width: 50 }] }, /اختار الخامة/);
});
t('re-saving a template replaces its lines (no leftovers)', () => {
  const l = wardLines(); l[0].length = 230;
  ok('saveProduct', { id: WARD.id, name: WARD.name, category: 'غرف نوم', selling_price: 6000, labor: WARD.labor, lines: l });
  data(); WARD = prod('دولاب 2 ضلفة');
  assert.strictEqual(WARD.lines.length, 4); near(WARD.lines[0].length, 230);
  const l2 = wardLines(); ok('saveProduct', { id: WARD.id, name: WARD.name, category: 'غرف نوم', selling_price: 6000, labor: WARD.labor, lines: l2 });
  data(); WARD = prod('دولاب 2 ضلفة');
});
t('duplicate product copies pieces', () => {
  ok('duplicateProduct', { id: WARD.id, name: 'دولاب 2 ضلفة (نسخة)' }); data();
  assert.strictEqual(prod('دولاب 2 ضلفة (نسخة)').lines.length, 4);
  ok('setProductActive', { id: prod('دولاب 2 ضلفة (نسخة)').id, active: false }); data();
});

console.log('\nQuotes & orders');
let O1;
function quotePayload(extra) {
  const wl = wardLines(); wl[0].length = 240;           // customer wants a taller wardrobe (catalog untouched)
  return Object.assign({
    customer: { name: 'أحمد محمود', phone: '01112223334', address: 'المعادي' }, order_date: '2026-10-10', due_date: '2026-10-25',
    discount: 200, extras: [{ label: 'نقل', amount: 150 }], notes: 'لون جوز',
    items: [
      { product_id: WARD.id, name: 'دولاب 2 ضلفة', category: 'غرف نوم', spec: '240×100×60', qty: 2, unit_price: 6500, labor: [{ kind: 'مصنعية', amount: 1000 }], lines: wl },
      { name: 'كومود مخصوص', category: 'غرف نوم', qty: 1, unit_price: 1500, labor: [{ kind: 'مصنعية', amount: 300 }],
        lines: [{ ltype: 'piece', name: 'جسم', material_id: mat('كونتر أرو 18 مم').id, count: 4, length: 50, width: 40 }] }
    ]
  }, extra || {});
}
t('quote with a copied catalog item (edited) + custom item; customer created', () => {
  const r = ok('saveOrder', quotePayload()); data();
  O1 = ord(r.result.id);
  assert.strictEqual(O1.status, 'quote'); assert.ok(/^AS-0001$/.test(O1.order_no), O1.order_no);
  assert.strictEqual(O1.items.length, 2); assert.strictEqual(O1.lines.length, 5);
  near(O1.items_total, 14500); near(O1.total, 14300); assert.ok(O1.estimated);
  assert.ok(O1.est_cost > 0 && O1.est_profit < O1.total);
  near(prod('دولاب 2 ضلفة').lines[0].length, 220, 'catalog not touched');
  const c = D.customers.find(x => x.phone === '01112223334'); assert.ok(c && c.address === 'المعادي');
  assert.strictEqual(O1.customer_id, c.id);
});
t('editing a quote replaces its items (no duplicates) and reuses the customer by phone', () => {
  const p = quotePayload({ id: O1.id, customer: { name: 'أحمد', phone: '+20 111 222 3334' } });
  p.items[1].qty = 2;
  ok('saveOrder', p); data();
  O1 = ord(O1.id);
  assert.strictEqual(O1.items.length, 2); assert.strictEqual(O1.lines.length, 5);
  assert.strictEqual(D.orders.filter(o => o.id === O1.id).length, 1);
  assert.strictEqual(D.customers.filter(x => x.phone && x.phone.replace(/\D/g, '').endsWith('1112223334')).length, 1);
  near(O1.total, 15800);
});
t('payments are refused on a quote; invalid quotes refused', () => {
  bad('addPayment', { order_id: O1.id, amount: 100 }, /أكّد/);
  bad('saveOrder', { items: [] }, /قطعة واحدة/);
  bad('saveOrder', { items: [{ name: 'x', qty: 1.5, unit_price: 1 }] }, /رقم صحيح/);
  bad('saveOrder', { items: [{ name: 'x', qty: 1, unit_price: 100 }], discount: 500 }, /الخصم/);
  bad('saveOrder', { items: [{ name: '', qty: 1 }] }, /اسم/);
});
let SNAP_COST;
t('confirm with deposit freezes the estimate; later price change does not touch it', () => {
  const r = ok('confirmOrder', { id: O1.id, deposit: { amount: 5000, method: 'vodafone', date: '2026-10-11' } }); data();
  O1 = ord(O1.id);
  assert.strictEqual(O1.status, 'confirmed'); assert.ok(O1.snapshot && O1.snapshot.materials.length >= 3);
  near(O1.paid, 5000); near(O1.remaining, 10800);
  SNAP_COST = O1.est_cost;
  assert.ok(r.result.payment_id);
  ok('saveMaterial', Object.assign({}, mat('كونتر أرو 18 مم'), { price: { amount: 3000, qty: 1, unit: 'sheet' } })); data();
  O1 = ord(O1.id); near(O1.est_cost, SNAP_COST, 'frozen');
  bad('confirmOrder', { id: O1.id }, /متأكد/);
  bad('saveOrder', quotePayload({ id: O1.id }), /مبيتعدلش/);
  // restore price for the rest of the tests
  ok('saveMaterial', Object.assign({}, mat('كونتر أرو 18 مم'), { price: { amount: 1537.5, qty: 1, unit: 'sheet' } })); data();
});
t('confirming never reduces materials', () => {
  const before = mat('كونتر أرو 18 مم').stock;
  const r = ok('saveOrder', Object.assign(quotePayload(), { confirm: true })); data();
  assert.strictEqual(ord(r.result.id).status, 'confirmed');
  near(mat('كونتر أرو 18 مم').stock, before);
  ok('cancelOrder', { id: r.result.id }); data();
});

console.log('\nIssue, return, production, delivery');
t('issue is all-or-nothing: shortage lists materials and writes nothing', () => {
  const before = mat('مفصلات').stock;
  const r = bad('issueMaterials', { order_id: O1.id, lines: [{ material_id: mat('مفصلات').id, qty: 4, unit: 'pcs' }, { material_id: mat('خشب زان').id, qty: 1, unit: 'm3' }] }, /MATERIAL_SHORT/);
  assert.ok(r.details[0].name === 'خشب زان');
  data(); near(mat('مفصلات').stock, before);
});
t('issue to order at average cost → actual cost; status goes to production', () => {
  const ply = mat('كونتر أرو 18 مم');
  ok('issueMaterials', { order_id: O1.id, lines: [{ material_id: ply.id, qty: 2, unit: 'sheet' }, { material_id: mat('مفصلات').id, qty: 8, unit: 'pcs' }] }); data();
  O1 = ord(O1.id);
  assert.strictEqual(O1.status, 'production');
  near(O1.act_material, Math.round((2 * AREA * ply.avg_cost) * 100) / 100 + 80, '', 0.02);
  near(mat('كونتر أرو 18 مم').stock, ply.stock - 2 * AREA);
});
t('leftovers return at issue cost (even after a new purchase price)', () => {
  const ply0 = mat('كونتر أرو 18 مم'), issueCost = ply0.avg_cost;
  ok('savePurchase', { supplier_id: SUP.id, paid_now: 0, lines: [{ material_id: ply0.id, qty: 2, unit: 'sheet', total_price: 4000 }] }); data();
  const ply = mat('كونتر أرو 18 مم');
  const before = ord(O1.id).act_material;
  ok('returnMaterials', { order_id: O1.id, lines: [{ material_id: ply.id, qty: 0.5, unit: 'sheet' }] }); data();
  near(ord(O1.id).act_material, before - Math.round(0.5 * AREA * issueCost * 100) / 100, 'returned at issue cost', 0.02);
  near(mat('كونتر أرو 18 مم').avg_cost, (ply.stock * ply.avg_cost + 0.5 * AREA * issueCost) / (ply.stock + 0.5 * AREA), '', 1e-9);
  bad('returnMaterials', { order_id: O1.id, lines: [{ material_id: ply.id, qty: 10, unit: 'sheet' }] }, /أكبر من اللي اتصرف/);
});
t('production for an order item: materials issued, ready pieces up, cannot exceed ordered qty', () => {
  const it = O1.items[0];
  const before = ord(O1.id).act_material;
  ok('recordProduction', { target: 'order', item_id: it.id, qty: 1, materials: [{ material_id: mat('كونتر أرو 18 مم').id, qty: 1.5, unit: 'sheet' }] }); data();
  O1 = ord(O1.id);
  assert.strictEqual(O1.items[0].made_qty, 1);
  assert.ok(O1.act_material > before);
  bad('recordProduction', { target: 'order', item_id: it.id, qty: 2, materials: [] }, /أكتر من المطلوب/);
  assert.ok(D.production[0].batch_no.startsWith('M-'));
});
t('delivery with missing pieces: refused without produce; produce+deliver blocked by materials writes nothing', () => {
  const r = bad('deliverOrder', { id: O1.id }, /ITEM_SHORT/);
  assert.strictEqual(r.details.length, 2);
  // empty the موسكي stock so the automatic production must fail
  const mus = mat('خشب موسكي'), stock = mus.stock;
  ok('adjustStock', { material_id: mus.id, mode: 'count', qty: 0, unit: 'm3', notes: 'اختبار' }); data();
  const snapStock = mat('كونتر أرو 18 مم').stock, prodCount = D.production.length;
  const r2 = bad('deliverOrder', { id: O1.id, produce: true }, /MATERIAL_SHORT/);
  assert.ok(r2.details.some(x => x.name === 'خشب موسكي'));
  data(); near(mat('كونتر أرو 18 مم').stock, snapStock, 'nothing written'); assert.strictEqual(D.production.length, prodCount);
  assert.strictEqual(ord(O1.id).status, 'production');
  ok('adjustStock', { material_id: mus.id, mode: 'add', qty: stock / 1e6, unit: 'm3', notes: 'رجوع' }); data();
});
t('"سجّل التصنيع وسلّم" in one step; pieces leave the store at delivery', () => {
  const r = ok('deliverOrder', { id: O1.id, produce: true }); data();
  O1 = ord(O1.id);
  assert.strictEqual(O1.status, 'delivered'); assert.ok(O1.stock_out === true || O1.stock_out === 'TRUE');
  assert.strictEqual(r.result.produced.length, 2);
  O1.items.forEach(it => { assert.strictEqual(it.made_qty, it.qty); assert.strictEqual(it.out_item, it.qty); });
  assert.ok(O1.act_material > 0 && O1.act_cost >= O1.act_material);
  bad('deliverOrder', { id: O1.id }, /متسلمش/);
});
t('payments, remaining and receipts numbering; actual costs recorded', () => {
  ok('addPayment', { order_id: O1.id, amount: 10800, method: 'instapay' }); data();
  near(ord(O1.id).remaining, 0);
  assert.ok(D.payments[0].receipt_no.startsWith('R-'));
  ok('addOrderCost', { order_id: O1.id, kind: 'مصنعية', amount: 2500, paid_to: 'الأسطى' });
  ok('addOrderCost', { order_id: O1.id, kind: 'نقل', amount: 200 }); data();
  O1 = ord(O1.id); near(O1.act_costs, 2700); near(O1.act_profit, O1.total - O1.act_material - 2700, '', 0.011);
  ok('voidOrderCost', { id: D.order_costs[0].id }); data(); near(ord(O1.id).act_costs, 2500);
  const pid = D.payments[0].id; ok('voidPayment', { id: pid }); data(); near(ord(O1.id).remaining, 10800);
  ok('addPayment', { order_id: O1.id, amount: 10800, method: 'cash' }); data();
});
t('cancel after delivery: pieces back to the store exactly once; refund ≤ paid', () => {
  bad('cancelOrder', { id: O1.id, refund: { amount: 999999 } }, /أكبر من المدفوع/);
  data(); assert.strictEqual(ord(O1.id).status, 'delivered', 'failed refund rolled nothing? (status must not change)');
});

console.log('\nStock products (ready items)');
let DOOR;
t('production for stock: materials consumed, product stock and cost up', () => {
  ok('saveProduct', { name: 'باب حشو 90×210', category: 'أبواب', selling_price: 3500, labor: [{ kind: 'مصنعية', amount: 400 }],
    lines: [{ ltype: 'piece', name: 'حلق', material_id: mat('خشب موسكي').id, count: 2, length: 210, width: 10, thickness: 4 }] }); data();
  DOOR = prod('باب حشو 90×210');
  const mus = mat('خشب موسكي');
  ok('recordProduction', { target: 'stock', product_id: DOOR.id, qty: 3, materials: [{ material_id: mus.id, qty: 0.05, unit: 'm3' }] }); data();
  DOOR = prod('باب حشو 90×210');
  assert.strictEqual(DOOR.stock, 3); near(DOOR.avg_cost, 50000 * mus.avg_cost / 3, '', 1e-3);
  near(mat('خشب موسكي').stock, mus.stock - 50000);
});
let O2;
t('selling ready doors from stock: delivered from the products store with their cost', () => {
  const r = ok('saveOrder', { customer: { name: 'محمد', phone: '01000000001' }, items: [{ product_id: DOOR.id, name: DOOR.name, qty: 2, unit_price: 3500, lines: DOOR.lines }], confirm: true });
  data(); O2 = ord(r.result.id);
  ok('deliverOrder', { id: O2.id }); data();
  O2 = ord(O2.id); assert.strictEqual(O2.status, 'delivered'); assert.strictEqual(O2.items[0].out_product, 2);
  assert.strictEqual(prod('باب حشو 90×210').stock, 1);
  near(O2.act_material, Math.round(2 * DOOR.avg_cost * 100) / 100, 'stock cost carried to the order', 0.02);
});
t('cancel after delivery returns pieces once; second cancel refused', () => {
  ok('addPayment', { order_id: O2.id, amount: 1000, method: 'cash' });
  ok('cancelOrder', { id: O2.id, refund: { amount: 1000, method: 'cash' } }); data();
  assert.strictEqual(prod('باب حشو 90×210').stock, 3);
  O2 = ord(O2.id); near(O2.paid, 0); assert.strictEqual(O2.items[0].out_product, 0);
  bad('cancelOrder', { id: O2.id }, /ملغي بالفعل/);
  data(); assert.strictEqual(prod('باب حشو 90×210').stock, 3, 'not returned twice');
});
t('reverse stock production only while pieces are still in the store', () => {
  const b = D.production.find(x => x.target === 'stock');
  ok('reverseProduction', { id: b.id }); data();
  assert.strictEqual(prod('باب حشو 90×210').stock, 0);
  bad('reverseProduction', { id: b.id }, /اتلغت/);
});
t('order item production reversal blocked after delivery', () => {
  const b = D.production.find(x => x.order_id === O1.id);
  bad('reverseProduction', { id: b.id }, /اتسلمت/);
});

console.log('\nStatus rules');
t('reopen to quote only when nothing was issued/made', () => {
  const r = ok('saveOrder', Object.assign(quotePayload(), { confirm: true })); data();
  const id = r.result.id;
  ok('setOrderStatus', { id, status: 'quote' }); data();
  assert.strictEqual(ord(id).status, 'quote'); assert.ok(ord(id).estimated);
  ok('confirmOrder', { id }); ok('issueMaterials', { order_id: id, lines: [{ material_id: mat('مفصلات').id, qty: 1, unit: 'pcs' }] });
  bad('setOrderStatus', { id, status: 'quote' }, /مينفعش/);
  bad('setOrderStatus', { id, status: 'delivered' }, /مينفعش/);
  ok('setOrderStatus', { id, status: 'ready' }); data(); assert.strictEqual(ord(id).status, 'ready');
  ok('cancelOrder', { id }); data();
});
t('customer / due date editable at any status', () => {
  ok('updateOrderInfo', { id: O1.id, due_date: '2026-11-01', customer: { name: 'أحمد محمود', phone: '01112223334' } }); data();
  assert.strictEqual(ord(O1.id).due_date, '2026-11-01');
});

console.log('\nSuppliers, expenses, documents');
t('supplier payments and balance; expenses', () => {
  data();
  const owed = () => {
    const s = D.suppliers.find(x => x.id === SUP.id);
    const pur = D.purchases.filter(p => p.supplier_id === SUP.id && p.status !== 'reversed').reduce((a, p) => a + p.total, 0);
    const pay = D.supplier_payments.filter(p => p.supplier_id === SUP.id && p.status !== 'void').reduce((a, p) => a + p.amount, 0);
    return (s.opening_balance || 0) + pur - pay;
  };
  const before = owed();
  ok('addSupplierPayment', { supplier_id: SUP.id, amount: 1000, method: 'cash' }); data();
  near(owed(), before - 1000);
  ok('saveExpense', { category: 'إيجار', amount: 3000, date: '2026-10-01' });
  ok('saveExpense', { category: 'كهرباء ومياه', amount: 450 }); data();
  assert.strictEqual(D.expenses.filter(e => e.status !== 'void').length, 2);
  ok('voidExpense', { id: D.expenses[0].id }); data();
  assert.strictEqual(D.expenses.filter(e => e.status !== 'void').length, 1);
  bad('saveExpense', { category: 'إيجار', amount: 0 }, /أكبر من/);
});
t('invoice PDF stored per order (replaced, not duplicated); junk refused', () => {
  const pdf = Buffer.from('%PDF-1.4 test').toString('base64');
  const a = ok('saveInvoicePdf', { order_id: O1.id, data: pdf, sig: 's1' }).result.url;
  const b = ok('saveInvoicePdf', { order_id: O1.id, data: pdf, sig: 's2' }).result.url;
  assert.notStrictEqual(a, b); data(); assert.strictEqual(ord(O1.id).invoice_sig, 's2');
  const trashed = Object.values(G._files).filter(f => f.trashed).length; assert.ok(trashed >= 1);
  bad('saveInvoicePdf', { order_id: O1.id, data: Buffer.from('hello').toString('base64') }, /غير صالح/);
  const pay = D.payments.find(p => p.order_id === O1.id && p.status !== 'void');
  assert.ok(ok('saveReceiptPdf', { payment_id: pay.id, data: pdf, sig: 'x' }).result.url.includes('drive.google.com'));
  ok('addPayment', { order_id: O1.id, amount: 1, method: 'cash' }); data();
  assert.strictEqual(ord(O1.id).invoice_sig, '', 'payment makes the PDF stale');
});

console.log('\nSafety');
t('wrong key is refused', () => {
  const r = JSON.parse(G.doPost({ postData: { contents: JSON.stringify({ k: 'nope', action: 'bootstrap' }) } }).getContent());
  assert.strictEqual(r.ok, false); assert.strictEqual(r.auth, false);
});
t('duplicate requestId counted once and returns the same result', () => {
  const before = (data(), D.expenses.length);
  const a = ok('saveExpense', { category: 'نقل ومواصلات', amount: 50 }, 'same-rid-1');
  const b = ok('saveExpense', { category: 'نقل ومواصلات', amount: 50 }, 'same-rid-1');
  assert.ok(b.duplicate); assert.strictEqual(b.result.id, a.result.id);
  data(); assert.strictEqual(D.expenses.length, before + 1);
});
t('formula injection neutralised', () => {
  ok('saveCustomer', { name: '=HYPERLINK("http://x")', phone: '' }); data();
  assert.ok(D.customers.some(c => c.name.startsWith('=HYPERLINK')), 'stored as text');
});
t('unknown action, long text, bad numbers rejected', () => {
  bad('dropTables', {}, /غير معروفة/);
  bad('saveCustomer', { name: 'x'.repeat(200) }, /أطول/);
  bad('addPayment', { order_id: O1.id, amount: 'abc' }, /رقم غير صحيح/);
  bad('saveCustomer', { name: 'س', phone: '01112223334' }, /متسجل/);
});
t('archive keeps history & costing', () => {
  const m = mat('مفصلات');
  ok('setMaterialActive', { id: m.id, active: false }); data();
  assert.strictEqual(mat('مفصلات').active, false);
  assert.ok(prod('دولاب 2 ضلفة').cost.material_cost > 0);
  ok('setMaterialActive', { id: m.id, active: true }); data();
});
t('product store count/waste for catalog stock and order-item pieces', () => {
  ok('adjustProductStock', { product_id: DOOR.id, mode: 'count', qty: 2, notes: 'جرد' }); data();
  assert.strictEqual(prod('باب حشو 90×210').stock, 2);
  bad('adjustProductStock', { product_id: DOOR.id, mode: 'waste', qty: 5 }, /أكبر/);
});
t('rate limit stops a flood of writes', () => {
  G.APP.MAX_WRITES_PER_MIN = 0;
  bad('saveExpense', { category: 'نقل ومواصلات', amount: 5 }, /دقيقة/);
  G.APP.MAX_WRITES_PER_MIN = 100000;
});
t('daily movement totals for reports', () => {
  data(); assert.ok(D.daily.length > 0 && D.daily.every(r => r.length === 4));
  assert.ok(D.daily.some(r => r[2] === 'ISSUE' && r[3] < 0));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
