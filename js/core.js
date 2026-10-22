/* Ahmed Abu El-Sheikh — core helpers, server calls, modal, navigation. */
var S = { data: null, view: 'dashboard', param: null, busy: false, modal: null,
  filters: { prodCat: 'all', prodQ: '', matType: 'all', matQ: '', ordStatus: 'open', ordQ: '', archived: false, custQ: '', supQ: '', storeTab: 'catalog' },
  draft: null, idraft: null, report: null };

var NAV = [
  { id: 'dashboard', t: 'الرئيسية', i: 'home' },
  { id: 'orders', t: 'الطلبات', i: 'receipt' },
  { id: 'products', t: 'المنتجات', i: 'sofa' },
  { id: 'materials', t: 'الخامات', i: 'layers' },
  { id: 'purchases', t: 'المشتريات', i: 'cart' },
  { id: 'production', t: 'التصنيع', i: 'saw' },
  { id: 'customers', t: 'العملاء', i: 'users' },
  { id: 'reports', t: 'التقارير', i: 'chart' }
];
var NAV_MORE = [
  { id: 'suppliers', t: 'الموردين', i: 'truck' },
  { id: 'expenses', t: 'مصاريف الورشة', i: 'wallet' },
  { id: 'settings', t: 'الإعدادات', i: 'settings' }
];
var BOTTOM = ['dashboard', 'orders', 'products', 'materials', 'more'];

var ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  sofa: '<path d="M4 11V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3"/><path d="M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2z"/><path d="M5 18v2M19 18v2"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7l10-5z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.6l2.4 12.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6"/>',
  saw: '<path d="M3 17 14 6l4 4-11 11H3z"/><path d="M14 6l2-2 4 4-2 2"/><path d="M6 15l1 1M8 13l1 1M10 11l1 1"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 20a6.5 6.5 0 0 0-2.5-5.1"/>',
  chart: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/>',
  truck: '<path d="M1 5h14v11H1z"/><path d="M15 9h4l3 3v4h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  wallet: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 13h2M2 10h20M6 6V4h12v2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  back: '<path d="m9 18 6-6-6-6"/>',
  chev: '<path d="m15 18-6-6 6-6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.1 10.4A6 6 0 1 1 10.3 18"/><path d="M7 6h1v4"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  save: '<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8M7 21v-7h10v7"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  play: '<path d="m6 4 14 8-14 8z"/>',
  flag: '<path d="M4 22V4a1 1 0 0 1 1-1h12l-2 4 2 4H5"/>',
  minus: '<path d="M5 12h14"/>',
  out: '<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 3v18"/>',
  in: '<path d="M14 7l-5 5 5 5"/><path d="M9 12h12"/><path d="M3 3v18"/>'
};
var WA_ICON = '<svg class="i" viewBox="0 0 24 24" style="fill:currentColor;stroke:none"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>';

function ic(name, cls) { return '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>'; }
function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function digits(s) { return String(s).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٫]/g, '.').replace(/[,٬\s]/g, ''); }
function n(v) { if (v === null || v === undefined || v === '') return 0; if (typeof v === 'number') return isFinite(v) ? v : 0; var x = Number(digits(v)); return isFinite(x) ? x : 0; }
/** '' for empty, NaN for invalid */
function parseIn(v) { if (v === null || v === undefined || String(v).trim() === '') return ''; var x = Number(digits(v)); return isFinite(x) ? x : NaN; }
function fmt(v, d) { var x = n(v); d = d === undefined ? 2 : d; return x.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d }); }
function money(v, d) { return '<span class="num">' + fmt(v, d === undefined ? 2 : d) + '</span> ج'; }
function pct(m) { if (m === null || m === undefined || m === '') return '—'; return '<span class="num">' + fmt(n(m) * 100, 1) + '%</span>'; }
function rid() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
function today() { return (S.data && S.data.today) || new Date().toISOString().slice(0, 10); }
function addDays(dateStr, k) { var p = String(dateStr).split('-'); var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + k)); return d.toISOString().slice(0, 10); }
function picImg(url) { return url ? '<img loading="lazy" src="' + esc(url) + '" alt="" onerror="this.remove()">' : ''; }
function initials(s) { s = String(s || '').trim(); return esc(s.charAt(0) || '؟'); }
function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
function isActive(x) { return !(x.active === false || x.active === 'FALSE' || x.active === 'false'); }
function setting(k, d) { var s = (S.data && S.data.settings) || {}; return s[k] === undefined || s[k] === '' ? d : s[k]; }
function jsonSetting(k) { try { var v = JSON.parse(setting(k, '[]')); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function cats() { return jsonSetting('categories'); }
function costKinds() { return jsonSetting('cost_kinds'); }
function expKinds() { return jsonSetting('expense_kinds'); }
function quickItems() { var q = jsonSetting('quick_items'); return q.length ? q : ['دولاب', 'سرير', 'كومودينو', 'تسريحة', 'شوفونيرة', 'مرآة', 'نيش', 'بوفيه', 'سفرة', 'ترابيزة', 'مطبخ', 'باب', 'شباك', 'حلق']; }
/** What an order item brings in: its price share of the order total (orders with an agreed total share it over the items). */
function itemRevenue(o, it) {
  var its = o.items || [], tot = n(o.total), sumP = 0, sumQ = 0;
  its.forEach(function (x) { sumP += n(x.qty) * n(x.unit_price); sumQ += n(x.qty); });
  if (sumP > 0) return tot * n(it.qty) * n(it.unit_price) / sumP;
  return sumQ > 0 ? tot * n(it.qty) / sumQ : 0;
}
function orderTitle(o) { return o.title || (o.items || []).map(function (it) { return it.name; }).slice(0, 3).join('، '); }
function target() { return n(setting('target_margin', 30)); }
function appName() { return setting('app_name', 'أحمد أبو الشيخ'); }
function bizName() { return setting('business_name', 'ورشة أحمد أبو الشيخ'); }

function mats() { return S.data.materials || []; }
function prods() { return S.data.products || []; }
function matById(id) { return mats().find(function (m) { return m.id === id; }); }
function prodById(id) { return prods().find(function (p) { return p.id === id; }); }
function custById(id) { return (S.data.customers || []).find(function (c) { return c.id === id; }); }
function supById(id) { return (S.data.suppliers || []).find(function (c) { return c.id === id; }); }
function orderById(id) { return (S.data.orders || []).find(function (o) { return o.id === id; }); }
function matMap() { var m = {}; mats().forEach(function (x) { m[x.id] = x; }); return m; }

/* ---------- materials: units & display ---------- */
var MT_AR = { sheet: 'ألواح', solid: 'خشب', linear: 'بالمتر', count: 'بالعدد', liquid: 'سوائل ووزن' };
var MT_ONE = { sheet: 'لوح (كونتر، MDF…)', solid: 'خشب (موسكي، زان…)', linear: 'بالمتر (شريط، قماش…)', count: 'بالعدد (حدايد…)', liquid: 'سائل / وزن (بويات، غراء…)' };
var UNIT_AR = { cm2: 'سم²', m2: 'م²', sheet: 'لوح', cm3: 'سم³', m3: 'م³', board: 'بالمقاسات', cm: 'سم', m: 'متر', pcs: 'قطعة', dozen: 'دستة', ml: 'مللي', l: 'لتر', g: 'جرام', kg: 'كيلو', pack: 'عبوة' };
function unitLabel(u, m) { if (u === 'pack' && m) return (m.pack_label || 'عبوة') + ' (' + fmt(displayQty_(m.pack_qty, m).v, 3) + ' ' + displayQty_(m.pack_qty, m).u + ')'; return UNIT_AR[u] || u; }
function unitOpts(m, sel, extra) {
  var list = unitsFor_(m).slice(); if (extra) list = list.concat(extra);
  sel = sel && list.indexOf(sel) >= 0 ? sel : displayUnit_(m);
  return list.map(function (u) { return '<option value="' + u + '"' + (u === sel ? ' selected' : '') + '>' + esc(unitLabel(u, m)) + '</option>'; }).join('');
}
/** "3.5 لوح" */
function qtyM(qBase, m, d) { var x = displayQty_(qBase, m); return '<span class="num">' + fmt(x.v, d === undefined ? (m.mtype === 'solid' ? 4 : 2) : d) + '</span> ' + x.u; }
/** "1,560 ج / لوح" */
function priceM(avg, m) { var x = displayPrice_(avg, m); return money(x.v, m.mtype === 'count' ? 2 : 2) + ' / ' + x.u; }
function matLabel(m) { return m.name + (m.thickness_mm && m.mtype === 'sheet' && String(m.name).indexOf(String(m.thickness_mm)) < 0 ? ' ' + m.thickness_mm + ' مم' : ''); }
function isLow(m) { return n(m.stock) < -1e-9 || (n(m.min_stock) > 0 && n(m.stock) <= n(m.min_stock) + 1e-9); }
function matOptions(sel, filter, placeholder) {
  var groups = {}, h = '<option value="">' + esc(placeholder || '— اختار الخامة —') + '</option>';
  mats().filter(function (m) { return (isActive(m) || m.id === sel) && (!filter || filter(m)); }).forEach(function (m) { (groups[m.mtype] = groups[m.mtype] || []).push(m); });
  ['sheet', 'solid', 'linear', 'count', 'liquid'].forEach(function (t) {
    if (!groups[t]) return;
    h += '<optgroup label="' + MT_AR[t] + '">' + groups[t].map(function (m) { return '<option value="' + esc(m.id) + '"' + (m.id === sel ? ' selected' : '') + '>' + esc(matLabel(m)) + '</option>'; }).join('') + '</optgroup>';
  });
  return h;
}

/* ---------- orders ---------- */
var STATUS = { quote: ['عرض سعر', 'b-gold'], confirmed: ['مؤكد', 'b-wood'], production: ['تحت التصنيع', 'b-warn'], ready: ['جاهز للتسليم', 'b-info'], delivered: ['تم التسليم', 'b-ok'], cancelled: ['ملغي', 'b-bad'] };
var STAMP = { quote: ['QUOTATION', 'عرض سعر'], confirmed: ['CONFIRMED', 'مؤكد'], production: ['IN PRODUCTION', 'تحت التصنيع'], ready: ['READY', 'جاهز'], delivered: ['DELIVERED', 'تم التسليم'], cancelled: ['CANCELLED', 'ملغي'] };
var PAY_AR = { cash: 'كاش', vodafone: 'فودافون كاش', instapay: 'إنستاباي', transfer: 'تحويل بنكي' };
var PAYKIND_AR = { deposit: 'عربون', payment: 'دفعة', refund: 'رد مبلغ' };
function isOpen(o) { return ['confirmed', 'production', 'ready'].indexOf(o.status) >= 0; }
function isLate(o) { return isOpen(o) && o.due_date && String(o.due_date) < today(); }
function dueSoon(o, days) { return isOpen(o) && o.due_date && String(o.due_date) >= today() && String(o.due_date) <= addDays(today(), days || 7); }
function custOf(o) { return custById(o.customer_id) || { name: '', phone: '', address: '' }; }
function statusBadge(o) { var s = STATUS[o.status] || ['', 'b-gray']; return '<span class="badge ' + s[1] + '">' + s[0] + '</span>' + (isLate(o) ? ' <span class="badge b-bad">' + ic('clock', 'sm') + 'متأخر</span>' : ''); }
function countsAsSale(o) { return ['confirmed', 'production', 'ready', 'delivered'].indexOf(o.status) >= 0; }

/* ---------- dates ---------- */
function fmtDate(s) { if (!s) return ''; var p = String(s).slice(0, 10).split('-'); return p.length === 3 ? '<span class="num">' + p[2] + '/' + p[1] + '/' + p[0] + '</span>' : esc(s); }
/** Date on customer documents: a slash that never splits (pictures and PDFs render it in one piece). */
function docDate(s) { if (!s) return ''; var p = String(s).slice(0, 10).split('-'); return p.length === 3 ? '<span class="num">' + p[2] + '\u2215' + p[1] + '\u2215' + p[0] + '</span>' : esc(s); }
/** Numbers like AS-0001 kept in one piece (also inside generated pictures). */
function nb(s) { return esc(String(s || '')).replace(/-/g, '\u2011'); }
function plainDate(s) { if (!s) return ''; var p = String(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(s); }
function fmtDateLong(s) { try { var p = String(s).split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]); return d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return s; } }
var MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
function monthName(ym) { var p = String(ym).split('-'); return MONTHS_AR[+p[1] - 1] + ' ' + p[0]; }

/* ======================= server ======================= */
/* The connection comes from the owner's private link: #d=<deployment id>&k=<key> — remembered on this device. */
var CFG_KEY = 'abusheikh_cfg';
/** d/k from a private link, a pasted link, or just its "#d=…&k=…" part — null when it isn't one. */
function linkCfg(s) {
  s = String(s || '');
  var d = s.match(/(?:^|[#&?])d=([A-Za-z0-9_-]{20,})(?=&|$)/), k = s.match(/(?:^|[#&?])k=([A-Za-z0-9]{20,})(?=&|$)/);
  return d && k ? { d: d[1], k: k[1] } : null;
}
function saveCfg(c) { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); return true; } catch (e) { return false; } }
var CFG = (function () {
  var c = linkCfg(String(location.hash || '').trim()), saved = null;
  if (!c) { try { saved = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch (e) { saved = null; } c = saved && linkCfg('d=' + saved.d + '&k=' + saved.k); }
  if (c) saveCfg(c);
  return c || null;
})();
/* The private link pasted into a tab that is already open only changes the "#…" part — open it. */
window.addEventListener('hashchange', function () {
  var c = linkCfg(location.hash);
  if (c && (!CFG || c.d !== CFG.d || c.k !== CFG.k)) { saveCfg(c); location.reload(); }
});
/** One server call. A failed connection or a garbled reply is retried once with the SAME requestId
    (the server never repeats a write it already did), so a short Google hiccup never shows up as an error. */
function api(action, payload, requestId) {
  if (!CFG) return Promise.reject(new Error('افتح السيستم من الرابط الخاص بيك'));
  var body = JSON.stringify({ k: CFG.k, action: action, payload: payload || {}, requestId: requestId || rid() });
  function once() {
    return fetch('https://script.google.com/macros/s/' + CFG.d + '/exec', {
      method: 'POST', body: body, credentials: 'omit', redirect: 'follow', cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }).then(function (r) {
      if (!r.ok) { var e1 = new Error('تعذر الاتصال بالسيرفر (' + r.status + ')'); e1.retry = true; throw e1; }
      return r.text().then(function (t) {
        try { return JSON.parse(t); } catch (x) { var e2 = new Error('السيرفر مردّش صح، جرّب تاني بعد ثواني'); e2.retry = true; throw e2; }
      });
    }, function () { var e3 = new Error('تعذر الاتصال، اتأكد من النت وجرّب تاني'); e3.retry = true; throw e3; });
  }
  return once().catch(function (e) {
    if (!e.retry) throw e;
    return new Promise(function (r) { setTimeout(r, 1500); }).then(once);
  })
    .then(function (res) {
      if (!res) throw new Error('مفيش رد من السيرفر');
      if (res.auth === false) { try { localStorage.removeItem(CFG_KEY); } catch (e) {} }
      if (res.data) S.data = res.data;
      if (res.ok) return res;
      var e = new Error(res.error || 'حصل خطأ'); e.details = res.details; e.code = res.code; e.auth = res.auth === false; throw e;
    });
}
function setBusy(on) { S.busy = on; document.getElementById('busybar').classList.toggle('on', !!on); }
/** Run a write once; buttons locked while running; the same requestId on retry never duplicates. */
/* Writes that need server 1.1.0 (agreed totals, editing payments, customer payments) wait until it is live. */
var NEEDS_SERVER = { saveOrder: '1.1.0', addCustomerPayment: '1.1.0', editPayment: '1.1.0', confirmOrder: '1.1.0' };
function verLess(a, b) { a = String(a || '0').split('.').map(Number); b = String(b).split('.').map(Number); for (var i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0); } return false; }
function run(action, payload, opts) {
  opts = opts || {};
  if (S.busy) return Promise.resolve(null);
  if (NEEDS_SERVER[action] && S.data && verLess(S.data.version, NEEDS_SERVER[action])) { toast('السيستم بيتحدّث دلوقتي — جرّب تاني بعد شوية', 'err'); return Promise.resolve(null); }
  setBusy(true);
  var btns = document.querySelectorAll('[data-lockable]'); btns.forEach(function (b) { b.disabled = true; });
  return api(action, payload, opts.rid).then(function (res) {
    setBusy(false); btns.forEach(function (b) { b.disabled = false; });
    if (res.duplicate) toast('العملية دي اتسجلت قبل كده — مش هتتكرر', 'ok');
    else if (opts.ok) toast(opts.ok, 'ok');
    return res;
  }).catch(function (e) {
    setBusy(false); btns.forEach(function (b) { b.disabled = false; });
    if (opts.onErr && opts.onErr(e) === true) return null;
    toast(e.message, 'err'); return null;
  });
}
function toast(msg, kind) {
  var box = document.getElementById('toasts'), el = document.createElement('div');
  el.className = 'toast ' + (kind || ''); el.innerHTML = (kind === 'err' ? ic('alert') : ic('check')) + '<div>' + esc(msg) + '</div>';
  box.appendChild(el); setTimeout(function () { el.remove(); }, kind === 'err' ? 6500 : 3200);
}

/* ======================= modal ======================= */
function modal(o) {
  closeModal();
  var root = document.getElementById('modalRoot');
  root.innerHTML = '<div class="scrim" id="scrim"><div class="sheet' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true"><div class="grab"></div>' +
    '<div class="sheet-h"><h3>' + esc(o.title) + '</h3><button class="iconbtn" data-act="closeModal" aria-label="إغلاق">' + ic('x') + '</button></div>' +
    '<div class="sheet-b" id="sheetBody">' + o.body + '</div>' + (o.footer ? '<div class="sheet-f">' + o.footer + '</div>' : '') + '</div></div>';
  document.getElementById('scrim').addEventListener('mousedown', function (e) { if (e.target.id === 'scrim') closeModal(); });
  S.modal = o;
  if (o.mount) o.mount(root);
  var first = root.querySelector('input:not([type=hidden]):not([readonly]):not([type=checkbox]),select');
  if (first && window.innerWidth > 720 && !o.noFocus) setTimeout(function () { first.focus(); }, 60);
}
function closeModal() { document.getElementById('modalRoot').innerHTML = ''; S.modal = null; }
function confirmBox(title, text, okText, danger) {
  return new Promise(function (resolve) {
    modal({ title: title, body: '<div class="muted" style="margin:4px 0 8px">' + text + '</div>',
      footer: '<button class="btn btn-ghost" data-act="cfNo">رجوع</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-act="cfYes">' + esc(okText || 'تأكيد') + '</button>' });
    S.cf = resolve;
  });
}
function footer(saveAct, saveText, icon) {
  return '<button class="btn btn-ghost" data-act="closeModal">إلغاء</button><button class="btn btn-primary" data-lockable data-act="' + saveAct + '">' + ic(icon || 'save', 'sm') + esc(saveText || 'حفظ') + '</button>';
}

/* ======================= navigation ======================= */
var VIEWS = {}, AFTER = {}, ACT = {}, LIVE = {}, CHANGE = {};
var PARENT = { order: 'orders', orderEdit: 'orders', itemEdit: 'orders', doc: 'orders', receipt: 'orders', cutlist: 'orders',
  product: 'products', productEdit: 'products', material: 'materials', customer: 'customers', supplier: 'suppliers', more: 'more' };
function go(view, param) { S.view = view; S.param = param === undefined ? null : param; closeModal(); render(); window.scrollTo(0, 0); }
function topLevel() {
  var v = S.view;
  if (v === 'itemEdit' && S.idraft && S.idraft.mode === 'product') return 'products';
  return PARENT[v] || v;
}
function renderNav() {
  var top = topLevel();
  var side = NAV.map(function (x) { return navBtn(x, top); }).join('') + '<div class="sep"></div>' + NAV_MORE.map(function (x) { return navBtn(x, top); }).join('');
  document.getElementById('sideNav').innerHTML = side;
  var moreOn = NAV.slice(4).concat(NAV_MORE).some(function (x) { return x.id === top; }) || top === 'more';
  document.getElementById('bottomNav').innerHTML = BOTTOM.map(function (id) {
    var x = id === 'more' ? { id: 'more', t: 'المزيد', i: 'more' } : NAV.find(function (y) { return y.id === id; });
    var on = id === 'more' ? moreOn : x.id === top;
    return '<button class="' + (on ? 'on' : '') + '" data-act="nav" data-v="' + x.id + '"><span class="pill">' + ic(x.i) + '</span>' + x.t + '</button>';
  }).join('');
}
function navBtn(x, top) { return '<button class="' + (x.id === top ? 'on' : '') + '" data-act="nav" data-v="' + x.id + '">' + ic(x.i) + '<span>' + x.t + '</span></button>'; }
function topbar(title, opts) {
  opts = opts || {};
  var h = '';
  if (opts.back) h += '<button class="iconbtn" data-act="' + (opts.backAct || 'nav') + '" data-v="' + esc(opts.back) + '"' + (opts.backP ? ' data-p="' + esc(opts.backP) + '"' : '') + ' aria-label="رجوع">' + ic('back') + '</button>';
  else h += '<img class="mark" src="logo-mark.svg" alt="">';
  h += '<h1>' + esc(title) + '</h1>';
  if (opts.right) h += opts.right;
  document.getElementById('topbar').innerHTML = h;
}
function render() {
  if (!S.data) return;
  renderNav();
  document.getElementById('verTxt').textContent = 'الإصدار ' + (S.data.version || '');
  var v = S.view, el = document.getElementById('view');
  var fn = VIEWS[v] || VIEWS.dashboard;
  el.innerHTML = fn(S.param);
  if (AFTER[v]) AFTER[v](S.param);
}
function softRender(focusId) {
  var el = document.getElementById(focusId), pos = el ? el.selectionStart : null;
  render();
  var el2 = document.getElementById(focusId); if (el2) { el2.focus(); try { el2.setSelectionRange(pos, pos); } catch (x) {} }
}

VIEWS.more = function () {
  topbar('المزيد');
  var all = NAV.slice(4).concat(NAV_MORE);
  return '<div class="more-grid">' + all.map(function (x) { return '<button data-act="nav" data-v="' + x.id + '"><span class="ic">' + ic(x.i) + '</span>' + x.t + '</button>'; }).join('') + '</div>';
};

/* ======================= small UI pieces ======================= */
function kpi(l, v, sub, icon, hero, act) { return '<div class="card kpi' + (hero ? ' hero' : '') + '"' + (act ? ' data-act="nav" data-v="' + act + '"' : '') + '><div class="lbl"><span class="ico-dot">' + ic(icon, 'sm') + '</span>' + l + '</div><div class="val">' + v + '</div><div class="sub">' + esc(sub) + '</div></div>'; }
function qa(act, icon, t, extra) { return '<button data-act="' + act + '"' + (extra || '') + '><span class="ic">' + ic(icon) + '</span>' + t + '</button>'; }
function emptyBox(icon, text, act, btn, p) { return '<div class="card empty"><div class="big">' + ic(icon) + '</div><div>' + text + '</div>' + (act ? '<button class="btn btn-soft mt" data-act="' + act + '"' + (p ? ' data-p="' + esc(p) + '"' : '') + '>' + ic('plus', 'sm') + btn + '</button>' : '') + '</div>'; }
function stat(l, v) { return '<div class="stat"><span class="l">' + l + '</span><span class="v">' + v + '</span></div>'; }
function kv(k, v, cls) { return '<div class="kv' + (cls ? ' ' + cls : '') + '"><span class="muted">' + k + '</span><span>' + v + '</span></div>'; }
function bar(l, v, tot, cls) { var w = tot > 0 ? Math.max(0, Math.min(100, n(v) / tot * 100)) : 0; return '<div class="bar"><div class="t"><span>' + esc(l) + '</span><span>' + money(v) + ' <span class="faint num">(' + fmt(w, 0) + '%)</span></span></div><div class="track"><div class="fill ' + (cls || '') + '" style="width:' + w + '%"></div></div></div>'; }
function selOpts(list, sel, placeholder) { return (placeholder ? '<option value="">' + esc(placeholder) + '</option>' : '') + list.map(function (x) { var v = typeof x === 'string' ? x : x[0], t = typeof x === 'string' ? x : x[1]; return '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join(''); }
function payOpts(sel) { return selOpts(Object.keys(PAY_AR).map(function (k) { return [k, PAY_AR[k]]; }), sel || 'cash'); }
function profitCls(v) { return n(v) < 0 ? 'neg' : n(v) > 0 ? 'pos' : ''; }
function telLink(phone) { return phone ? '<a class="num" style="font-weight:600" href="tel:' + esc(String(phone).replace(/[^0-9+]/g, '')) + '">' + esc(phone) + '</a>' : ''; }
function waLink(phone, text) { return 'https://wa.me/' + waNumber_(phone) + (text ? '?text=' + encodeURIComponent(text) : ''); }

/* photos: resized in the browser before upload */
function photoField(prefix, url, label) {
  return '<div class="field"><label>' + (label || 'صورة (اختياري)') + '</label><div class="row"><div class="hero-img" id="' + prefix + '_prev" style="width:64px;height:64px;border-radius:16px">' + (url ? '<img src="' + esc(url) + '">' : ic('image')) + '</div>' +
    '<label class="btn btn-ghost btn-sm" style="cursor:pointer">' + ic('image', 'sm') + 'اختيار صورة<input type="file" accept="image/*" id="' + prefix + '_img" class="hide"></label>' +
    '<button type="button" class="link' + (url ? '' : ' hide') + '" id="' + prefix + '_rm">حذف الصورة</button></div></div>';
}
function bindPhoto(prefix, state) {
  var inp = document.getElementById(prefix + '_img'), rm = document.getElementById(prefix + '_rm');
  if (!inp) return;
  inp.addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    resizeImage(f, 1000, function (dataUrl) {
      if (!dataUrl) { toast('الصورة دي مش مدعومة', 'err'); return; }
      state.image = { mime: 'image/jpeg', data: dataUrl.split(',')[1] }; state.removeImage = false; state.preview = dataUrl;
      document.getElementById(prefix + '_prev').innerHTML = '<img src="' + dataUrl + '">'; rm.classList.remove('hide');
    });
  });
  rm.addEventListener('click', function () { state.image = null; state.removeImage = true; state.preview = ''; document.getElementById(prefix + '_prev').innerHTML = ic('image'); rm.classList.add('hide'); });
}
function resizeImage(file, max, cb) {
  var rd = new FileReader();
  rd.onload = function () {
    var img = new Image();
    img.onload = function () {
      var w = img.width, h = img.height, s = Math.min(1, max / Math.max(w, h));
      var cv = document.createElement('canvas'); cv.width = Math.round(w * s); cv.height = Math.round(h * s);
      var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = function () { cb(null); };
    img.src = rd.result;
  };
  rd.readAsDataURL(file);
}

/** Shortage details from the server (MATERIAL_SHORT / ITEM_SHORT) as a readable table. */
function shortTable(details) {
  if (!details || !details.length) return '';
  var mm = matMap();
  if (details[0].material_id) return '<div class="tscroll"><table class="t"><thead><tr><th>الخامة</th><th class="n">المطلوب</th><th class="n">في المخزن</th><th class="n">الناقص</th></tr></thead><tbody>' + details.map(function (x) {
    var m = mm[x.material_id] || { mtype: 'count' };
    return '<tr><td>' + esc(x.name) + '</td><td class="n">' + qtyM(x.need, m) + '</td><td class="n">' + qtyM(x.stock, m) + '</td><td class="n neg">' + qtyM(x.short, m) + '</td></tr>';
  }).join('') + '</tbody></table></div>';
  return '<div class="tscroll"><table class="t"><thead><tr><th>البند</th><th class="n">المطلوب</th><th class="n">جاهز</th><th class="n">ناقص</th></tr></thead><tbody>' + details.map(function (x) {
    return '<tr><td>' + esc(x.name) + '</td><td class="n num">' + fmt(x.need, 0) + '</td><td class="n num">' + fmt(x.ready, 0) + '</td><td class="n neg num">' + fmt(x.short, 0) + '</td></tr>';
  }).join('') + '</tbody></table></div>';
}
function showShort(e, title) {
  modal({ title: title || 'الخامات مش كفاية', body: '<div class="callout bad mb">' + ic('alert', 'sm') + '<div>' + esc(e.message) + ' — محدش اتخصم منه حاجة.</div></div>' + shortTable(e.details) +
    '<div class="faint mt">سجّل شراء للناقص، أو اعمل جرد لو الرصيد في السيستم مش مظبوط.</div>',
    footer: '<button class="btn btn-ghost" data-act="closeModal">تمام</button><button class="btn btn-primary" data-act="nav" data-v="purchases">' + ic('cart', 'sm') + 'تسجيل شراء</button>' });
}

/* ======================= events ======================= */
ACT.closeModal = function () { closeModal(); };
ACT.cfYes = function () { var r = S.cf; S.cf = null; closeModal(); if (r) r(true); };
ACT.cfNo = function () { var r = S.cf; S.cf = null; closeModal(); if (r) r(false); };
ACT.nav = function (el) { var v = el.getAttribute('data-v'), p = el.getAttribute('data-p'); go(v, p); };
ACT.toggleArchived = function () { S.filters.archived = !S.filters.archived; render(); };

document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]'); if (!el) return;
  var a = ACT[el.getAttribute('data-act')]; if (!a) return;
  if (el.disabled) return;
  e.preventDefault(); a(el, e);
});
document.addEventListener('input', function (e) {
  var t = e.target, live = t.getAttribute('data-live');
  if (live && LIVE[live]) LIVE[live](t, e);
});
document.addEventListener('change', function (e) {
  var t = e.target, ch = t.getAttribute('data-change');
  if (ch && CHANGE[ch]) CHANGE[ch](t, e);
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.modal) closeModal(); });
