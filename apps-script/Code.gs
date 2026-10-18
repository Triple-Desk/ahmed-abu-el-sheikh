/**
 * Ahmed Abu El-Sheikh Woodworks (ورشة أحمد أبو الشيخ) — server (Google Apps Script), JSON API only.
 * Database: one dedicated Google Sheet created by setup() inside the Drive folder
 * "Ahmed Abu El-Sheikh Business System". The app itself is hosted on GitHub Pages.
 *
 * Only doGet, doPost, setup and dailyBackup are callable from outside; the API needs the secret key;
 * every other function ends with "_". All input is validated here. Nothing is hard-deleted except the
 * lines of a quote / product template when they are re-saved (logged).
 */

var APP = {
  FOLDER: 'Ahmed Abu El-Sheikh Business System',
  DB_NAME: 'Ahmed Abu El-Sheikh Database',
  FILE_PREFIX: 'Ahmed Abu El-Sheikh',
  TZ: 'Africa/Cairo',
  KEEP_BACKUPS: 30,
  MAX_WRITES_PER_MIN: 90,
  VERSION: '1.0.0'
};

var SCHEMA = {
  Settings:   ['key', 'value'],
  Materials:  ['id', 'name', 'mtype', 'category', 'base_unit', 'sheet_len', 'sheet_wid', 'thickness_mm', 'pack_qty', 'pack_label',
               'waste_pct', 'stock', 'avg_cost', 'min_stock', 'supplier_id', 'image_id', 'notes', 'active', 'created_at', 'updated_at'],
  Products:   ['id', 'name', 'category', 'selling_price', 'labor_json', 'image_id', 'stock', 'avg_cost', 'notes', 'active',
               'created_at', 'updated_at'],
  ProductLines: ['id', 'product_id', 'ltype', 'name', 'material_id', 'count', 'length', 'width', 'thickness', 'qty', 'unit', 'notes', 'sort'],
  Customers:  ['id', 'name', 'phone', 'address', 'notes', 'active', 'created_at', 'updated_at'],
  Orders:     ['id', 'order_no', 'order_date', 'due_date', 'customer_id', 'status', 'discount', 'extras_json', 'waste_json',
               'full_sheets', 'notes', 'items_total', 'total', 'est_material', 'est_labor', 'est_extra', 'est_cost', 'est_profit',
               'est_margin', 'est_json', 'confirmed_at', 'production_at', 'ready_at', 'delivered_at', 'cancelled_at', 'stock_out',
               'invoice_file_id', 'invoice_sig', 'created_at', 'updated_at'],
  OrderItems: ['id', 'order_id', 'product_id', 'name', 'category', 'spec', 'qty', 'unit_price', 'labor_json', 'notes', 'image_id',
               'est_unit_cost', 'est_unit_material', 'est_unit_labor', 'made_qty', 'out_item', 'out_product', 'sort', 'created_at'],
  OrderLines: ['id', 'order_id', 'item_id', 'ltype', 'name', 'material_id', 'count', 'length', 'width', 'thickness', 'qty', 'unit',
               'notes', 'sort'],
  Payments:   ['id', 'receipt_no', 'order_id', 'customer_id', 'pay_date', 'kind', 'amount', 'method', 'notes', 'status',
               'receipt_file_id', 'receipt_sig', 'created_at'],
  OrderCosts: ['id', 'order_id', 'cost_date', 'kind', 'amount', 'paid_to', 'notes', 'status', 'created_at'],
  Suppliers:  ['id', 'name', 'phone', 'supplies', 'opening_balance', 'notes', 'active', 'created_at', 'updated_at'],
  Purchases:  ['id', 'purchase_no', 'purchase_date', 'supplier_id', 'total', 'notes', 'status', 'created_at'],
  PurchaseLines: ['id', 'purchase_id', 'material_id', 'material_name', 'input_qty', 'input_unit', 'input_text', 'qty_base',
                  'total_price', 'unit_cost', 'avg_before', 'avg_after', 'stock_after'],
  SupplierPayments: ['id', 'supplier_id', 'purchase_id', 'pay_date', 'amount', 'method', 'notes', 'status', 'created_at'],
  Expenses:   ['id', 'exp_date', 'category', 'amount', 'notes', 'status', 'created_at'],
  Production: ['id', 'batch_no', 'prod_date', 'target', 'order_id', 'item_id', 'product_id', 'name', 'qty', 'materials_json',
               'material_cost', 'notes', 'status', 'created_at'],
  Movements:  ['id', 'mv_date', 'item_type', 'item_id', 'item_name', 'type', 'qty', 'unit_cost', 'value', 'stock_after',
               'order_id', 'ref_type', 'ref_id', 'notes', 'created_at'],
  Activity:   ['at', 'action', 'entity', 'entity_id', 'summary']
};

var NUMERIC_COLS = {
  sheet_len: 1, sheet_wid: 1, thickness_mm: 1, pack_qty: 1, waste_pct: 1, stock: 1, avg_cost: 1, min_stock: 1,
  selling_price: 1, count: 1, length: 1, width: 1, thickness: 1, qty: 1, sort: 1, discount: 1, items_total: 1, total: 1,
  est_material: 1, est_labor: 1, est_extra: 1, est_cost: 1, est_profit: 1, est_margin: 1, unit_price: 1, est_unit_cost: 1,
  est_unit_material: 1, est_unit_labor: 1, made_qty: 1, out_item: 1, out_product: 1, amount: 1, opening_balance: 1,
  input_qty: 1, qty_base: 1, total_price: 1, unit_cost: 1, avg_before: 1, avg_after: 1, stock_after: 1, material_cost: 1,
  value: 1
};
var BOOL_COLS = { active: 1, full_sheets: 1, stock_out: 1 };

var STATUSES = ['quote', 'confirmed', 'production', 'ready', 'delivered', 'cancelled'];
var OPEN_STATUSES = ['confirmed', 'production', 'ready'];
var PAY_METHODS = ['cash', 'vodafone', 'instapay', 'transfer'];

/* =========================== Web entry points =========================== */

function doGet() {
  return HtmlService.createHtmlOutput('<div dir="rtl" style="font-family:sans-serif;padding:40px;text-align:center;color:#5A3825">' +
    '<h2>أحمد أبو الشيخ</h2><p>افتح السيستم من الرابط الخاص بيك.</p></div>').setTitle('أحمد أبو الشيخ');
}

/** JSON API: POST text/plain body {k, action, payload, requestId}. */
function doPost(e) {
  var out;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var key = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (!key || String(req.k || '') !== key) out = { ok: false, error: 'رابط غير صالح', auth: false };
    else out = apiCall_(req);
  } catch (err) {
    out = { ok: false, error: 'طلب غير صالح' };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function apiCall_(req) {
  req = req || {};
  var action = String(req.action || '');
  try {
    if (action === 'bootstrap') return { ok: true, data: bootstrap_() };
    var handler = WRITE_ACTIONS_[action];
    if (!handler) throw new Error('عملية غير معروفة');
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) throw new Error('السيستم مشغول، جرّب تاني بعد ثواني');
    try {
      var cache = CacheService.getScriptCache();
      var rid = String(req.requestId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      if (rid && cache.get('rq:' + rid)) {
        resetCache_();
        return { ok: true, duplicate: true, result: safeJson_(cache.get('rs:' + rid), null), data: bootstrap_() };
      }
      rateLimit_(cache);
      resetCache_();
      var result = handler(req.payload || {});
      flushQueues_();
      if (rid) { cache.put('rq:' + rid, '1', 21600); try { cache.put('rs:' + rid, JSON.stringify(result || null), 21600); } catch (x) {} }
      SpreadsheetApp.flush();
      resetCache_();
      return { ok: true, result: result || null, data: bootstrap_() };
    } finally {
      _Q = {};
      lock.releaseLock();
    }
  } catch (e) {
    console.error(action, e && e.stack || e);
    resetCache_();
    return { ok: false, error: (e && e.message) || String(e), details: e && e.details || null, code: e && e.code || '' };
  }
}

var WRITE_ACTIONS_ = {
  saveSettings: function (p) { return saveSettings_(p); },
  backupNow: function () { return backupNow_(false); },
  saveMaterial: function (p) { return saveMaterial_(p); },
  setMaterialActive: function (p) { return setActive_('Materials', p); },
  adjustStock: function (p) { return adjustStock_(p); },
  saveProduct: function (p) { return saveProduct_(p); },
  setProductActive: function (p) { return setActive_('Products', p); },
  duplicateProduct: function (p) { return duplicateProduct_(p); },
  adjustProductStock: function (p) { return adjustProductStock_(p); },
  saveCustomer: function (p) { return saveCustomer_(p); },
  setCustomerActive: function (p) { return setActive_('Customers', p); },
  saveSupplier: function (p) { return saveSupplier_(p); },
  setSupplierActive: function (p) { return setActive_('Suppliers', p); },
  saveOrder: function (p) { return saveOrder_(p); },
  confirmOrder: function (p) { return confirmOrder_(p); },
  setOrderStatus: function (p) { return setOrderStatus_(p); },
  updateOrderInfo: function (p) { return updateOrderInfo_(p); },
  deliverOrder: function (p) { return deliverOrder_(p); },
  cancelOrder: function (p) { return cancelOrder_(p); },
  addPayment: function (p) { return addPayment_(p); },
  voidPayment: function (p) { return voidPayment_(p); },
  addOrderCost: function (p) { return addOrderCost_(p); },
  voidOrderCost: function (p) { return voidOrderCost_(p); },
  issueMaterials: function (p) { return issueMaterials_(p); },
  returnMaterials: function (p) { return returnMaterials_(p); },
  recordProduction: function (p) { return recordProduction_(p); },
  reverseProduction: function (p) { return reverseProduction_(p); },
  savePurchase: function (p) { return savePurchase_(p); },
  reversePurchase: function (p) { return reversePurchase_(p); },
  addSupplierPayment: function (p) { return addSupplierPayment_(p); },
  voidSupplierPayment: function (p) { return voidSupplierPayment_(p); },
  saveExpense: function (p) { return saveExpense_(p); },
  voidExpense: function (p) { return voidExpense_(p); },
  saveInvoicePdf: function (p) { return saveInvoicePdf_(p); },
  saveReceiptPdf: function (p) { return saveReceiptPdf_(p); }
};

/* =========================== Setup & backups =========================== */

/** Run once from the editor. Safe to run again: never overwrites existing data. */
function setup() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('API_KEY')) props.setProperty('API_KEY', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8));
  console.log('SYSTEM_KEY=' + props.getProperty('API_KEY'));
  var existing = props.getProperty('DB_ID');
  if (existing) {
    try {
      _DB = SpreadsheetApp.openById(existing);
      ensureSheets_(_DB); resetCache_(); migrate_(); flushQueues_(); installTrigger_();
      return 'Already set up: ' + existing;
    } catch (e) { /* the file is gone: fall through and recreate */ }
  }
  var folder = getOrCreateFolder_(DriveApp.getRootFolder(), APP.FOLDER);
  var backups = getOrCreateFolder_(folder, 'Backups');
  var photos = getOrCreateFolder_(folder, 'Photos');
  var invoices = getOrCreateFolder_(folder, 'Invoices');
  getOrCreateFolder_(folder, 'Documentation');

  var ss = SpreadsheetApp.create(APP.DB_NAME);
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  try { DriveApp.getFileById(ScriptApp.getScriptId()).moveTo(folder); } catch (e) { /* optional */ }
  ss.setSpreadsheetTimeZone(APP.TZ);
  ensureSheets_(ss);
  var first = ss.getSheetByName('Sheet1') || ss.getSheetByName('ورقة1');
  if (first && ss.getSheets().length > 1) ss.deleteSheet(first);

  props.setProperties({ DB_ID: ss.getId(), FOLDER_ID: folder.getId(), BACKUP_FOLDER_ID: backups.getId(),
                        PHOTO_FOLDER_ID: photos.getId(), INVOICE_FOLDER_ID: invoices.getId() });
  _DB = ss;
  resetCache_();
  seed_();
  flushQueues_();
  SpreadsheetApp.flush();
  installTrigger_();
  return 'Created database ' + ss.getUrl();
}

function dailyBackup() { return backupNow_(true); }

function backupNow_(isDaily) {
  var props = PropertiesService.getScriptProperties();
  var last = Number(props.getProperty('LAST_BACKUP') || 0);
  var minGap = isDaily ? 20 * 3600 * 1000 : 10 * 60 * 1000;
  if (Date.now() - last < minGap) return { skipped: true, message: 'اتاخدت نسخة احتياطية من شوية' };
  var folder = DriveApp.getFolderById(props.getProperty('BACKUP_FOLDER_ID'));
  var name = APP.FILE_PREFIX + ' Backup ' + Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd HH-mm');
  DriveApp.getFileById(props.getProperty('DB_ID')).makeCopy(name, folder);
  props.setProperty('LAST_BACKUP', String(Date.now()));
  var files = [], it = folder.getFiles();
  while (it.hasNext()) { var f = it.next(); if (f.getName().indexOf(APP.FILE_PREFIX + ' Backup ') === 0) files.push(f); }
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  files.slice(APP.KEEP_BACKUPS).forEach(function (f) { f.setTrashed(true); });
  if (!isDaily) log_('backup', 'System', '', 'نسخة احتياطية يدوية');
  return { skipped: false, message: 'اتحفظت نسخة احتياطية: ' + name };
}

function installTrigger_() {
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'dailyBackup'; });
  if (!has) ScriptApp.newTrigger('dailyBackup').timeBased().everyDays(1).atHour(3).create();
}

function getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function folderProp_(key, name) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(key);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* recreate below */ } }
  var f = getOrCreateFolder_(DriveApp.getFolderById(props.getProperty('FOLDER_ID')), name);
  props.setProperty(key, f.getId());
  return f;
}

function isTextCol_(table, c) { return table === 'Settings' || (!NUMERIC_COLS[c] && !BOOL_COLS[c]); }

function ensureSheets_(ss) {
  Object.keys(SCHEMA).forEach(function (name) {
    var cols = SCHEMA[name];
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      if (sh.getMaxColumns() < cols.length) sh.insertColumnsAfter(sh.getMaxColumns(), cols.length - sh.getMaxColumns());
      sh.getRange(1, 1, 1, cols.length).setValues([cols])
        .setFontWeight('bold').setBackground('#5A3825').setFontColor('#FFFFFF');
      sh.setFrozenRows(1);
      cols.forEach(function (c, i) {
        if (isTextCol_(name, c)) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
      });
      if (sh.getMaxColumns() > cols.length) sh.deleteColumns(cols.length + 1, sh.getMaxColumns() - cols.length);
    } else {
      var head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
      cols.forEach(function (c) {           // add missing columns at the end (forward-compatible upgrades)
        if (head.indexOf(c) === -1) {
          var next = sh.getLastColumn() + 1;
          if (next > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), 1);
          sh.getRange(1, next).setValue(c).setFontWeight('bold').setBackground('#5A3825').setFontColor('#FFFFFF');
          if (isTextCol_(name, c)) sh.getRange(2, next, sh.getMaxRows() - 1, 1).setNumberFormat('@');
          head.push(c);
        }
      });
    }
  });
}

/** One-time data fixes after upgrades (safe to run many times). */
function migrate_() {
  // Settings values are text (a phone like 01004649365 must keep its leading zero)
  var st = sheet_('Settings');
  st.getRange(2, 2, st.getMaxRows() - 1, 1).setNumberFormat('@');
  rows_('Settings').forEach(function (r) {
    var v = String(r.value);
    if (r.key === 'phone' && /^1\d{9}$/.test(v)) v = '0' + v;          // Egyptian mobile that lost its leading 0
    if (v !== r.value) update_('Settings', r.key, { value: v });
  });
  var s = defaultSettings_();
  Object.keys(s).forEach(function (k) { if (!find_('Settings', k)) insert_('Settings', [{ key: k, value: s[k] }]); });
  // The workshop name changed from "أولاد الشيخ" to "أحمد أبو الشيخ": update names still at their old default
  var old = { business_name: 'ورشة أولاد الشيخ', business_name_en: 'Awlad El-Sheikh Woodworks', app_name: 'أولاد الشيخ',
              invoice_note: 'شكرًا لثقتكم في ورشة أولاد الشيخ' };
  Object.keys(old).forEach(function (k) { var r = find_('Settings', k); if (r && r.value === old[k]) update_('Settings', k, { value: s[k] }); });
  renameDriveFiles_();
}
/** Keeps the Drive folder and database file names equal to APP.FOLDER / APP.DB_NAME. */
function renameDriveFiles_() {
  var props = PropertiesService.getScriptProperties();
  try { var f = DriveApp.getFolderById(props.getProperty('FOLDER_ID')); if (f.getName() !== APP.FOLDER) f.setName(APP.FOLDER); } catch (e) { /* optional */ }
  try { var d = DriveApp.getFileById(props.getProperty('DB_ID')); if (d.getName() !== APP.DB_NAME) d.setName(APP.DB_NAME); } catch (e) { /* optional */ }
}

/* =========================== Database layer =========================== */

var _DB = null, _T = {}, _Q = {};

function db_() {
  if (_DB) return _DB;
  var id = PropertiesService.getScriptProperties().getProperty('DB_ID');
  if (!id) throw new Error('السيستم لسه متجهزش (setup)');
  _DB = SpreadsheetApp.openById(id);
  return _DB;
}
function resetCache_() { _T = {}; }
function sheet_(name) {
  var sh = db_().getSheetByName(name);
  if (!sh) throw new Error('جدول مفقود: ' + name);
  return sh;
}
function headers_(name) {
  if (!_T['__h_' + name]) {
    var sh = sheet_(name);
    _T['__h_' + name] = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  }
  return _T['__h_' + name];
}
function norm_(v) {
  if (v instanceof Date) {
    var hasTime = v.getHours() || v.getMinutes() || v.getSeconds();
    return Utilities.formatDate(v, APP.TZ, hasTime ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd');
  }
  return v;
}
function cell_(v, col, table) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'boolean') return v;
  if (NUMERIC_COLS[col] && table !== 'Settings') return v === '' ? '' : num_(v);
  var s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;          // block spreadsheet formula injection
  return s;
}
function rows_(name) {
  if (_T[name]) return _T[name];
  var sh = sheet_(name), head = headers_(name), last = sh.getLastRow(), out = [];
  if (last >= 2) {
    var vals = sh.getRange(2, 1, last - 1, head.length).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (vals[i][0] === '' || vals[i][0] === null) continue;
      var o = { _row: i + 2 };
      for (var j = 0; j < head.length; j++) o[head[j]] = norm_(vals[i][j]);
      out.push(o);
    }
  }
  (_Q[name] || []).forEach(function (o) { out.push(o); });
  _T[name] = out;
  return out;
}
function find_(name, id) {
  var key = SCHEMA[name][0], list = rows_(name);
  for (var i = 0; i < list.length; i++) if (String(list[i][key]) === String(id)) return list[i];
  return null;
}
function must_(name, id, label) {
  var r = id ? find_(name, id) : null;
  if (!r) throw new Error((label || 'السجل') + ' مش موجود');
  return r;
}
function rowValues_(name, o) { return headers_(name).map(function (c) { return cell_(o[c], c, name); }); }
function insert_(name, objs) {
  if (!objs.length) return;
  var sh = sheet_(name), head = headers_(name);
  var data = objs.map(function (o) { return rowValues_(name, o); });
  var start = sh.getLastRow() + 1;
  var need = start + data.length - 1 - sh.getMaxRows();
  if (need > 0) sh.insertRowsAfter(sh.getMaxRows(), need + 200);
  sh.getRange(start, 1, data.length, head.length).setValues(data);
  if (_T[name]) objs.forEach(function (o, i) { o._row = start + i; _T[name].push(o); });
}
/** Append-only tables (movements, activity) are written once at the end of the request. */
function queue_(name, obj) {
  (_Q[name] = _Q[name] || []).push(obj);
  if (_T[name]) _T[name].push(obj);
}
function flushQueues_() {
  Object.keys(_Q).forEach(function (name) {
    var list = _Q[name]; delete _Q[name];
    if (!list.length) return;
    var sh = sheet_(name), head = headers_(name);
    var data = list.map(function (o) { return rowValues_(name, o); });
    var start = sh.getLastRow() + 1;
    var need = start + data.length - 1 - sh.getMaxRows();
    if (need > 0) sh.insertRowsAfter(sh.getMaxRows(), need + 200);
    sh.getRange(start, 1, data.length, head.length).setValues(data);
    list.forEach(function (o, i) { o._row = start + i; });
  });
}
function update_(name, id, patch) {
  var r = must_(name, id);
  Object.keys(patch).forEach(function (k) { r[k] = patch[k]; });
  sheet_(name).getRange(r._row, 1, 1, headers_(name).length).setValues([rowValues_(name, r)]);
  return r;
}
/** Delete every row matching pred, in contiguous blocks (fast). */
function deleteWhere_(name, pred) {
  var sh = sheet_(name);
  var rws = rows_(name).filter(pred).map(function (r) { return r._row; }).sort(function (a, b) { return b - a; });
  var i = 0;
  while (i < rws.length) {
    var end = rws[i], start = end, j = i + 1;
    while (j < rws.length && rws[j] === start - 1) { start = rws[j]; j++; }
    sh.deleteRows(start, end - start + 1);
    i = j;
  }
  delete _T[name];
  return rws.length;
}
function newId_(prefix) { return prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase(); }
function now_() { return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd HH:mm:ss'); }
function today_() { return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd'); }

function getSetting_(key, dflt) { var r = find_('Settings', key); return r ? r.value : dflt; }
function setSetting_(key, value) {
  if (find_('Settings', key)) update_('Settings', key, { value: value });
  else insert_('Settings', [{ key: key, value: value }]);
}
function settingsObj_() { var o = {}; rows_('Settings').forEach(function (s) { o[s.key] = s.value; }); return o; }
function nextNo_(key, prefix) {
  var n = num_(getSetting_(key, 1)) || 1;
  setSetting_(key, String(n + 1));
  return prefix + '-' + ('0000' + n).slice(-4);
}
function log_(action, entity, id, summary) {
  queue_('Activity', { at: now_(), action: action, entity: entity, entity_id: id, summary: String(summary).slice(0, 300) });
}
function rateLimit_(cache) {
  var key = 'rl:' + Math.floor(Date.now() / 60000);
  var n = Number(cache.get(key) || 0) + 1;
  if (n > APP.MAX_WRITES_PER_MIN) throw new Error('عمليات كتير في دقيقة واحدة، استنى شوية');
  cache.put(key, String(n), 120);
}
function safeJson_(s, dflt) { try { return s ? JSON.parse(s) : dflt; } catch (e) { return dflt; } }
function isTrue_(v) { return v === true || v === 'TRUE' || v === 'true'; }
function isActive_(r) { return !(r.active === false || r.active === 'FALSE' || r.active === 'false'); }
function byId_(table) { var m = {}; rows_(table).forEach(function (r) { m[r[SCHEMA[table][0]]] = r; }); return m; }
function err_(msg, code, details) { var e = new Error(msg); e.code = code || ''; e.details = details || null; return e; }

/* =========================== Validation =========================== */

function vStr_(v, label, max, required) {
  var s = (v === undefined || v === null) ? '' : String(v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  if (required && !s) throw new Error('من فضلك اكتب ' + label);
  if (s.length > max) throw new Error(label + ': النص أطول من المسموح (' + max + ' حرف)');
  return s;
}
function vText_(v, label, max) {   // multi-line notes
  var s = (v === undefined || v === null) ? '' : String(v).replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ').trim();
  if (s.length > max) throw new Error(label + ': النص أطول من المسموح (' + max + ' حرف)');
  return s;
}
function vNum_(v, label, opt) {
  opt = opt || {};
  if (v === '' || v === null || v === undefined) {
    if (opt.required) throw new Error('من فضلك اكتب ' + label);
    return opt.dflt !== undefined ? opt.dflt : 0;
  }
  var n = typeof v === 'number' ? v : Number(String(v).replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); }).replace(/,/g, '').trim());
  if (!isFinite(n)) throw new Error(label + ': رقم غير صحيح');
  if (opt.min !== undefined && n < opt.min) throw new Error(label + ': مينفعش يكون أقل من ' + opt.min);
  if (opt.gt !== undefined && !(n > opt.gt)) throw new Error(label + ': لازم يكون أكبر من ' + opt.gt);
  if (opt.max !== undefined && n > opt.max) throw new Error(label + ': أكبر من المسموح');
  if (opt.int && Math.floor(n) !== n) throw new Error(label + ': لازم يكون رقم صحيح');
  return n;
}
function vEnum_(v, allowed, label) {
  if (allowed.indexOf(v) === -1) throw new Error(label + ': اختيار غير صحيح');
  return v;
}
function vPhone_(v) {
  var s = vStr_(v, 'رقم التليفون', 25, false).replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); });
  if (s && !/^\+?[0-9\s\-()]{6,22}$/.test(s)) throw new Error('رقم التليفون غير صحيح');
  return s;
}
function phoneKey_(s) { return String(s || '').replace(/\D/g, '').replace(/^(20|0020|\+20)/, '0').slice(-10); }
function vDate_(v, allowEmpty) {
  if (!v) return allowEmpty ? '' : today_();
  var s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('التاريخ غير صحيح');
  return s;
}
function sameName_(list, name, exceptId) {
  var n = name.toLowerCase();
  return list.some(function (r) { return r.id !== exceptId && String(r.name).trim().toLowerCase() === n; });
}
/** Money/labor rows: [{kind|label, amount}] → only rows with amount > 0 */
function vAmounts_(arr, label, max) {
  if (!Array.isArray(arr)) return [];
  if (arr.length > (max || 15)) throw new Error(label + ': بنود كتير');
  return arr.map(function (x) {
    return { kind: vStr_(x.kind || x.label, 'البند', 40, false) || 'أخرى', amount: vNum_(x.amount, label, { min: 0, max: 1e8 }) };
  }).filter(function (x) { return x.amount > 0; });
}
/** Pieces & accessories of a product / order item (per ONE unit). */
function vLines_(arr, where) {
  if (!Array.isArray(arr)) return [];
  if (arr.length > 150) throw new Error(where + ': عدد القطع كبير جدًا');
  var mats = byId_('Materials');
  return arr.map(function (l, i) {
    var lab = where + ' — سطر ' + (i + 1);
    var ltype = vEnum_(l.ltype, ['piece', 'item'], lab);
    var m = l.material_id ? mats[l.material_id] : null;
    if (!m) throw new Error(lab + ': اختار الخامة');
    var rec = { ltype: ltype, name: vStr_(l.name, 'اسم القطعة', 60, false), material_id: m.id, count: '', length: '', width: '',
                thickness: '', qty: '', unit: '', notes: vStr_(l.notes, 'ملاحظة القطعة', 120, false), sort: i + 1 };
    if (ltype === 'piece') {
      rec.count = vNum_(l.count, 'العدد في ' + lab, { gt: 0, max: 100000, int: true, required: true });
      rec.length = vNum_(l.length, 'الطول في ' + lab, { min: 0, max: 100000 });
      rec.width = vNum_(l.width, 'العرض في ' + lab, { min: 0, max: 100000 });
      rec.thickness = vNum_(l.thickness, 'السُمك في ' + lab, { min: 0, max: 10000 });
    } else {
      rec.qty = vNum_(l.qty, 'الكمية في ' + lab, { gt: 0, max: 1e8, required: true });
      rec.unit = String(l.unit || unitsFor_(m)[0]);
    }
    var chk = lineNet_(rec, m);
    if (chk.error) throw new Error(lab + ' (' + m.name + '): ' + chk.error);
    return rec;
  });
}

/* =========================== Settings =========================== */

function defaultSettings_() {
  return {
    business_name: 'ورشة أحمد أبو الشيخ', business_name_en: 'Ahmed Abu El-Sheikh Woodworks', app_name: 'أحمد أبو الشيخ',
    phone: '01004649365', address: '', target_margin: '30',
    waste_sheet: '10', waste_solid: '20', waste_linear: '5', waste_count: '0', waste_liquid: '5',
    order_prefix: 'AS', next_order_no: '1', next_receipt_no: '1', next_purchase_no: '1', next_batch_no: '1',
    currency: 'ج.م',
    invoice_note: 'شكرًا لثقتكم في ورشة أحمد أبو الشيخ',
    quote_note: 'عرض السعر ساري لمدة 7 أيام من تاريخه. المقاسات والخامات حسب المتفق عليه.',
    categories: JSON.stringify(['غرف نوم', 'مطابخ', 'ركن', 'انتريهات', 'أبواب', 'شبابيك', 'مناور', 'حلوق']),
    cost_kinds: JSON.stringify(['مصنعية', 'تنجيد', 'دهان', 'تركيب', 'نقل', 'زجاج ومرايات', 'أخرى']),
    expense_kinds: JSON.stringify(['إيجار', 'كهرباء ومياه', 'عدد وأدوات', 'صيانة', 'نقل ومواصلات', 'أجور عمال', 'أخرى'])
  };
}

function vList_(arr, label, maxItems, maxLen) {
  if (!Array.isArray(arr)) throw new Error(label + ': قائمة غير صحيحة');
  var out = [];
  arr.forEach(function (x) { var s = vStr_(x, label, maxLen, false); if (s && out.indexOf(s) === -1) out.push(s); });
  if (out.length > maxItems) throw new Error(label + ': عناصر كتير');
  if (!out.length) throw new Error(label + ': لازم عنصر واحد على الأقل');
  return out;
}

function saveSettings_(p) {
  if (p.business_name !== undefined) setSetting_('business_name', vStr_(p.business_name, 'اسم الورشة', 60, true));
  if (p.business_name_en !== undefined) setSetting_('business_name_en', vStr_(p.business_name_en, 'الاسم بالإنجليزي', 60, false));
  if (p.app_name !== undefined) setSetting_('app_name', vStr_(p.app_name, 'اسم السيستم', 40, true));
  if (p.phone !== undefined) setSetting_('phone', vPhone_(p.phone));
  if (p.address !== undefined) setSetting_('address', vStr_(p.address, 'العنوان', 150, false));
  if (p.target_margin !== undefined) setSetting_('target_margin', String(vNum_(p.target_margin, 'هامش الربح المستهدف', { min: 0, max: 95 })));
  ['sheet', 'solid', 'linear', 'count', 'liquid'].forEach(function (t) {
    if (p['waste_' + t] !== undefined) setSetting_('waste_' + t, String(vNum_(p['waste_' + t], 'نسبة الهالك', { min: 0, max: 200 })));
  });
  if (p.invoice_note !== undefined) setSetting_('invoice_note', vStr_(p.invoice_note, 'ملاحظة الفاتورة', 200, false));
  if (p.quote_note !== undefined) setSetting_('quote_note', vStr_(p.quote_note, 'شروط عرض السعر', 300, false));
  if (p.categories !== undefined) setSetting_('categories', JSON.stringify(vList_(p.categories, 'الأنواع', 40, 30)));
  if (p.cost_kinds !== undefined) setSetting_('cost_kinds', JSON.stringify(vList_(p.cost_kinds, 'بنود المصنعية', 30, 30)));
  if (p.expense_kinds !== undefined) setSetting_('expense_kinds', JSON.stringify(vList_(p.expense_kinds, 'بنود المصاريف', 30, 30)));
  log_('update', 'Settings', '', 'الإعدادات');
  return {};
}

/* =========================== Materials & stock =========================== */

function movement_(o) {
  var qty = r6_(o.qty), uc = num_(o.unit_cost || 0);
  queue_('Movements', {
    id: newId_('MV'), mv_date: o.date || today_(), item_type: o.item_type || 'material', item_id: o.item_id,
    item_name: o.item_name, type: o.type, qty: qty, unit_cost: uc, value: o.value !== undefined ? r2_(o.value) : r2_(qty * uc),
    stock_after: r6_(o.stock_after), order_id: o.order_id || '', ref_type: o.ref_type || '', ref_id: o.ref_id || '',
    notes: String(o.notes || '').slice(0, 200), created_at: now_()
  });
}

function saveMaterial_(p) {
  var isNew = !p.id;
  var cur = isNew ? null : must_('Materials', p.id, 'الخامة');
  var name = vStr_(p.name, 'اسم الخامة', 80, true);
  if (sameName_(rows_('Materials'), name, cur && cur.id)) throw new Error('فيه خامة بنفس الاسم بالفعل');
  var mtype = isNew ? vEnum_(p.mtype, Object.keys(MTYPES), 'نوع الخامة') : cur.mtype;
  if (!isNew && p.mtype && p.mtype !== cur.mtype) throw new Error('نوع الخامة مبيتغيرش بعد إنشائها');
  var rec = {
    name: name,
    category: vStr_(p.category, 'التصنيف', 40, false),
    notes: vStr_(p.notes, 'الملاحظات', 300, false),
    supplier_id: p.supplier_id ? must_('Suppliers', p.supplier_id, 'المورد').id : '',
    updated_at: now_()
  };
  rec.base_unit = mtype === 'liquid' ? (isNew ? vEnum_(p.base_unit || 'ml', ['ml', 'g'], 'وحدة القياس') : cur.base_unit) : MTYPES[mtype].base;
  if (mtype === 'sheet') {
    rec.sheet_len = vNum_(p.sheet_len, 'طول اللوح', { gt: 0, max: 2000, dflt: 244 });
    rec.sheet_wid = vNum_(p.sheet_wid, 'عرض اللوح', { gt: 0, max: 2000, dflt: 122 });
    rec.thickness_mm = vNum_(p.thickness_mm, 'السُمك', { min: 0, max: 500 });
  } else { rec.sheet_len = ''; rec.sheet_wid = ''; rec.thickness_mm = mtype === 'solid' ? vNum_(p.thickness_mm, 'السُمك', { min: 0, max: 1000 }) : ''; }
  if (mtype === 'linear' || mtype === 'count' || mtype === 'liquid') {
    var pq = vNum_(p.pack_qty, 'محتوى العبوة', { min: 0, max: 1e8 });
    // pack size is entered in the "display" unit (meters / pieces / liters / kg) and stored in base units
    rec.pack_qty = pq > 0 ? r6_(pq * (mtype === 'linear' ? 100 : mtype === 'count' ? 1 : 1000)) : '';
    rec.pack_label = vStr_(p.pack_label, 'اسم العبوة', 20, false);
  } else { rec.pack_qty = ''; rec.pack_label = ''; }
  rec.waste_pct = p.waste_pct === '' || p.waste_pct === null || p.waste_pct === undefined ? '' : vNum_(p.waste_pct, 'نسبة الهالك', { min: 0, max: 200 });
  var probe = { mtype: mtype, base_unit: rec.base_unit, sheet_len: rec.sheet_len, sheet_wid: rec.sheet_wid, pack_qty: rec.pack_qty, name: name };
  rec.min_stock = 0;
  if (p.min_stock && p.min_stock.qty !== '' && p.min_stock.qty !== undefined && p.min_stock.qty !== null) {
    rec.min_stock = toBase_(vNum_(p.min_stock.qty, 'حد التنبيه', { min: 0, max: 1e9 }), p.min_stock.unit || displayUnit_(probe), probe);
  }
  var newAvg = null;
  if (p.price && p.price.amount !== '' && p.price.amount !== undefined && p.price.amount !== null) {
    var amount = vNum_(p.price.amount, 'السعر', { min: 0, max: 1e9 });
    var pqty = vNum_(p.price.qty, 'كمية السعر', { gt: 0, max: 1e9, dflt: 1 });
    newAvg = pricePerBase_(amount, pqty || 1, p.price.unit || displayUnit_(probe), probe);
  }
  if (p.image && p.image.data) rec.image_id = saveImage_(p.image, 'MAT ' + name);
  if (p.removeImage) rec.image_id = '';
  if (isNew) {
    rec.id = newId_('MAT'); rec.mtype = mtype; rec.active = true; rec.created_at = now_();
    rec.avg_cost = newAvg === null ? 0 : newAvg;
    var open = p.opening && num_(p.opening.qty) > 0
      ? toBase_(vNum_(p.opening.qty, 'الرصيد الافتتاحي', { min: 0, max: 1e9 }), p.opening.unit || displayUnit_(probe), probe) : 0;
    rec.stock = open;
    insert_('Materials', [rec]);
    if (open > 0) movement_({ item_id: rec.id, item_name: name, type: 'OPENING', qty: open, unit_cost: rec.avg_cost,
                               stock_after: open, ref_type: 'material', ref_id: rec.id, notes: 'رصيد افتتاحي' });
    log_('create', 'Material', rec.id, name);
    return { id: rec.id };
  }
  if (newAvg !== null && Math.abs(newAvg - num_(cur.avg_cost)) > 1e-12) {
    rec.avg_cost = newAvg;
    var dp = displayPrice_(newAvg, probe), dp0 = displayPrice_(cur.avg_cost, probe);
    movement_({ item_id: cur.id, item_name: name, type: 'PRICE', qty: 0, unit_cost: newAvg, stock_after: cur.stock,
                ref_type: 'material', ref_id: cur.id, notes: 'تعديل السعر من ' + dp0.v + ' إلى ' + dp.v + ' لكل ' + dp.u });
  }
  update_('Materials', cur.id, rec);
  log_('update', 'Material', cur.id, name);
  return { id: cur.id };
}

function setActive_(table, p) {
  var r = must_(table, p.id);
  var active = p.active === true || p.active === 'true';
  update_(table, r.id, { active: active, updated_at: now_() });
  log_(active ? 'restore' : 'archive', table, r.id, r.name);
  return { id: r.id };
}

function adjustStock_(p) {
  var m = must_('Materials', p.material_id, 'الخامة');
  var mode = vEnum_(p.mode, ['count', 'waste', 'add'], 'نوع الحركة');
  var q = toBase_(vNum_(p.qty, 'الكمية', { min: 0, max: 1e9, required: true }), p.unit || displayUnit_(m), m);
  var stock = num_(m.stock), delta, type, note = vStr_(p.notes, 'السبب', 200, false);
  if (mode === 'count') { delta = q - stock; type = 'COUNT'; }
  else if (mode === 'waste') {
    if (!(q > 0)) throw new Error('اكتب كمية الهالك');
    if (q > stock + 1e-6) throw new Error('كمية الهالك أكبر من الرصيد الحالي');
    delta = -q; type = 'WASTE';
  } else { if (!(q > 0)) throw new Error('اكتب الكمية'); delta = q; type = 'ADD'; }
  if (Math.abs(delta) < 1e-9) return { id: m.id, unchanged: true };
  var after = r6_(stock + delta);
  update_('Materials', m.id, { stock: after, updated_at: now_() });
  movement_({ date: vDate_(p.date), item_id: m.id, item_name: m.name, type: type, qty: delta, unit_cost: m.avg_cost,
              stock_after: after, ref_type: 'adjust', notes: note });
  log_('stock', 'Material', m.id, type + ' ' + delta);
  return { id: m.id };
}

/** Take materials out of stock (all-or-nothing): lines [{material_id, qty (base)}]. Throws MATERIAL_SHORT with details. */
function checkStock_(need) {
  var mats = byId_('Materials'), acc = {}, order = [];
  need.forEach(function (n) {
    if (!(num_(n.qty) > 0)) return;
    if (!acc[n.material_id]) { acc[n.material_id] = 0; order.push(n.material_id); }
    acc[n.material_id] += num_(n.qty);
  });
  var short = [];
  order.forEach(function (id) {
    var m = mats[id];
    if (!m) throw new Error('خامة مش موجودة');
    var have = num_(m.stock);
    if (acc[id] > have + 1e-6) short.push({ material_id: id, name: m.name, need: r6_(acc[id]), stock: r6_(have), short: r6_(acc[id] - have) });
  });
  if (short.length) throw err_('الخامات اللي في المخزن مش كفاية', 'MATERIAL_SHORT', short);
}

/** lines from the browser [{material_id, qty, unit}] → [{material_id, qty base}] (merged per material) */
function vIssueLines_(arr, label) {
  if (!Array.isArray(arr) || !arr.length) throw new Error('اختار خامة واحدة على الأقل');
  if (arr.length > 80) throw new Error('بنود كتير');
  var out = [], idx = {};
  arr.forEach(function (l, i) {
    var m = must_('Materials', l.material_id, 'الخامة في السطر ' + (i + 1));
    var q = vNum_(l.qty, (label || 'الكمية') + ' (' + m.name + ')', { min: 0, max: 1e10 });
    if (!(q > 0)) return;
    var qb = toBase_(q, l.unit || baseOf_(m), m);
    if (!(qb > 0)) return;
    if (idx[m.id] === undefined) { idx[m.id] = out.length; out.push({ material_id: m.id, qty: 0 }); }
    out[idx[m.id]].qty = r6_(out[idx[m.id]].qty + qb);
  });
  if (!out.length) throw new Error('اكتب كمية أكبر من صفر');
  return out;
}

/* =========================== Products (catalog) =========================== */

function saveProduct_(p) {
  var isNew = !p.id;
  var cur = isNew ? null : must_('Products', p.id, 'المنتج');
  var name = vStr_(p.name, 'اسم المنتج', 80, true);
  if (sameName_(rows_('Products'), name, cur && cur.id)) throw new Error('فيه منتج بنفس الاسم بالفعل');
  var lines = p.lines === undefined && cur ? null : vLines_(p.lines || [], name);
  var rec = {
    name: name,
    category: vStr_(p.category, 'النوع', 40, false),
    selling_price: vNum_(p.selling_price, 'سعر البيع', { min: 0, max: 1e9 }),
    labor_json: JSON.stringify(vAmounts_(p.labor, 'المصنعية والشغل', 15)),
    notes: vText_(p.notes, 'الملاحظات', 500),
    updated_at: now_()
  };
  if (p.image && p.image.data) rec.image_id = saveImage_(p.image, name);
  if (p.removeImage) rec.image_id = '';
  var id;
  if (isNew) {
    id = rec.id = newId_('PRD'); rec.stock = 0; rec.avg_cost = 0; rec.active = true; rec.created_at = now_();
    insert_('Products', [rec]);
  } else {
    id = cur.id;
    update_('Products', id, rec);
  }
  if (lines) {
    if (!isNew) deleteWhere_('ProductLines', function (l) { return l.product_id === id; });
    insert_('ProductLines', lines.map(function (l) { l.id = newId_('PL'); l.product_id = id; return l; }));
  }
  log_(isNew ? 'create' : 'update', 'Product', id, name + ' سعر ' + rec.selling_price);
  return { id: id };
}

function duplicateProduct_(p) {
  var src = must_('Products', p.id, 'المنتج');
  var name = vStr_(p.name, 'اسم المنتج الجديد', 80, true);
  if (sameName_(rows_('Products'), name, null)) throw new Error('فيه منتج بنفس الاسم بالفعل');
  var id = newId_('PRD'), t = now_();
  insert_('Products', [{ id: id, name: name, category: src.category, selling_price: src.selling_price, labor_json: src.labor_json,
    image_id: '', stock: 0, avg_cost: 0, notes: src.notes, active: true, created_at: t, updated_at: t }]);
  insert_('ProductLines', rows_('ProductLines').filter(function (l) { return l.product_id === src.id; }).map(function (l) {
    var c = {}; SCHEMA.ProductLines.forEach(function (k) { c[k] = l[k]; }); c.id = newId_('PL'); c.product_id = id; return c;
  }));
  log_('duplicate', 'Product', id, src.name + ' → ' + name);
  return { id: id };
}

/** Products store count / damage: target product (catalog stock) or an order item's ready pieces. */
function adjustProductStock_(p) {
  var mode = vEnum_(p.mode, ['count', 'waste'], 'نوع الحركة');
  var q = vNum_(p.qty, 'عدد القطع', { min: 0, max: 1e6, int: true, required: true });
  var note = vStr_(p.notes, 'السبب', 200, false);
  if (p.item_id) {
    var it = must_('OrderItems', p.item_id, 'القطعة');
    var avail = num_(it.made_qty) - num_(it.out_item);
    var newAvail = mode === 'count' ? q : avail - q;
    if (mode === 'waste' && q > avail) throw new Error('العدد أكبر من الموجود');
    if (newAvail < 0) throw new Error('العدد غير صحيح');
    var d = newAvail - avail;
    if (!d) return { id: it.id, unchanged: true };
    update_('OrderItems', it.id, { made_qty: num_(it.made_qty) + d });
    movement_({ item_type: 'item', item_id: it.id, item_name: it.name, type: mode === 'count' ? 'COUNT' : 'WASTE', qty: d,
                unit_cost: 0, stock_after: newAvail, order_id: it.order_id, ref_type: 'adjust', notes: note });
    log_('stock', 'OrderItem', it.id, mode + ' ' + d);
    return { id: it.id };
  }
  var pr = must_('Products', p.product_id, 'المنتج');
  var stock = num_(pr.stock), after = mode === 'count' ? q : stock - q;
  if (mode === 'waste' && q > stock) throw new Error('العدد أكبر من الرصيد');
  if (after === stock) return { id: pr.id, unchanged: true };
  update_('Products', pr.id, { stock: after, updated_at: now_() });
  movement_({ item_type: 'product', item_id: pr.id, item_name: pr.name, type: mode === 'count' ? 'COUNT' : 'WASTE',
              qty: after - stock, unit_cost: pr.avg_cost, stock_after: after, ref_type: 'adjust', notes: note });
  log_('stock', 'Product', pr.id, mode + ' ' + (after - stock));
  return { id: pr.id };
}

function saveImage_(img, name) {
  var mime = vEnum_(String(img.mime || ''), ['image/jpeg', 'image/png', 'image/webp'], 'الصورة');
  var data = String(img.data);
  if (data.length > 1600000) throw new Error('الصورة كبيرة جدًا');
  var bytes = Utilities.base64Decode(data);
  var f = folderProp_('PHOTO_FOLDER_ID', 'Photos').createFile(Utilities.newBlob(bytes, mime, String(name).slice(0, 40) + ' ' + Date.now()));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return f.getId();
}
function imageUrl_(id) { return id ? 'https://lh3.googleusercontent.com/d/' + encodeURIComponent(id) + '=w800' : ''; }

/* =========================== Customers & suppliers =========================== */

function saveCustomer_(p) {
  var isNew = !p.id, cur = isNew ? null : must_('Customers', p.id, 'العميل');
  var rec = { name: vStr_(p.name, 'اسم العميل', 60, true), phone: vPhone_(p.phone), address: vStr_(p.address, 'العنوان', 150, false),
              notes: vStr_(p.notes, 'الملاحظات', 300, false), updated_at: now_() };
  if (rec.phone) {
    var k = phoneKey_(rec.phone);
    var dup = rows_('Customers').filter(function (c) { return (!cur || c.id !== cur.id) && phoneKey_(c.phone) === k; })[0];
    if (dup) throw new Error('الرقم ده متسجل للعميل "' + dup.name + '"');
  }
  if (isNew) { rec.id = newId_('CUS'); rec.active = true; rec.created_at = now_(); insert_('Customers', [rec]); log_('create', 'Customer', rec.id, rec.name); return { id: rec.id }; }
  update_('Customers', cur.id, rec);
  markInvoicesStale_(function (o) { return o.customer_id === cur.id; });
  log_('update', 'Customer', cur.id, rec.name);
  return { id: cur.id };
}

/** Order's customer: an existing id, or {name, phone, address} (matched by phone, else created). */
function resolveCustomer_(c) {
  if (!c) return '';
  if (c.id) return must_('Customers', c.id, 'العميل').id;
  var name = vStr_(c.name, 'اسم العميل', 60, false), phone = vPhone_(c.phone), address = vStr_(c.address, 'العنوان', 150, false);
  if (!name && !phone) return '';
  if (phone) {
    var k = phoneKey_(phone);
    var ex = rows_('Customers').filter(function (x) { return phoneKey_(x.phone) === k; })[0];
    if (ex) {
      if (address && !ex.address) update_('Customers', ex.id, { address: address, updated_at: now_() });
      return ex.id;
    }
  }
  if (!name) throw new Error('اكتب اسم العميل');
  var id = newId_('CUS');
  insert_('Customers', [{ id: id, name: name, phone: phone, address: address, notes: '', active: true, created_at: now_(), updated_at: now_() }]);
  log_('create', 'Customer', id, name);
  return id;
}

function saveSupplier_(p) {
  var isNew = !p.id, cur = isNew ? null : must_('Suppliers', p.id, 'المورد');
  var rec = { name: vStr_(p.name, 'اسم المورد', 60, true), phone: vPhone_(p.phone), supplies: vStr_(p.supplies, 'بيورّد إيه', 120, false),
              opening_balance: vNum_(p.opening_balance, 'الرصيد السابق', { min: -1e9, max: 1e9 }), notes: vStr_(p.notes, 'الملاحظات', 300, false),
              updated_at: now_() };
  if (sameName_(rows_('Suppliers'), rec.name, cur && cur.id)) throw new Error('فيه مورد بنفس الاسم بالفعل');
  if (isNew) { rec.id = newId_('SUP'); rec.active = true; rec.created_at = now_(); insert_('Suppliers', [rec]); log_('create', 'Supplier', rec.id, rec.name); return { id: rec.id }; }
  update_('Suppliers', cur.id, rec);
  log_('update', 'Supplier', cur.id, rec.name);
  return { id: cur.id };
}
function resolveSupplier_(p) {
  if (p.supplier_id) return must_('Suppliers', p.supplier_id, 'المورد').id;
  var name = vStr_(p.supplier_name, 'اسم المورد', 60, false);
  if (!name) return '';
  var ex = rows_('Suppliers').filter(function (s) { return String(s.name).trim().toLowerCase() === name.toLowerCase(); })[0];
  if (ex) return ex.id;
  var id = newId_('SUP');
  insert_('Suppliers', [{ id: id, name: name, phone: vPhone_(p.supplier_phone), supplies: '', opening_balance: 0, notes: '', active: true,
                          created_at: now_(), updated_at: now_() }]);
  log_('create', 'Supplier', id, name);
  return id;
}

/* =========================== Orders =========================== */

function orderItems_(orderId) { return rows_('OrderItems').filter(function (i) { return i.order_id === orderId; }).sort(function (a, b) { return num_(a.sort) - num_(b.sort); }); }
function orderLines_(orderId) { return rows_('OrderLines').filter(function (l) { return l.order_id === orderId; }); }
function linesByItem_(orderId) {
  var m = {};
  orderLines_(orderId).sort(function (a, b) { return num_(a.sort) - num_(b.sort); }).forEach(function (l) { (m[l.item_id] = m[l.item_id] || []).push(l); });
  return m;
}
function itemsForCost_(orderId) {
  return orderItems_(orderId).map(function (it) { return { id: it.id, name: it.name, qty: it.qty, unit_price: it.unit_price, labor: safeJson_(it.labor_json, []) }; });
}
function orderView_(o) { return { discount: o.discount, extras: safeJson_(o.extras_json, []), waste: safeJson_(o.waste_json, {}), full_sheets: isTrue_(o.full_sheets) }; }
function liveEstimate_(o) {
  return orderEstimate_(orderView_(o), itemsForCost_(o.id), linesByItem_(o.id), byId_('Materials'), settingsObj_());
}
function markInvoicesStale_(pred) {
  rows_('Orders').forEach(function (o) { if (o.invoice_sig && pred(o)) update_('Orders', o.id, { invoice_sig: '' }); });
}

/**
 * Create / edit a quotation (عرض سعر). Items are custom: catalog pieces are COPIED into the order and can be
 * edited for this customer without touching the catalog. Only quotes can be edited.
 */
function saveOrder_(p) {
  var isNew = !p.id, order = null;
  if (!isNew) {
    order = must_('Orders', p.id, 'الطلب');
    if (order.status !== 'quote') throw new Error('الطلب المؤكد مبيتعدلش. رجّعه لعرض سعر الأول (لو لسه متصنعش).');
  }
  var items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) throw new Error('ضيف قطعة واحدة على الأقل للطلب');
  if (items.length > 60) throw new Error('عدد البنود في الطلب كبير جدًا');
  var parsed = items.map(function (it, i) {
    var lab = 'البند ' + (i + 1);
    var prod = it.product_id ? find_('Products', it.product_id) : null;
    var name = vStr_(it.name, 'اسم ' + lab, 80, true);
    return {
      product_id: prod ? prod.id : '', name: name, category: vStr_(it.category, 'النوع', 40, false), spec: vStr_(it.spec, 'المواصفات', 200, false),
      qty: vNum_(it.qty, 'الكمية في ' + lab, { gt: 0, max: 10000, int: true, required: true }),
      unit_price: vNum_(it.unit_price, 'السعر في ' + lab, { min: 0, max: 1e9 }),
      labor: vAmounts_(it.labor, 'المصنعية في ' + lab, 15), notes: vStr_(it.notes, 'ملاحظات ' + lab, 300, false),
      image: it.image, image_id: it.removeImage ? '' : vStr_(it.image_id, 'الصورة', 80, false),
      lines: vLines_(it.lines || [], name)
    };
  });
  var waste = {};
  if (p.waste && typeof p.waste === 'object') Object.keys(p.waste).forEach(function (k) {
    if (p.waste[k] === '' || p.waste[k] === null || p.waste[k] === undefined) return;
    must_('Materials', k, 'خامة الهالك'); waste[k] = vNum_(p.waste[k], 'نسبة الهالك', { min: 0, max: 200 });
  });
  var extras = vAmounts_(p.extras, 'مصاريف الطلب', 15);
  var customerId = resolveCustomer_(p.customer);
  var rec = {
    order_date: vDate_(p.order_date), due_date: vDate_(p.due_date, true), customer_id: customerId,
    discount: vNum_(p.discount, 'الخصم', { min: 0, max: 1e9 }), extras_json: JSON.stringify(extras),
    waste_json: JSON.stringify(waste), full_sheets: p.full_sheets === true, notes: vText_(p.notes, 'الملاحظات', 500),
    invoice_sig: '', updated_at: now_()
  };
  var id = isNew ? newId_('ORD') : order.id;
  parsed.forEach(function (it) { if (it.image && it.image.data) it.image_id = saveImage_(it.image, 'ORDER ' + it.name); });
  if (!isNew) {
    deleteWhere_('OrderLines', function (l) { return l.order_id === id; });
    deleteWhere_('OrderItems', function (l) { return l.order_id === id; });
  }
  var t = now_(), itemRows = [], lineRows = [];
  parsed.forEach(function (it, i) {
    var iid = newId_('OI');
    itemRows.push({ id: iid, order_id: id, product_id: it.product_id, name: it.name, category: it.category, spec: it.spec, qty: it.qty,
      unit_price: it.unit_price, labor_json: JSON.stringify(it.labor), notes: it.notes, image_id: it.image_id, est_unit_cost: '',
      est_unit_material: '', est_unit_labor: '', made_qty: 0, out_item: 0, out_product: 0, sort: i + 1, created_at: t });
    it.lines.forEach(function (l) { l.id = newId_('OL'); l.order_id = id; l.item_id = iid; lineRows.push(l); });
  });
  var est = orderEstimate_({ discount: rec.discount, extras: extras, waste: waste, full_sheets: rec.full_sheets },
    itemRows.map(function (it) { return { id: it.id, qty: it.qty, unit_price: it.unit_price, labor: safeJson_(it.labor_json, []) }; }),
    (function () { var m = {}; lineRows.forEach(function (l) { (m[l.item_id] = m[l.item_id] || []).push(l); }); return m; })(),
    byId_('Materials'), settingsObj_());
  if (est.total < 0) throw new Error('الخصم أكبر من قيمة الطلب');
  rec.items_total = est.items_total; rec.total = est.total;
  if (isNew) {
    rec.id = id; rec.order_no = nextNo_('next_order_no', getSetting_('order_prefix', 'AS') || 'AS'); rec.status = 'quote';
    rec.stock_out = false; rec.created_at = now_();
    insert_('Orders', [rec]);
  } else update_('Orders', id, rec);
  insert_('OrderItems', itemRows);
  insert_('OrderLines', lineRows);
  log_(isNew ? 'create' : 'update', 'Order', id, (rec.order_no || order.order_no) + ' ' + est.total);
  var out = { id: id };
  if (p.confirm) {
    try { confirmOrder_({ id: id, deposit: p.deposit }); }
    catch (e) { out.confirmError = e.message; }
  }
  return out;
}

/** Customer, due date and notes can be corrected at any time (no effect on money or stock). */
function updateOrderInfo_(p) {
  var o = must_('Orders', p.id, 'الطلب');
  var patch = { updated_at: now_() };
  if (p.customer !== undefined) { patch.customer_id = resolveCustomer_(p.customer); patch.invoice_sig = ''; }
  if (p.due_date !== undefined) patch.due_date = vDate_(p.due_date, true);
  if (p.notes !== undefined) patch.notes = vText_(p.notes, 'الملاحظات', 500);
  update_('Orders', o.id, patch);
  log_('update', 'Order', o.id, o.order_no + ' بيانات');
  return { id: o.id };
}

/**
 * Confirm: the quote becomes an order. Prices & the estimated cost are FROZEN (snapshot), so later
 * material price changes never alter it. Optional deposit (عربون). Materials are NOT taken from stock here.
 */
function confirmOrder_(p) {
  var o = must_('Orders', p.id, 'الطلب');
  if (o.status !== 'quote') throw new Error('الطلب ده متأكد قبل كده');
  var items = orderItems_(o.id);
  if (!items.length) throw new Error('الطلب فاضي');
  var dep = vDeposit_(p.deposit);                          // validate BEFORE writing anything
  var est = liveEstimate_(o);
  var prices = {}, waste = {};
  est.materials.forEach(function (m) { prices[m.material_id] = m.unit_cost; waste[m.material_id] = m.waste_pct; });
  items.forEach(function (it) {
    var e = est.items[it.id];
    update_('OrderItems', it.id, { est_unit_cost: e.unit_cost, est_unit_material: e.unit_material, est_unit_labor: e.unit_labor });
  });
  var snap = { materials: est.materials.map(function (m) {
    return { material_id: m.material_id, name: m.name, mtype: m.mtype, category: m.category, base_unit: m.base_unit, net: m.net,
             waste_pct: m.waste_pct, gross: m.gross, unit_cost: m.unit_cost, cost: m.cost, sheets: m.sheets, sheet_area: m.sheet_area };
  }), prices: prices, waste: waste, warnings: est.warnings, items: {} };
  items.forEach(function (it) { var e = est.items[it.id]; snap.items[it.id] = { material_cost: e.material_cost, labor_cost: e.labor_cost, total_cost: e.total_cost, by_cat: e.by_cat }; });
  update_('Orders', o.id, { status: 'confirmed', confirmed_at: now_(), items_total: est.items_total, total: est.total,
    est_material: est.material_cost, est_labor: est.labor_cost, est_extra: est.extra_cost, est_cost: est.total_cost,
    est_profit: est.profit, est_margin: est.margin === null ? '' : est.margin, est_json: JSON.stringify(snap), invoice_sig: '', updated_at: now_() });
  var payId = '';
  if (dep) payId = addPayment_({ order_id: o.id, amount: dep.amount, method: dep.method, date: dep.date, kind: 'deposit', notes: dep.notes }).id;
  log_('confirm', 'Order', o.id, o.order_no + ' ربح متوقع ' + est.profit);
  return { id: o.id, payment_id: payId };
}

var STATUS_FLOW_ = {
  confirmed: ['production', 'ready', 'quote'],
  production: ['ready', 'confirmed'],
  ready: ['production'],
  cancelled: ['quote']
};

/** Simple status steps (production / ready) and re-opening a confirmed order as a quote. */
function setOrderStatus_(p) {
  var o = must_('Orders', p.id, 'الطلب');
  var to = String(p.status || '');
  if ((STATUS_FLOW_[o.status] || []).indexOf(to) === -1) throw new Error('مينفعش تغيّر حالة الطلب بالشكل ده');
  var patch = { status: to, updated_at: now_(), invoice_sig: '' };
  if (to === 'quote') {
    var issued = orderIssued_(o.id).some(function (x) { return Math.abs(x.qty) > 1e-9; });
    var made = orderItems_(o.id).some(function (it) { return num_(it.made_qty) > 0; });
    if (issued || made || isTrue_(o.stock_out)) throw new Error('مينفعش يرجع عرض سعر: اتصرف عليه خامات أو اتسجل له تصنيع.');
    patch.confirmed_at = ''; patch.cancelled_at = ''; patch.est_json = ''; ['est_material', 'est_labor', 'est_extra', 'est_cost', 'est_profit', 'est_margin'].forEach(function (k) { patch[k] = ''; });
    orderItems_(o.id).forEach(function (it) { update_('OrderItems', it.id, { est_unit_cost: '', est_unit_material: '', est_unit_labor: '' }); });
  }
  if (to === 'production' && !o.production_at) patch.production_at = now_();
  if (to === 'ready') patch.ready_at = now_();
  update_('Orders', o.id, patch);
  log_('status', 'Order', o.id, o.order_no + ' → ' + to);
  return { id: o.id };
}

/** Net materials issued to an order (by material): [{material_id, qty (base, net of returns), value}] */
function orderIssued_(orderId) {
  var acc = {}, list = [];
  rows_('Movements').forEach(function (mv) {
    if (mv.order_id !== orderId || mv.item_type !== 'material') return;
    if (!acc[mv.item_id]) { acc[mv.item_id] = { material_id: mv.item_id, qty: 0, value: 0 }; list.push(acc[mv.item_id]); }
    acc[mv.item_id].qty -= num_(mv.qty);
    acc[mv.item_id].value -= num_(mv.value);
  });
  list.forEach(function (x) { x.qty = r6_(x.qty); x.value = r2_(x.value); });
  return list;
}

function snapshotOf_(o) { return safeJson_(o.est_json, null) || { waste: {}, prices: {} }; }

/** Issue materials to an order (صرف على أوردر). */
function issueMaterials_(p) {
  var o = must_('Orders', p.order_id, 'الطلب');
  if (OPEN_STATUSES.concat(['delivered']).indexOf(o.status) === -1) throw new Error('الصرف بيكون على طلب متأكد');
  var lines = vIssueLines_(p.lines, 'كمية الصرف');
  checkStock_(lines);
  var date = vDate_(p.date), note = vStr_(p.notes, 'ملاحظات', 200, false), ref = newId_('ISS');
  var mats = byId_('Materials');
  lines.forEach(function (l) {
    var m = mats[l.material_id], after = r6_(num_(m.stock) - l.qty);
    update_('Materials', m.id, { stock: after, updated_at: now_() });
    movement_({ date: date, item_id: m.id, item_name: m.name, type: 'ISSUE', qty: -l.qty, unit_cost: m.avg_cost, stock_after: after,
                order_id: o.id, ref_type: 'issue', ref_id: ref, notes: note || o.order_no });
  });
  if (o.status === 'confirmed') update_('Orders', o.id, { status: 'production', production_at: now_(), invoice_sig: '' });
  log_('issue', 'Order', o.id, o.order_no + ' صرف ' + lines.length + ' خامة');
  return { id: o.id };
}

/** Leftovers back from an order (مرتجع خامة) at the order's issue cost. */
function returnMaterials_(p) {
  var o = must_('Orders', p.order_id, 'الطلب');
  var lines = vIssueLines_(p.lines, 'كمية المرتجع');
  var issued = {}; orderIssued_(o.id).forEach(function (x) { issued[x.material_id] = x; });
  var mats = byId_('Materials');
  lines.forEach(function (l) {
    var x = issued[l.material_id];
    if (!x || l.qty > x.qty + 1e-6) throw new Error('المرتجع من "' + mats[l.material_id].name + '" أكبر من اللي اتصرف على الطلب');
  });
  var date = vDate_(p.date), note = vStr_(p.notes, 'ملاحظات', 200, false), ref = newId_('RET');
  lines.forEach(function (l) {
    var m = mats[l.material_id], x = issued[l.material_id];
    var uc = x.qty > 0 ? x.value / x.qty : num_(m.avg_cost);
    var avg = weightedAvg_(m.stock, m.avg_cost, l.qty, l.qty * uc);
    var after = r6_(num_(m.stock) + l.qty);
    update_('Materials', m.id, { stock: after, avg_cost: avg, updated_at: now_() });
    movement_({ date: date, item_id: m.id, item_name: m.name, type: 'RETURN', qty: l.qty, unit_cost: uc, stock_after: after,
                order_id: o.id, ref_type: 'return', ref_id: ref, notes: note || o.order_no });
  });
  log_('return', 'Order', o.id, o.order_no + ' مرتجع');
  return { id: o.id };
}

/* =========================== Production =========================== */

/**
 * Production entry (تسجيل تصنيع):
 *  target 'order' → materials are issued to the order and the item's ready pieces go up (made_qty);
 *  target 'stock' → materials are consumed and the catalog product's stock goes up (for ready items like doors).
 * The materials list comes pre-filled from the pieces in the browser and can be edited (actual usage).
 */
function recordProduction_(p) {
  var target = vEnum_(p.target, ['order', 'stock'], 'نوع التصنيع');
  var qty = vNum_(p.qty, 'عدد القطع', { gt: 0, max: 100000, int: true, required: true });
  var mats = Array.isArray(p.materials) && p.materials.length ? vIssueLines_(p.materials, 'كمية الخامة') : [];
  var date = vDate_(p.date), notes = vStr_(p.notes, 'الملاحظات', 200, false);
  if (target === 'order') {
    var it = must_('OrderItems', p.item_id, 'البند');
    var o = must_('Orders', it.order_id, 'الطلب');
    if (OPEN_STATUSES.indexOf(o.status) === -1) throw new Error('التصنيع بيتسجل على طلب متأكد ولسه متسلمش');
    if (num_(it.made_qty) + qty > num_(it.qty)) throw new Error('"' + it.name + '": اتصنع ' + num_(it.made_qty) + ' من ' + num_(it.qty) + ' — مينفعش تسجل أكتر من المطلوب');
    checkStock_(mats);
    return produceForItem_(o, it, qty, mats, date, notes);
  }
  var pr = must_('Products', p.product_id, 'المنتج');
  checkStock_(mats);
  var id = newId_('BAT'), no = nextNo_('next_batch_no', 'M'), mById = byId_('Materials'), value = 0, used = [];
  mats.forEach(function (l) {
    var m = mById[l.material_id], after = r6_(num_(m.stock) - l.qty);
    value += l.qty * num_(m.avg_cost);
    used.push({ id: m.id, name: m.name, qty: l.qty, unit_cost: num_(m.avg_cost) });
    update_('Materials', m.id, { stock: after, updated_at: now_() });
    movement_({ date: date, item_id: m.id, item_name: m.name, type: 'CONSUME', qty: -l.qty, unit_cost: m.avg_cost, stock_after: after,
                ref_type: 'production', ref_id: id, notes: no + ' ' + pr.name });
  });
  var pAfter = num_(pr.stock) + qty;
  var avg = weightedAvg_(Math.max(0, num_(pr.stock)), pr.avg_cost, qty, value);
  update_('Products', pr.id, { stock: pAfter, avg_cost: r4_(avg), updated_at: now_() });
  movement_({ date: date, item_type: 'product', item_id: pr.id, item_name: pr.name, type: 'PRODUCE', qty: qty, unit_cost: value / qty,
              stock_after: pAfter, ref_type: 'production', ref_id: id, notes: no });
  insert_('Production', [{ id: id, batch_no: no, prod_date: date, target: 'stock', order_id: '', item_id: '', product_id: pr.id, name: pr.name,
    qty: qty, materials_json: JSON.stringify(used), material_cost: r2_(value), notes: notes, status: 'active', created_at: now_() }]);
  log_('create', 'Production', id, no + ' ' + pr.name + ' × ' + qty);
  return { id: id };
}

function produceForItem_(o, it, qty, mats, date, notes) {
  var id = newId_('BAT'), no = nextNo_('next_batch_no', 'M'), mById = byId_('Materials'), value = 0, used = [];
  mats.forEach(function (l) {
    var m = mById[l.material_id], after = r6_(num_(m.stock) - l.qty);
    value += l.qty * num_(m.avg_cost);
    used.push({ id: m.id, name: m.name, qty: l.qty, unit_cost: num_(m.avg_cost) });
    update_('Materials', m.id, { stock: after, updated_at: now_() });
    movement_({ date: date, item_id: m.id, item_name: m.name, type: 'ISSUE', qty: -l.qty, unit_cost: m.avg_cost, stock_after: after,
                order_id: o.id, ref_type: 'production', ref_id: id, notes: no + ' ' + o.order_no });
  });
  var made = num_(it.made_qty) + qty;
  update_('OrderItems', it.id, { made_qty: made });
  movement_({ date: date, item_type: 'item', item_id: it.id, item_name: it.name, type: 'MAKE', qty: qty, unit_cost: 0, value: 0,
              stock_after: made - num_(it.out_item), order_id: o.id, ref_type: 'production', ref_id: id, notes: no + ' ' + o.order_no });
  insert_('Production', [{ id: id, batch_no: no, prod_date: date, target: 'order', order_id: o.id, item_id: it.id, product_id: it.product_id,
    name: it.name, qty: qty, materials_json: JSON.stringify(used), material_cost: r2_(value), notes: notes, status: 'active', created_at: now_() }]);
  var patch = { updated_at: now_(), invoice_sig: '' };
  var all = orderItems_(o.id).every(function (x) { return num_(x.made_qty) >= num_(x.qty); });
  if (all && (o.status === 'confirmed' || o.status === 'production')) { patch.status = 'ready'; patch.ready_at = now_(); if (!o.production_at) patch.production_at = now_(); }
  else if (o.status === 'confirmed') { patch.status = 'production'; patch.production_at = now_(); }
  update_('Orders', o.id, patch);
  log_('create', 'Production', id, no + ' ' + o.order_no + ' ' + it.name + ' × ' + qty);
  return { id: id };
}

function reverseProduction_(p) {
  var b = must_('Production', p.id, 'عملية التصنيع');
  if (b.status === 'reversed') throw new Error('العملية دي اتلغت قبل كده');
  var mats = safeJson_(b.materials_json, []);
  if (b.target === 'order') {
    var it = must_('OrderItems', b.item_id, 'البند');
    if (num_(it.made_qty) - num_(b.qty) < num_(it.out_item)) throw new Error('القطع دي اتسلمت للعميل — لازم تلغي التسليم الأول');
    var o = must_('Orders', b.order_id, 'الطلب');
    if (o.status === 'delivered') throw new Error('الطلب اتسلم بالفعل');
  } else {
    var pr = must_('Products', b.product_id, 'المنتج');
    if (num_(pr.stock) < num_(b.qty)) throw new Error('القطع دي اتباعت أو اتحركت من المخزن — مينفعش تلغي التصنيع');
  }
  var date = today_();
  mats.forEach(function (x) {
    var m = find_('Materials', x.id); if (!m) return;
    var avg = weightedAvg_(m.stock, m.avg_cost, x.qty, x.qty * x.unit_cost);
    var after = r6_(num_(m.stock) + num_(x.qty));
    update_('Materials', m.id, { stock: after, avg_cost: avg, updated_at: now_() });
    movement_({ date: date, item_id: m.id, item_name: m.name, type: b.target === 'order' ? 'ISSUE_REVERSAL' : 'CONSUME_REVERSAL', qty: x.qty,
                unit_cost: x.unit_cost, stock_after: after, order_id: b.order_id || '', ref_type: 'production', ref_id: b.id, notes: 'إلغاء ' + b.batch_no });
  });
  if (b.target === 'order') {
    var made = num_(it.made_qty) - num_(b.qty);
    update_('OrderItems', it.id, { made_qty: made });
    movement_({ date: date, item_type: 'item', item_id: it.id, item_name: it.name, type: 'MAKE_REVERSAL', qty: -num_(b.qty), unit_cost: 0, value: 0,
                stock_after: made - num_(it.out_item), order_id: b.order_id, ref_type: 'production', ref_id: b.id, notes: 'إلغاء ' + b.batch_no });
    if (o.status === 'ready') update_('Orders', o.id, { status: 'production', invoice_sig: '', updated_at: now_() });
  } else {
    var pAfter = num_(pr.stock) - num_(b.qty);
    update_('Products', pr.id, { stock: pAfter, updated_at: now_() });
    movement_({ date: date, item_type: 'product', item_id: pr.id, item_name: pr.name, type: 'PRODUCE_REVERSAL', qty: -num_(b.qty),
                unit_cost: num_(b.material_cost) / num_(b.qty), stock_after: pAfter, ref_type: 'production', ref_id: b.id, notes: 'إلغاء ' + b.batch_no });
  }
  update_('Production', b.id, { status: 'reversed' });
  log_('reverse', 'Production', b.id, b.batch_no);
  return { id: b.id };
}

/* =========================== Delivery & cancellation =========================== */

/** What each item can take from the store for delivery: [{item, need, fromItem, fromProduct, short}] */
function deliveryPlan_(o) {
  var prodUse = {};
  return orderItems_(o.id).map(function (it) {
    var need = num_(it.qty) - num_(it.out_item) - num_(it.out_product);
    var availItem = Math.max(0, num_(it.made_qty) - num_(it.out_item));
    var fromItem = Math.min(availItem, need), rest = need - fromItem, fromProduct = 0;
    if (rest > 0 && it.product_id) {
      var pr = find_('Products', it.product_id);
      if (pr) {
        var free = Math.max(0, num_(pr.stock) - (prodUse[pr.id] || 0));
        fromProduct = Math.min(free, rest);
        prodUse[pr.id] = (prodUse[pr.id] || 0) + fromProduct;
        rest -= fromProduct;
      }
    }
    return { item: it, need: need, fromItem: fromItem, fromProduct: fromProduct, short: rest };
  });
}

/**
 * Delivery (التسليم): finished pieces leave the products store now. If pieces are missing and
 * p.produce is true, the missing pieces are produced first from their pieces (materials are checked for
 * ALL of them before anything is written — nothing changes if they are short).
 */
function deliverOrder_(p) {
  var o = must_('Orders', p.id, 'الطلب');
  if (OPEN_STATUSES.indexOf(o.status) === -1) throw new Error('التسليم بيكون لطلب متأكد ولسه متسلمش');
  var plan = deliveryPlan_(o);
  var short = plan.filter(function (x) { return x.short > 0; });
  if (short.length && p.produce !== true) {
    throw err_('في قطع لسه متسجلش تصنيعها', 'ITEM_SHORT', short.map(function (x) { return { item_id: x.item.id, name: x.item.name, need: x.need, ready: x.fromItem + x.fromProduct, short: x.short }; }));
  }
  var date = vDate_(p.date);
  if (short.length) {
    var snap = snapshotOf_(o), lbi = linesByItem_(o.id), mById = byId_('Materials'), settings = settingsObj_(), all = [], per = [];
    short.forEach(function (x) {
      var need = materialsForUnits_(lbi[x.item.id] || [], x.short, mById, settings, snap.waste || {});
      per.push({ x: x, mats: need.map(function (n) { return { material_id: n.material_id, qty: n.qty }; }) });
      need.forEach(function (n) { all.push({ material_id: n.material_id, qty: n.qty }); });
    });
    checkStock_(all);
    per.forEach(function (z) {
      produceForItem_(o, z.x.item, z.x.short, z.mats, date, 'تصنيع وتسليم');
      o = must_('Orders', o.id);
    });
    plan = deliveryPlan_(o);
    if (plan.some(function (x) { return x.short > 0; })) throw new Error('حصلت مشكلة في تجهيز القطع');
  }
  plan.forEach(function (x) {
    var it = x.item;
    if (x.fromItem > 0) {
      var outI = num_(it.out_item) + x.fromItem;
      update_('OrderItems', it.id, { out_item: outI });
      movement_({ date: date, item_type: 'item', item_id: it.id, item_name: it.name, type: 'DELIVER', qty: -x.fromItem, unit_cost: 0, value: 0,
                  stock_after: num_(it.made_qty) - outI, order_id: o.id, ref_type: 'order', ref_id: o.id, notes: o.order_no });
    }
    if (x.fromProduct > 0) {
      var pr = find_('Products', it.product_id), after = num_(pr.stock) - x.fromProduct;
      update_('OrderItems', it.id, { out_product: num_(it.out_product) + x.fromProduct });
      update_('Products', pr.id, { stock: after, updated_at: now_() });
      movement_({ date: date, item_type: 'product', item_id: pr.id, item_name: pr.name, type: 'SALE', qty: -x.fromProduct, unit_cost: pr.avg_cost,
                  stock_after: after, order_id: o.id, ref_type: 'order', ref_id: o.id, notes: o.order_no });
    }
  });
  update_('Orders', o.id, { status: 'delivered', delivered_at: now_(), stock_out: true, invoice_sig: '', updated_at: now_() });
  log_('deliver', 'Order', o.id, o.order_no);
  return { id: o.id, produced: short.map(function (x) { return { name: x.item.name, qty: x.short }; }) };
}

/** Cancel (from any status). Delivered pieces come back to the store exactly once. Optional refund. */
function cancelOrder_(p) {
  var o = must_('Orders', p.id, 'الطلب');
  if (o.status === 'cancelled') throw new Error('الطلب ملغي بالفعل');
  var refund = vRefund_(p.refund, orderPaid_(o.id));     // validate BEFORE writing anything
  var date = today_();
  if (isTrue_(o.stock_out)) {
    orderItems_(o.id).forEach(function (it) {
      var bi = num_(it.out_item), bp = num_(it.out_product);
      if (bi > 0) movement_({ date: date, item_type: 'item', item_id: it.id, item_name: it.name, type: 'DELIVER_RETURN', qty: bi, unit_cost: 0, value: 0,
                              stock_after: num_(it.made_qty), order_id: o.id, ref_type: 'order', ref_id: o.id, notes: o.order_no + ' إلغاء' });
      if (bp > 0) {
        var pr = find_('Products', it.product_id);
        if (pr) {
          var unit = 0;      // same cost it left with
          rows_('Movements').forEach(function (mv) { if (mv.order_id === o.id && mv.item_id === pr.id && mv.type === 'SALE') unit = num_(mv.unit_cost); });
          var after = num_(pr.stock) + bp;
          update_('Products', pr.id, { stock: after, avg_cost: r4_(weightedAvg_(Math.max(0, num_(pr.stock)), pr.avg_cost, bp, bp * unit)), updated_at: now_() });
          movement_({ date: date, item_type: 'product', item_id: pr.id, item_name: pr.name, type: 'SALE_RETURN', qty: bp, unit_cost: unit,
                      stock_after: after, order_id: o.id, ref_type: 'order', ref_id: o.id, notes: o.order_no + ' إلغاء' });
        }
      }
      if (bi || bp) update_('OrderItems', it.id, { out_item: 0, out_product: 0 });
    });
  }
  update_('Orders', o.id, { status: 'cancelled', cancelled_at: now_(), stock_out: false, invoice_sig: '', updated_at: now_() });
  if (refund) addPayment_({ order_id: o.id, amount: refund.amount, method: refund.method, date: refund.date, kind: 'refund', notes: refund.notes });
  log_('cancel', 'Order', o.id, o.order_no);
  return { id: o.id };
}

/* =========================== Payments & order costs =========================== */

function vDeposit_(d) {
  if (!d || d.amount === '' || d.amount === null || d.amount === undefined || num_(d.amount) === 0) return null;
  return { amount: vNum_(d.amount, 'العربون', { gt: 0, max: 1e9 }), method: vEnum_(d.method || 'cash', PAY_METHODS, 'طريقة الدفع'),
           date: vDate_(d.date), notes: vStr_(d.notes, 'الملاحظات', 200, false) };
}
function vRefund_(r, paid) {
  if (!r || r.amount === '' || r.amount === null || r.amount === undefined || num_(r.amount) === 0) return null;
  var amount = vNum_(r.amount, 'المبلغ المردود', { gt: 0, max: 1e9 });
  if (amount > paid + 1e-6) throw new Error('المبلغ المردود أكبر من المدفوع (' + paid + ')');
  return { amount: amount, method: vEnum_(r.method || 'cash', PAY_METHODS, 'طريقة الدفع'), date: vDate_(r.date),
           notes: vStr_(r.notes, 'الملاحظات', 200, false) || 'رد العربون' };
}

function orderPaid_(orderId) {
  return r2_(rows_('Payments').filter(function (x) { return x.order_id === orderId && x.status !== 'void'; })
    .reduce(function (a, x) { return a + num_(x.amount); }, 0));
}

function addPayment_(p) {
  var o = must_('Orders', p.order_id, 'الطلب');
  var kind = vEnum_(p.kind || 'payment', ['deposit', 'payment', 'refund'], 'نوع الدفعة');
  var amount = vNum_(p.amount, 'المبلغ', { gt: 0, max: 1e9, required: true });
  var paid = orderPaid_(o.id);
  if (kind === 'refund') {
    if (amount > paid + 1e-6) throw new Error('المبلغ المردود أكبر من المدفوع (' + paid + ')');
  } else {
    if (o.status === 'quote') throw new Error('أكّد الطلب الأول عشان تسجل دفعة');
    if (o.status === 'cancelled') throw new Error('الطلب ملغي');
  }
  var rec = { id: newId_('PAY'), receipt_no: nextNo_('next_receipt_no', 'R'), order_id: o.id, customer_id: o.customer_id,
              pay_date: vDate_(p.date), kind: kind, amount: kind === 'refund' ? -amount : amount,
              method: vEnum_(p.method || 'cash', PAY_METHODS, 'طريقة الدفع'), notes: vStr_(p.notes, 'الملاحظات', 200, false),
              status: 'active', receipt_file_id: '', receipt_sig: '', created_at: now_() };
  insert_('Payments', [rec]);
  update_('Orders', o.id, { invoice_sig: '', updated_at: now_() });
  log_('payment', 'Order', o.id, o.order_no + ' ' + kind + ' ' + rec.amount);
  return { id: rec.id };
}

function voidPayment_(p) {
  var x = must_('Payments', p.id, 'الدفعة');
  if (x.status === 'void') throw new Error('الدفعة دي اتلغت قبل كده');
  update_('Payments', x.id, { status: 'void', receipt_sig: '' });
  update_('Orders', x.order_id, { invoice_sig: '', updated_at: now_() });
  log_('void', 'Payment', x.id, x.receipt_no + ' ' + x.amount);
  return { id: x.id };
}

function addOrderCost_(p) {
  var o = must_('Orders', p.order_id, 'الطلب');
  if (o.status === 'quote') throw new Error('التكاليف الفعلية بتتسجل بعد تأكيد الطلب');
  var rec = { id: newId_('OC'), order_id: o.id, cost_date: vDate_(p.date), kind: vStr_(p.kind, 'البند', 40, true),
              amount: vNum_(p.amount, 'المبلغ', { gt: 0, max: 1e9, required: true }), paid_to: vStr_(p.paid_to, 'اتدفع لمين', 60, false),
              notes: vStr_(p.notes, 'الملاحظات', 200, false), status: 'active', created_at: now_() };
  insert_('OrderCosts', [rec]);
  log_('cost', 'Order', o.id, o.order_no + ' ' + rec.kind + ' ' + rec.amount);
  return { id: rec.id };
}
function voidOrderCost_(p) {
  var x = must_('OrderCosts', p.id, 'التكلفة');
  if (x.status === 'void') throw new Error('اتلغت قبل كده');
  update_('OrderCosts', x.id, { status: 'void' });
  log_('void', 'OrderCost', x.id, x.kind + ' ' + x.amount);
  return { id: x.id };
}

/* =========================== Purchases & suppliers =========================== */

/**
 * Purchase from a supplier: several materials at once. Stock goes up and the weighted-average cost is
 * updated per material. "Paid now" is recorded as a supplier payment; the rest is owed to the supplier.
 */
function savePurchase_(p) {
  var lines = Array.isArray(p.lines) ? p.lines : [];
  if (!lines.length) throw new Error('ضيف خامة واحدة على الأقل');
  if (lines.length > 60) throw new Error('بنود كتير');
  var parsed = lines.map(function (l, i) {
    var lab = 'السطر ' + (i + 1);
    var m = must_('Materials', l.material_id, 'الخامة في ' + lab);
    var unit = String(l.unit || displayUnit_(m)), inQty, qBase, text;
    if (unit === 'board') {
      if (mtypeOf_(m) !== 'solid') throw new Error(lab + ': الشراء بالمقاسات للخشب بس');
      var b = l.board || {};
      inQty = vNum_(b.count, 'عدد الألواح/العروق في ' + lab, { gt: 0, max: 1e6, required: true });
      var L = vNum_(b.l, 'الطول في ' + lab, { gt: 0, max: 10000, required: true }), W = vNum_(b.w, 'العرض في ' + lab, { gt: 0, max: 1000, required: true }),
          T = vNum_(b.t, 'السُمك في ' + lab, { gt: 0, max: 1000, required: true });
      qBase = boardVolume_(inQty, L, W, T);
      text = inQty + ' × ' + L + '×' + W + '×' + T + ' سم';
    } else {
      inQty = vNum_(l.qty, 'الكمية في ' + lab, { gt: 0, max: 1e9, required: true });
      qBase = toBase_(inQty, unit, m);
      text = '';
    }
    if (!(qBase > 0)) throw new Error(lab + ': الكمية صغيرة جدًا');
    return { m: m, unit: unit, inQty: inQty, qBase: qBase, text: text, total: vNum_(l.total_price, 'السعر الإجمالي في ' + lab, { min: 0, max: 1e10, required: true }) };
  });
  var supplierId = resolveSupplier_(p);
  var total = r2_(parsed.reduce(function (a, x) { return a + x.total; }, 0));
  var paidNow = vNum_(p.paid_now, 'المدفوع', { min: 0, max: 1e10 });
  if (!supplierId && paidNow + 1e-6 < total) throw new Error('اختار المورد عشان الباقي يتسجل عليه');
  if (!supplierId) paidNow = total;
  var date = vDate_(p.date), id = newId_('PUR'), no = nextNo_('next_purchase_no', 'P');
  insert_('Purchases', [{ id: id, purchase_no: no, purchase_date: date, supplier_id: supplierId, total: total,
                          notes: vStr_(p.notes, 'الملاحظات', 200, false), status: 'active', created_at: now_() }]);
  var sup = supplierId ? find_('Suppliers', supplierId) : null, rowsOut = [];
  parsed.forEach(function (x) {
    var m = must_('Materials', x.m.id);
    var stockBefore = num_(m.stock), avgBefore = num_(m.avg_cost);
    var avgAfter = weightedAvg_(stockBefore, avgBefore, x.qBase, x.total), stockAfter = r6_(stockBefore + x.qBase);
    rowsOut.push({ id: newId_('PRL'), purchase_id: id, material_id: m.id, material_name: m.name, input_qty: x.inQty, input_unit: x.unit,
                   input_text: x.text, qty_base: x.qBase, total_price: r2_(x.total), unit_cost: x.total / x.qBase,
                   avg_before: avgBefore, avg_after: avgAfter, stock_after: stockAfter });
    var patch = { stock: stockAfter, avg_cost: avgAfter, updated_at: now_() };
    if (supplierId && !m.supplier_id) patch.supplier_id = supplierId;
    update_('Materials', m.id, patch);
    movement_({ date: date, item_id: m.id, item_name: m.name, type: 'PURCHASE', qty: x.qBase, unit_cost: x.total / x.qBase, stock_after: stockAfter,
                ref_type: 'purchase', ref_id: id, notes: no + (sup ? ' ' + sup.name : '') });
  });
  insert_('PurchaseLines', rowsOut);
  if (paidNow > 0 && supplierId) {
    insert_('SupplierPayments', [{ id: newId_('SPY'), supplier_id: supplierId, purchase_id: id, pay_date: date, amount: r2_(paidNow),
      method: vEnum_(p.method || 'cash', PAY_METHODS, 'طريقة الدفع'), notes: 'مدفوع مع فاتورة ' + no, status: 'active', created_at: now_() }]);
  }
  log_('create', 'Purchase', id, no + ' ' + total + (sup ? ' ' + sup.name : ''));
  return { id: id };
}

/** Undo a purchase — only if no other movement touched its materials afterwards (keeps averages exact). */
function reversePurchase_(p) {
  var pur = must_('Purchases', p.id, 'فاتورة الشراء');
  if (pur.status === 'reversed') throw new Error('الفاتورة دي اتلغت قبل كده');
  var lines = rows_('PurchaseLines').filter(function (l) { return l.purchase_id === pur.id; });
  var mvs = rows_('Movements');
  lines.forEach(function (l) {
    var last = null;
    for (var i = mvs.length - 1; i >= 0; i--) if (mvs[i].item_id === l.material_id) { last = mvs[i]; break; }
    if (!last || last.ref_id !== pur.id) throw new Error('مينفعش تلغي الفاتورة: "' + l.material_name + '" اتعمل عليها حركات بعدها. استخدم الجرد بدلها.');
  });
  // a material can appear twice in one purchase: undo in reverse order
  lines.slice().reverse().forEach(function (l) {
    var m = must_('Materials', l.material_id);
    var after = r6_(num_(m.stock) - num_(l.qty_base));
    update_('Materials', m.id, { stock: after, avg_cost: num_(l.avg_before) || num_(m.avg_cost), updated_at: now_() });
    movement_({ item_id: m.id, item_name: m.name, type: 'PURCHASE_REVERSAL', qty: -num_(l.qty_base), unit_cost: l.unit_cost,
                stock_after: after, ref_type: 'purchase', ref_id: pur.id, notes: 'إلغاء ' + pur.purchase_no });
  });
  update_('Purchases', pur.id, { status: 'reversed' });
  rows_('SupplierPayments').forEach(function (sp) { if (sp.purchase_id === pur.id && sp.status !== 'void') update_('SupplierPayments', sp.id, { status: 'void' }); });
  log_('reverse', 'Purchase', pur.id, pur.purchase_no);
  return { id: pur.id };
}

function addSupplierPayment_(p) {
  var s = must_('Suppliers', p.supplier_id, 'المورد');
  var rec = { id: newId_('SPY'), supplier_id: s.id, purchase_id: '', pay_date: vDate_(p.date),
              amount: vNum_(p.amount, 'المبلغ', { gt: 0, max: 1e10, required: true }), method: vEnum_(p.method || 'cash', PAY_METHODS, 'طريقة الدفع'),
              notes: vStr_(p.notes, 'الملاحظات', 200, false), status: 'active', created_at: now_() };
  insert_('SupplierPayments', [rec]);
  log_('payment', 'Supplier', s.id, s.name + ' ' + rec.amount);
  return { id: rec.id };
}
function voidSupplierPayment_(p) {
  var x = must_('SupplierPayments', p.id, 'الدفعة');
  if (x.status === 'void') throw new Error('اتلغت قبل كده');
  if (x.purchase_id) {
    var pur = find_('Purchases', x.purchase_id);
    if (pur && pur.status !== 'reversed') { /* allowed: the purchase simply becomes unpaid */ }
  }
  update_('SupplierPayments', x.id, { status: 'void' });
  log_('void', 'SupplierPayment', x.id, x.amount);
  return { id: x.id };
}

/* =========================== Workshop expenses =========================== */

function saveExpense_(p) {
  var rec = { exp_date: vDate_(p.date), category: vStr_(p.category, 'البند', 40, true),
              amount: vNum_(p.amount, 'المبلغ', { gt: 0, max: 1e9, required: true }), notes: vStr_(p.notes, 'الملاحظات', 200, false) };
  if (p.id) {
    var cur = must_('Expenses', p.id, 'المصروف');
    if (cur.status === 'void') throw new Error('المصروف ده ملغي');
    update_('Expenses', cur.id, rec);
    log_('update', 'Expense', cur.id, rec.category + ' ' + rec.amount);
    return { id: cur.id };
  }
  rec.id = newId_('EXP'); rec.status = 'active'; rec.created_at = now_();
  insert_('Expenses', [rec]);
  log_('create', 'Expense', rec.id, rec.category + ' ' + rec.amount);
  return { id: rec.id };
}
function voidExpense_(p) {
  var x = must_('Expenses', p.id, 'المصروف');
  if (x.status === 'void') throw new Error('اتلغى قبل كده');
  update_('Expenses', x.id, { status: 'void' });
  log_('void', 'Expense', x.id, x.category + ' ' + x.amount);
  return { id: x.id };
}

/* =========================== Customer documents (PDF in Drive) =========================== */

function pdfBytes_(data) {
  data = String(data || '');
  if (!data || data.length > 6000000) throw new Error('ملف PDF غير صالح');
  var bytes = Utilities.base64Decode(data);
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) throw new Error('ملف PDF غير صالح');
  return bytes;
}
function storePdf_(bytes, name, oldId) {
  if (oldId) { try { DriveApp.getFileById(oldId).setTrashed(true); } catch (e) { /* already gone */ } }
  var f = folderProp_('INVOICE_FOLDER_ID', 'Invoices').createFile(Utilities.newBlob(bytes, 'application/pdf', name));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return f.getId();
}
function fileUrl_(id) { return id ? 'https://drive.google.com/file/d/' + id + '/view?usp=sharing' : ''; }

/** One PDF per order (quote or invoice), rebuilt when what it shows changes (sig from the browser). */
function saveInvoicePdf_(p) {
  var o = must_('Orders', p.order_id, 'الطلب');
  var bytes = pdfBytes_(p.data);
  var kind = o.status === 'quote' ? 'Quotation' : 'Invoice';
  var id = storePdf_(bytes, APP.FILE_PREFIX + ' ' + kind + ' ' + o.order_no + '.pdf', o.invoice_file_id);
  update_('Orders', o.id, { invoice_file_id: id, invoice_sig: vStr_(p.sig, 'sig', 400, false) });
  log_('invoice', 'Order', o.id, o.order_no + ' PDF');
  return { url: fileUrl_(id) };
}
function saveReceiptPdf_(p) {
  var x = must_('Payments', p.payment_id, 'الدفعة');
  var bytes = pdfBytes_(p.data);
  var id = storePdf_(bytes, APP.FILE_PREFIX + ' Receipt ' + x.receipt_no + '.pdf', x.receipt_file_id);
  update_('Payments', x.id, { receipt_file_id: id, receipt_sig: vStr_(p.sig, 'sig', 400, false) });
  log_('receipt', 'Payment', x.id, x.receipt_no + ' PDF');
  return { url: fileUrl_(id) };
}

/* =========================== Read model for the app =========================== */

function pub_(r) { var o = {}; Object.keys(r).forEach(function (k) { if (k.charAt(0) !== '_') o[k] = r[k]; }); return o; }

function bootstrap_() {
  var settings = settingsObj_();
  var mById = byId_('Materials');
  var materials = rows_('Materials').map(function (r) { var o = pub_(r); o.image_url = imageUrl_(r.image_id); return o; });

  var plines = {};
  rows_('ProductLines').slice().sort(function (a, b) { return num_(a.sort) - num_(b.sort); }).forEach(function (l) { (plines[l.product_id] = plines[l.product_id] || []).push(pub_(l)); });
  var products = rows_('Products').map(function (r) {
    var o = pub_(r);
    o.labor = safeJson_(r.labor_json, []); delete o.labor_json;
    o.lines = plines[r.id] || [];
    o.cost = productCost_(o, o.lines, mById, settings);
    delete o.cost.lines;
    o.image_url = imageUrl_(r.image_id);
    return o;
  });

  // movements → actual material cost per order, issued per order & material, daily totals for reports
  var act = {}, issued = {}, daily = {};
  rows_('Movements').forEach(function (mv) {
    var v = num_(mv.value);
    if (mv.order_id && (mv.item_type === 'material' || mv.item_type === 'product')) act[mv.order_id] = (act[mv.order_id] || 0) - v;
    if (mv.order_id && mv.item_type === 'material') {
      var k = mv.order_id + '|' + mv.item_id;
      issued[k] = issued[k] || { material_id: mv.item_id, qty: 0, value: 0 };
      issued[k].qty -= num_(mv.qty); issued[k].value -= v;
    }
    if (mv.item_type !== 'item' && v) {
      var dk = String(mv.mv_date).slice(0, 10) + '|' + mv.item_type + '|' + mv.type;
      daily[dk] = (daily[dk] || 0) + v;
    }
  });
  var issuedByOrder = {};
  Object.keys(issued).forEach(function (k) {
    var oid = k.split('|')[0], x = issued[k];
    (issuedByOrder[oid] = issuedByOrder[oid] || []).push({ material_id: x.material_id, qty: r6_(x.qty), value: r2_(x.value) });
  });

  var items = {}, olines = {};
  rows_('OrderItems').slice().sort(function (a, b) { return num_(a.sort) - num_(b.sort); }).forEach(function (r) {
    var o = pub_(r); o.labor = safeJson_(r.labor_json, []); delete o.labor_json; o.image_url = imageUrl_(r.image_id);
    (items[r.order_id] = items[r.order_id] || []).push(o);
  });
  rows_('OrderLines').slice().sort(function (a, b) { return num_(a.sort) - num_(b.sort); }).forEach(function (l) { (olines[l.order_id] = olines[l.order_id] || []).push(pub_(l)); });
  var paid = {}, costs = {};
  rows_('Payments').forEach(function (x) { if (x.status !== 'void') paid[x.order_id] = (paid[x.order_id] || 0) + num_(x.amount); });
  rows_('OrderCosts').forEach(function (x) { if (x.status !== 'void') costs[x.order_id] = (costs[x.order_id] || 0) + num_(x.amount); });

  var orders = rows_('Orders').slice().reverse().map(function (r) {
    var o = pub_(r);
    o.items = items[r.id] || [];
    o.lines = olines[r.id] || [];
    o.extras = safeJson_(r.extras_json, []); delete o.extras_json;
    o.waste = safeJson_(r.waste_json, {}); delete o.waste_json;
    o.full_sheets = isTrue_(r.full_sheets);
    o.snapshot = safeJson_(r.est_json, null); delete o.est_json;
    o.paid = r2_(paid[r.id] || 0);
    o.remaining = r2_(num_(r.total) - o.paid);
    o.act_material = r2_(act[r.id] || 0);
    o.act_costs = r2_(costs[r.id] || 0);
    o.act_cost = r2_(o.act_material + o.act_costs);
    o.act_profit = r2_(num_(r.total) - o.act_cost);
    o.act_margin = num_(r.total) > 0 ? r4_(o.act_profit / num_(r.total)) : null;
    o.issued = issuedByOrder[r.id] || [];
    o.invoice_url = fileUrl_(r.invoice_file_id);
    if (r.status === 'quote') {     // live estimate with today's prices
      var lbi = {}; o.lines.forEach(function (l) { (lbi[l.item_id] = lbi[l.item_id] || []).push(l); });
      var e = orderEstimate_({ discount: r.discount, extras: o.extras, waste: o.waste, full_sheets: o.full_sheets },
        o.items.map(function (it) { return { id: it.id, qty: it.qty, unit_price: it.unit_price, labor: it.labor }; }), lbi, mById, settings);
      o.est_material = e.material_cost; o.est_labor = e.labor_cost; o.est_extra = e.extra_cost; o.est_cost = e.total_cost;
      o.est_profit = e.profit; o.est_margin = e.margin; o.items_total = e.items_total; o.total = e.total; o.remaining = r2_(e.total - o.paid);
      o.estimated = true;
    }
    return o;
  });

  var plinesP = {};
  rows_('PurchaseLines').forEach(function (l) { (plinesP[l.purchase_id] = plinesP[l.purchase_id] || []).push(pub_(l)); });
  var purchases = rows_('Purchases').slice().reverse().map(function (r) { var o = pub_(r); o.lines = plinesP[r.id] || []; return o; });

  var props = PropertiesService.getScriptProperties();
  return {
    version: APP.VERSION,
    today: today_(),
    settings: settings,
    links: { folder: 'https://drive.google.com/drive/folders/' + (props.getProperty('FOLDER_ID') || ''),
             db: 'https://docs.google.com/spreadsheets/d/' + (props.getProperty('DB_ID') || '') },
    materials: materials,
    products: products,
    customers: rows_('Customers').map(pub_),
    suppliers: rows_('Suppliers').map(pub_),
    orders: orders,
    payments: rows_('Payments').slice().reverse().map(function (r) { var o = pub_(r); o.receipt_url = fileUrl_(r.receipt_file_id); return o; }),
    order_costs: rows_('OrderCosts').slice().reverse().map(pub_),
    purchases: purchases,
    supplier_payments: rows_('SupplierPayments').slice().reverse().map(pub_),
    expenses: rows_('Expenses').slice().reverse().map(pub_),
    production: rows_('Production').slice().reverse().map(function (r) { var o = pub_(r); o.materials = safeJson_(r.materials_json, []); delete o.materials_json; return o; }),
    movements: rows_('Movements').slice(-1500).reverse().map(pub_),
    daily: Object.keys(daily).map(function (k) { var p = k.split('|'); return [p[0], p[1], p[2], r2_(daily[k])]; })
  };
}

/* =========================== Seed data =========================== */

function seed_() {
  var s = defaultSettings_(), t = now_();
  insert_('Settings', Object.keys(s).map(function (k) { return { key: k, value: s[k] }; }));
  var note = 'سعر مثال من تعليمات المشروع — عدّله حسب آخر فاتورة شراء';
  var mats = [
    { name: 'كونتر أرو 18 مم', mtype: 'sheet', category: 'ألواح', thickness_mm: 18, price: [1560, 1, 'sheet'], notes: note },
    { name: 'كونتر 3 مم', mtype: 'sheet', category: 'ألواح', thickness_mm: 3 },
    { name: 'MDF 18 مم', mtype: 'sheet', category: 'ألواح', thickness_mm: 18 },
    { name: 'HDF 3 مم', mtype: 'sheet', category: 'ألواح', thickness_mm: 3 },
    { name: 'أبلكاش 4 مم', mtype: 'sheet', category: 'ألواح', thickness_mm: 4 },
    { name: 'خشب موسكي', mtype: 'solid', category: 'خشب', price: [19000, 1, 'm3'], notes: note },
    { name: 'خشب زان', mtype: 'solid', category: 'خشب', price: [32500, 1, 'm3'], notes: note },
    { name: 'شريط حرف', mtype: 'linear', category: 'إكسسوارات' },
    { name: 'قماش تنجيد', mtype: 'linear', category: 'تنجيد' },
    { name: 'مفصلات', mtype: 'count', category: 'حدايد وإكسسوارات' },
    { name: 'مجاري أدراج', mtype: 'count', category: 'حدايد وإكسسوارات' },
    { name: 'مقابض', mtype: 'count', category: 'حدايد وإكسسوارات' },
    { name: 'كوالين', mtype: 'count', category: 'حدايد وإكسسوارات' },
    { name: 'ورنيش', mtype: 'liquid', base_unit: 'ml', category: 'دهانات' },
    { name: 'غراء', mtype: 'liquid', base_unit: 'g', category: 'دهانات' }
  ];
  insert_('Materials', mats.map(function (m) {
    var probe = { mtype: m.mtype, base_unit: m.base_unit || MTYPES[m.mtype].base, sheet_len: 244, sheet_wid: 122 };
    return { id: newId_('MAT'), name: m.name, mtype: m.mtype, category: m.category, base_unit: probe.base_unit,
      sheet_len: m.mtype === 'sheet' ? 244 : '', sheet_wid: m.mtype === 'sheet' ? 122 : '', thickness_mm: m.thickness_mm || '',
      pack_qty: '', pack_label: '', waste_pct: '', stock: 0, avg_cost: m.price ? pricePerBase_(m.price[0], m.price[1], m.price[2], probe) : 0,
      min_stock: 0, supplier_id: '', image_id: '', notes: m.notes || '', active: true, created_at: t, updated_at: t };
  }));
  log_('setup', 'System', '', 'تجهيز السيستم لأول مرة');
}
