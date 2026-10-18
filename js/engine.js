/**
 * Awlad El-Sheikh Woodworks — Costing Engine (pure functions, no Google services).
 * The SAME file runs on the server (Apps Script) and in the browser (js/engine.js) so the
 * numbers on screen are always the numbers the server saves.
 *
 * Every material is stored in ONE base unit decided by its type:
 *   sheet  (كونتر، أبلكاش، MDF، HDF، إسفنج ألواح) → cm²   (bought by sheet / m²)
 *   solid  (موسكي، زان…)                         → cm³   (bought by m³ or by board dimensions)
 *   linear (شريط حرف، كرانيش، قماش بالمتر)        → cm    (bought by meter / roll)
 *   count  (مفصلات، مجاري، مقابض، مسامير…)        → pcs   (bought by piece / dozen / box)
 *   liquid (بويات، ورنيش، غراء)                  → ml or g (bought by liter/kg/can)
 * avg_cost is always "EGP per ONE base unit".
 * Piece dimensions are in cm (length, width, thickness). A sheet's thickness belongs to the material.
 */

var MTYPES = {
  sheet:  { ar: 'ألواح', one: 'لوح', base: 'cm2', waste: 10 },
  solid:  { ar: 'خشب', one: 'خشب', base: 'cm3', waste: 20 },
  linear: { ar: 'بالمتر', one: 'بالمتر', base: 'cm', waste: 5 },
  count:  { ar: 'بالعدد', one: 'بالعدد', base: 'pcs', waste: 0 },
  liquid: { ar: 'سوائل وأوزان', one: 'سوائل/وزن', base: 'ml', waste: 5 }
};

/* f = how many BASE units one unit holds (null = depends on the material) */
var UNITS = {
  cm2:   { base: 'cm2', f: 1,     ar: 'سم²' },
  m2:    { base: 'cm2', f: 10000, ar: 'م²' },
  sheet: { base: 'cm2', f: null,  ar: 'لوح' },
  cm3:   { base: 'cm3', f: 1,     ar: 'سم³' },
  m3:    { base: 'cm3', f: 1e6,   ar: 'م³' },
  board: { base: 'cm3', f: null,  ar: 'لوح/عرق' },
  cm:    { base: 'cm',  f: 1,     ar: 'سم' },
  m:     { base: 'cm',  f: 100,   ar: 'متر' },
  pcs:   { base: 'pcs', f: 1,     ar: 'قطعة' },
  dozen: { base: 'pcs', f: 12,    ar: 'دستة' },
  ml:    { base: 'ml',  f: 1,     ar: 'مللي' },
  l:     { base: 'ml',  f: 1000,  ar: 'لتر' },
  g:     { base: 'g',   f: 1,     ar: 'جرام' },
  kg:    { base: 'g',   f: 1000,  ar: 'كيلو' },
  pack:  { base: '*',   f: null,  ar: 'عبوة' }
};

var DEFAULT_SHEET = { len: 244, wid: 122 };

function num_(v) {
  if (v === null || v === undefined || v === '') return 0;
  var n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return isFinite(n) ? n : 0;
}
function r2_(n) { return Math.round((num_(n) + Number.EPSILON) * 100) / 100; }
function r4_(n) { return Math.round((num_(n) + Number.EPSILON) * 10000) / 10000; }
function r6_(n) { return Math.round((num_(n) + Number.EPSILON) * 1e6) / 1e6; }

function mtypeOf_(m) { return MTYPES[m && m.mtype] ? m.mtype : 'count'; }
function baseOf_(m) {
  var t = mtypeOf_(m);
  if (t === 'liquid') return m.base_unit === 'g' ? 'g' : 'ml';
  return MTYPES[t].base;
}
function sheetArea_(m) {
  var L = num_(m.sheet_len) || DEFAULT_SHEET.len, W = num_(m.sheet_wid) || DEFAULT_SHEET.wid;
  return L * W;
}
function defaultWaste_(m, settings) {
  var t = mtypeOf_(m);
  var s = settings && settings['waste_' + t];
  return s === undefined || s === null || s === '' ? MTYPES[t].waste : num_(s);
}
function wasteOf_(m, settings) {
  return m.waste_pct === '' || m.waste_pct === null || m.waste_pct === undefined ? defaultWaste_(m, settings) : num_(m.waste_pct);
}

/** Units allowed for a material (for buying or for accessory lines). */
function unitsFor_(m) {
  var t = mtypeOf_(m), hasPack = num_(m.pack_qty) > 0;
  var u;
  if (t === 'sheet') u = ['sheet', 'm2', 'cm2'];
  else if (t === 'solid') u = ['m3', 'cm3'];
  else if (t === 'linear') u = ['m', 'cm'];
  else if (t === 'count') u = ['pcs', 'dozen'];
  else u = baseOf_(m) === 'g' ? ['kg', 'g'] : ['l', 'ml'];
  if (hasPack && t !== 'sheet' && t !== 'solid') u.push('pack');
  return u;
}

/** How many base units ONE "unit" is, for this material. Throws on a unit that does not fit. */
function unitFactor_(unit, m) {
  var u = UNITS[unit];
  if (!u) throw new Error('وحدة غير معروفة');
  if (unitsFor_(m).indexOf(unit) === -1) throw new Error('الوحدة "' + u.ar + '" لا تناسب "' + (m.name || 'الخامة') + '"');
  if (unit === 'sheet') return sheetArea_(m);
  if (unit === 'pack') return num_(m.pack_qty);
  return u.f;
}
function toBase_(qty, unit, m) { return r6_(num_(qty) * unitFactor_(unit, m)); }

/** Price "amount EGP for qty unit" -> EGP per base unit. */
function pricePerBase_(amount, qty, unit, m) {
  var q = toBase_(qty, unit, m);
  if (!(q > 0)) throw new Error('الكمية يجب أن تكون أكبر من صفر');
  if (num_(amount) < 0) throw new Error('السعر لا يمكن أن يكون سالبًا');
  return num_(amount) / q;
}

/** Volume (cm³) of boards bought by dimensions: count × length cm × width cm × thickness cm. */
function boardVolume_(count, l, w, t) { return r6_(num_(count) * num_(l) * num_(w) * num_(t)); }

/** Weighted-average cost after adding stock. */
function weightedAvg_(oldQty, oldAvg, addQty, addTotalCost) {
  oldQty = num_(oldQty); oldAvg = num_(oldAvg); addQty = num_(addQty); addTotalCost = num_(addTotalCost);
  if (!(addQty > 0)) return oldAvg;
  if (oldQty <= 0) return addTotalCost / addQty;          // no valid old stock -> new price wins
  return (oldQty * oldAvg + addTotalCost) / (oldQty + addQty);
}

/**
 * NET base quantity used by ONE line for ONE unit of the product/item.
 * line.ltype = 'piece' → count × dimensions (by the material's type)
 * line.ltype = 'item'  → qty in a unit (accessories, paint, foam, fabric…)
 * Returns {net, error}
 */
function lineNet_(line, m) {
  if (!m) return { net: 0, error: 'خامة غير محددة' };
  var t = mtypeOf_(m);
  if (line.ltype === 'item') {
    var q = num_(line.qty);
    if (!(q > 0)) return { net: 0, error: 'الكمية غير محددة' };
    try { return { net: r6_(q * unitFactor_(line.unit || unitsFor_(m)[0], m)) }; }
    catch (e) { return { net: 0, error: e.message }; }
  }
  var c = num_(line.count), L = num_(line.length), W = num_(line.width), T = num_(line.thickness);
  if (!(c > 0)) return { net: 0, error: 'العدد غير محدد' };
  if (t === 'sheet') { if (!(L > 0 && W > 0)) return { net: 0, error: 'الطول والعرض مطلوبين' }; return { net: r6_(c * L * W) }; }
  if (t === 'solid') { if (!(L > 0 && W > 0 && T > 0)) return { net: 0, error: 'الطول والعرض والسُمك مطلوبين' }; return { net: r6_(c * L * W * T) }; }
  if (t === 'linear') { if (!(L > 0)) return { net: 0, error: 'الطول مطلوب' }; return { net: r6_(c * L) }; }
  if (t === 'count') return { net: r6_(c) };
  return { net: 0, error: 'الخامة دي بتتحسب بالكمية — ضيفها في الإكسسوارات' };
}

/**
 * Core costing of several groups of lines (one group = one product / one order item).
 *  groups: [{key, qty, lines:[{ltype, material_id, count, length, width, thickness, qty, unit, name}], labor:[{amount}]}]
 *  opt: { materials: {id: material}, settings, waste: {material_id: pct} (order override),
 *         fullSheets: bool, prices: {material_id: unitCost} (frozen prices) }
 * Returns {
 *   materials: [{material_id, name, mtype, category, base_unit, net, waste_pct, gross, unit_cost, cost, area_cost,
 *                sheet_area, sheets, short_price}],
 *   groups: {key: {qty, material_cost, labor_cost, total_cost, unit_material, unit_labor, unit_cost, by_cat, lines:[{net, gross, cost}] }},
 *   material_cost, labor_cost, total_cost, warnings: [] }
 */
function costGroups_(groups, opt) {
  opt = opt || {};
  var mById = opt.materials || {}, wasteOv = opt.waste || {}, prices = opt.prices || null;
  var acc = {}, order = [], warnings = [], res = { materials: [], groups: {}, material_cost: 0, labor_cost: 0, total_cost: 0, warnings: warnings };
  function warn(s) { if (warnings.indexOf(s) === -1) warnings.push(s); }
  (groups || []).forEach(function (g) {
    var q = num_(g.qty);
    var G = res.groups[g.key] = { qty: q, material_cost: 0, labor_cost: 0, total_cost: 0, by_cat: {}, lines: [], _net: {} };
    (g.lines || []).forEach(function (ln) {
      var m = mById[ln.material_id];
      var r = lineNet_(ln, m);
      var info = { net: r.net, net_total: r6_(r.net * q), gross: 0, cost: 0, error: r.error || '' };
      G.lines.push(info);
      if (r.error) { warn((g.name ? g.name + ': ' : '') + (ln.name ? ln.name + ' — ' : '') + r.error); return; }
      if (!m) return;
      if (!acc[m.id]) { acc[m.id] = { m: m, net: 0, byGroup: {} }; order.push(m.id); }
      acc[m.id].net += r.net * q;
      acc[m.id].byGroup[g.key] = (acc[m.id].byGroup[g.key] || 0) + r.net * q;
      G._net[m.id] = (G._net[m.id] || 0) + r.net * q;
      info._m = m.id;
    });
    (g.labor || []).forEach(function (lb) { G.labor_cost += Math.max(0, num_(lb.amount)) * q; });
  });
  order.forEach(function (id) {
    var a = acc[id], m = a.m, t = mtypeOf_(m);
    var w = wasteOv[id] !== undefined && wasteOv[id] !== '' && wasteOv[id] !== null ? num_(wasteOv[id]) : wasteOf_(m, opt.settings);
    var unitCost = prices && prices[id] !== undefined ? num_(prices[id]) : num_(m.avg_cost);
    var net = r6_(a.net), gross = r6_(net * (1 + w / 100));
    var row = { material_id: id, name: m.name, mtype: t, category: m.category || MTYPES[t].ar, base_unit: baseOf_(m),
                net: net, waste_pct: w, gross: gross, unit_cost: unitCost, area_cost: r2_(gross * unitCost), cost: 0,
                sheet_area: 0, sheets: 0, no_price: !(unitCost > 0) };
    if (row.no_price) warn('سعر "' + m.name + '" مش متسجل');
    row.cost = row.area_cost;
    if (t === 'sheet') {
      row.sheet_area = sheetArea_(m);
      row.sheets = gross > 0 ? Math.ceil(gross / row.sheet_area - 1e-9) : 0;
      row.sheets_exact = r4_(gross / row.sheet_area);
      if (opt.fullSheets) row.cost = r2_(row.sheets * row.sheet_area * unitCost);
    }
    res.materials.push(row);
    res.material_cost += row.cost;
    // allocate this material's cost to groups by their share of the net quantity
    Object.keys(a.byGroup).forEach(function (k) {
      var share = net > 0 ? a.byGroup[k] / net : 0;
      var G = res.groups[k], c = row.cost * share;
      G.material_cost += c;
      G.by_cat[row.category] = (G.by_cat[row.category] || 0) + c;
    });
  });
  // per-line detail (gross & cost) — useful for the cut list and the item editor
  Object.keys(res.groups).forEach(function (k) {
    var G = res.groups[k];
    G.lines.forEach(function (info) {
      if (!info._m) return;
      var row = res.materials.filter(function (x) { return x.material_id === info._m; })[0];
      if (!row) return;
      info.gross = r6_(info.net_total * (1 + row.waste_pct / 100));
      info.cost = row.net > 0 ? r4_(row.cost * info.net_total / row.net) : 0;
      delete info._m;
    });
    delete G._net;
    G.material_cost = r2_(G.material_cost);
    G.labor_cost = r2_(G.labor_cost);
    G.total_cost = r2_(G.material_cost + G.labor_cost);
    G.unit_material = G.qty > 0 ? r4_(G.material_cost / G.qty) : 0;
    G.unit_labor = G.qty > 0 ? r4_(G.labor_cost / G.qty) : 0;
    G.unit_cost = G.qty > 0 ? r4_(G.total_cost / G.qty) : 0;
    Object.keys(G.by_cat).forEach(function (c) { G.by_cat[c] = r2_(G.by_cat[c]); });
    res.labor_cost += G.labor_cost;
  });
  res.material_cost = r2_(res.material_cost);
  res.labor_cost = r2_(res.labor_cost);
  res.total_cost = r2_(res.material_cost + res.labor_cost);
  return res;
}

/** Cost of ONE unit of a catalog product (template). */
function productCost_(product, lines, materials, settings) {
  var c = costGroups_([{ key: 'p', qty: 1, name: '', lines: lines || [], labor: safeArr_(product.labor) }],
    { materials: materials, settings: settings });
  var g = c.groups.p;
  var price = num_(product.selling_price);
  var out = { materials: c.materials, material_cost: g.material_cost, labor_cost: g.labor_cost, total: g.total_cost,
              by_cat: g.by_cat, lines: g.lines, warnings: c.warnings, price: price, profit: r2_(price - g.total_cost),
              margin: price > 0 ? r4_((price - g.total_cost) / price) : null };
  if (!(lines || []).length) out.warnings.push('لسه مفيش قطع أو خامات للمنتج');
  return out;
}

/** Suggested price for a target margin (margin = profit ÷ price). */
function suggestedPrice_(cost, marginPct) {
  var m = num_(marginPct);
  if (m >= 100 || m < 0) return 0;
  return r2_(num_(cost) / (1 - m / 100));
}

function safeArr_(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v) { try { var x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch (e) { return []; } }
  return [];
}

/**
 * Estimate of a whole order.
 *  order: {discount, extras:[{label, amount}], waste:{}, full_sheets}
 *  items: [{id, qty, unit_price, labor:[...], name}]   linesByItem: {item_id: [lines per ONE unit]}
 */
function orderEstimate_(order, items, linesByItem, materials, settings, prices) {
  var groups = (items || []).map(function (it) {
    return { key: it.id, qty: num_(it.qty), name: it.name, lines: linesByItem[it.id] || [], labor: safeArr_(it.labor) };
  });
  var c = costGroups_(groups, { materials: materials, settings: settings, waste: order.waste || {},
                                fullSheets: order.full_sheets === true || order.full_sheets === 'TRUE' || order.full_sheets === 'true', prices: prices });
  var t = { items_total: 0, discount: r2_(Math.max(0, num_(order.discount))), total: 0, material_cost: c.material_cost,
            labor_cost: c.labor_cost, extra_cost: 0, total_cost: 0, profit: 0, margin: null, qty: 0,
            materials: c.materials, items: {}, warnings: c.warnings };
  (items || []).forEach(function (it) {
    var g = c.groups[it.id], q = num_(it.qty), rev = q * num_(it.unit_price);
    t.qty += q;
    t.items_total += rev;
    t.items[it.id] = { qty: q, revenue: r2_(rev), material_cost: g.material_cost, labor_cost: g.labor_cost, total_cost: g.total_cost,
                       unit_cost: g.unit_cost, unit_material: g.unit_material, unit_labor: g.unit_labor, by_cat: g.by_cat,
                       profit: r2_(rev - g.total_cost), lines: g.lines };
  });
  safeArr_(order.extras).forEach(function (e) { t.extra_cost += Math.max(0, num_(e.amount)); });
  t.items_total = r2_(t.items_total);
  t.extra_cost = r2_(t.extra_cost);
  t.total = r2_(t.items_total - t.discount);
  t.total_cost = r2_(t.material_cost + t.labor_cost + t.extra_cost);
  t.profit = r2_(t.total - t.total_cost);
  t.margin = t.total > 0 ? r4_(t.profit / t.total) : null;
  return t;
}

/**
 * Materials to issue for making k units of one item (gross = with waste), from the per-unit lines.
 * Returns [{material_id, name, qty (base)}]
 */
function materialsForUnits_(lines, k, materials, settings, waste) {
  var c = costGroups_([{ key: 'x', qty: num_(k), lines: lines || [], labor: [] }], { materials: materials, settings: settings, waste: waste || {} });
  return c.materials.map(function (r) { return { material_id: r.material_id, name: r.name, base_unit: r.base_unit, qty: r.gross, unit_cost: r.unit_cost }; });
}

/** Display helpers shared by server text and the browser. */
function displayQty_(qtyBase, m) {
  var t = mtypeOf_(m), q = num_(qtyBase);
  if (t === 'sheet') return { v: r4_(q / sheetArea_(m)), u: 'لوح' };
  if (t === 'solid') return { v: r6_(q / 1e6), u: 'م³' };
  if (t === 'linear') return { v: r4_(q / 100), u: 'متر' };
  if (t === 'count') return { v: r4_(q), u: 'قطعة' };
  return baseOf_(m) === 'g' ? { v: r4_(q / 1000), u: 'كيلو' } : { v: r4_(q / 1000), u: 'لتر' };
}
/** Price per the "display unit" (per sheet, per m³, per meter, per piece, per liter/kg). */
function displayPrice_(avgCost, m) {
  var t = mtypeOf_(m), a = num_(avgCost);
  if (t === 'sheet') return { v: r2_(a * sheetArea_(m)), u: 'لوح' };
  if (t === 'solid') return { v: r2_(a * 1e6), u: 'م³' };
  if (t === 'linear') return { v: r2_(a * 100), u: 'متر' };
  if (t === 'count') return { v: r4_(a), u: 'قطعة' };
  return baseOf_(m) === 'g' ? { v: r2_(a * 1000), u: 'كيلو' } : { v: r2_(a * 1000), u: 'لتر' };
}
/** The unit a material is normally shown/bought in. */
function displayUnit_(m) {
  var t = mtypeOf_(m);
  return t === 'sheet' ? 'sheet' : t === 'solid' ? 'm3' : t === 'linear' ? 'm' : t === 'count' ? 'pcs' : (baseOf_(m) === 'g' ? 'kg' : 'l');
}

/** Egyptian-friendly WhatsApp number: 01xxxxxxxxx → 201xxxxxxxxx; +/00 prefixes removed. */
function waNumber_(phone) {
  var d = String(phone || '').replace(/[٠-٩]/g, function (x) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(x); }).replace(/[^0-9+]/g, '');
  if (d.indexOf('+') === 0) d = d.slice(1); else if (d.indexOf('00') === 0) d = d.slice(2); else if (/^0\d{10}$/.test(d)) d = '2' + d;
  return d.replace(/\D/g, '');
}

if (typeof module !== 'undefined') {
  module.exports = { MTYPES: MTYPES, UNITS: UNITS, num_: num_, r2_: r2_, r4_: r4_, r6_: r6_, unitsFor_: unitsFor_,
    unitFactor_: unitFactor_, toBase_: toBase_, pricePerBase_: pricePerBase_, weightedAvg_: weightedAvg_, lineNet_: lineNet_,
    costGroups_: costGroups_, productCost_: productCost_, orderEstimate_: orderEstimate_, suggestedPrice_: suggestedPrice_,
    materialsForUnits_: materialsForUnits_, sheetArea_: sheetArea_, boardVolume_: boardVolume_, displayQty_: displayQty_,
    displayPrice_: displayPrice_, waNumber_: waNumber_, wasteOf_: wasteOf_, baseOf_: baseOf_ };
}
