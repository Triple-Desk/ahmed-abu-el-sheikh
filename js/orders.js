/* Orders: list, quote editor, order page, status actions, payments, actual costs, materials issue/return. */

/* ---------- list ---------- */
function orderRow(o) {
  var c = custOf(o);
  var items = (o.items || []).map(function (it) { return esc(it.name) + (n(it.qty) > 1 ? ' × ' + fmt(it.qty, 0) : ''); }).join('، ');
  var rem = countsAsSale(o) && n(o.remaining) > 0.009 ? '<div class="faint neg">باقي ' + money(o.remaining, 0) + '</div>' : (countsAsSale(o) ? '<div class="faint pos">خالص</div>' : '');
  return '<div class="li" data-act="nav" data-v="order" data-p="' + esc(o.id) + '"><div class="avatar no">' + esc(o.order_no) + '</div>' +
    '<div class="grow"><div class="main-t">' + esc(c.name || 'بدون اسم') + ' ' + statusBadge(o) + '</div>' +
    '<div class="faint" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (o.due_date && isOpen(o) ? 'التسليم ' + fmtDate(o.due_date) + ' · ' : fmtDate(o.order_date) + ' · ') + items + '</div></div>' +
    '<div class="end"><div style="font-weight:700">' + money(o.total, 0) + '</div>' + rem + '</div></div>';
}
var ORD_FILTERS = [['open', 'المفتوحة'], ['quote', 'عروض أسعار'], ['late', 'متأخرة'], ['delivered', 'تم التسليم'], ['cancelled', 'ملغي'], ['all', 'الكل']];
function ordFilter(o, f) {
  if (f === 'open') return isOpen(o);
  if (f === 'late') return isLate(o);
  if (f === 'all') return true;
  return o.status === f;
}
VIEWS.orders = function () {
  topbar('الطلبات', { right: '<button class="btn btn-primary btn-sm desk-only" data-act="newOrder">' + ic('plus', 'sm') + 'عرض سعر جديد</button>' });
  var f = S.filters, all = S.data.orders || [], q = f.ordQ.trim().toLowerCase();
  var list = all.filter(function (o) {
    if (!ordFilter(o, f.ordStatus)) return false;
    if (!q) return true;
    var c = custOf(o);
    return (o.order_no + ' ' + c.name + ' ' + (c.phone || '') + ' ' + (o.items || []).map(function (i) { return i.name; }).join(' ')).toLowerCase().indexOf(q) >= 0;
  });
  if (f.ordStatus === 'open' || f.ordStatus === 'late') list.sort(function (a, b) { return String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')); });
  var h = '<div class="row mb"><div class="search"><input class="inp" id="ordQ" placeholder="ابحث برقم الطلب أو العميل أو التليفون…" value="' + esc(f.ordQ) + '" data-live="ordQ">' + ic('search', 'sm') + '</div></div>';
  h += '<div class="chips mb">' + ORD_FILTERS.map(function (x) {
    var c = all.filter(function (o) { return ordFilter(o, x[0]); }).length;
    return '<button class="chip ' + (f.ordStatus === x[0] ? 'on' : '') + '" data-act="ordFilter" data-v="' + x[0] + '">' + x[1] + ' <span class="num">' + c + '</span></button>';
  }).join('') + '</div>';
  h += list.length ? '<div class="card list">' + list.map(orderRow).join('') + '</div>' : emptyBox('receipt', 'مفيش طلبات هنا', 'newOrder', 'عرض سعر جديد');
  h += '<button class="btn btn-primary fab" data-act="newOrder">' + ic('plus') + 'عرض سعر</button>';
  return h;
};
ACT.ordFilter = function (el) { S.filters.ordStatus = el.getAttribute('data-v'); render(); };
LIVE.ordQ = function (t) { S.filters.ordQ = t.value; softRender('ordQ'); };

/* ---------- quote editor ---------- */
function itemFromProduct(p) {
  return { product_id: p.id, name: p.name, category: p.category || '', qty: 1, unit_price: n(p.selling_price), spec: '', notes: '',
           labor: (p.labor || []).map(function (x) { return { kind: x.kind, amount: x.amount }; }), lines: cloneLines(p.lines), image_id: '', image_url: '' };
}
function startOrder(o) {
  if (o) {
    var c = custOf(o), byItem = {};
    (o.lines || []).forEach(function (l) { (byItem[l.item_id] = byItem[l.item_id] || []).push(l); });
    S.draft = { id: o.id, order_no: o.order_no, customer: { id: o.customer_id || '', name: c.name || '', phone: c.phone || '', address: c.address || '' },
      order_date: o.order_date || today(), due_date: o.due_date || '', discount: n(o.discount) || '', notes: o.notes || '', full_sheets: !!o.full_sheets,
      extras: (o.extras || []).map(function (e) { return { kind: e.kind, amount: e.amount }; }), waste: Object.assign({}, o.waste || {}),
      items: (o.items || []).map(function (it) {
        return { product_id: it.product_id, name: it.name, category: it.category, qty: n(it.qty), unit_price: n(it.unit_price), spec: it.spec || '', notes: it.notes || '',
                 labor: (it.labor || []).map(function (x) { return { kind: x.kind, amount: x.amount }; }), lines: cloneLines(byItem[it.id]), image_id: it.image_id || '', image_url: it.image_url || '' };
      }), rid: rid() };
  } else {
    S.draft = { id: '', customer: { id: '', name: '', phone: '', address: '' }, order_date: today(), due_date: '', discount: '', notes: '', full_sheets: false,
      extras: [], waste: {}, items: [], rid: rid() };
  }
  go('orderEdit');
}
ACT.newOrder = function () { startOrder(null); };
ACT.ordEdit = function (el) { startOrder(orderById(el.getAttribute('data-p'))); };

function draftEstimate(d) {
  var mm = matMap(), lbi = {};
  var items = d.items.map(function (it, i) {
    var k = 'i' + i;
    lbi[k] = (it.lines || []).map(function (l) { return { ltype: l.ltype, name: l.name, material_id: l.material_id, count: n(l.count), length: n(l.length), width: n(l.width), thickness: n(l.thickness), qty: n(l.qty), unit: l.unit || (mm[l.material_id] ? unitsFor_(mm[l.material_id])[0] : '') }; });
    return { id: k, name: it.name, qty: n(it.qty), unit_price: n(it.unit_price), labor: (it.labor || []).map(function (x) { return { amount: n(x.amount) }; }) };
  });
  var waste = {}; Object.keys(d.waste || {}).forEach(function (k) { if (String(d.waste[k]).trim() !== '') waste[k] = n(d.waste[k]); });
  return orderEstimate_({ discount: n(d.discount), extras: (d.extras || []).map(function (e) { return { amount: n(e.amount) }; }), waste: waste, full_sheets: !!d.full_sheets }, items, lbi, mm, S.data.settings);
}

VIEWS.orderEdit = function () {
  var d = S.draft;
  if (!d) { S.view = 'orders'; return VIEWS.orders(); }
  topbar(d.id ? 'تعديل عرض السعر ' + (d.order_no || '') : 'عرض سعر جديد', d.id ? { back: 'order', backP: d.id } : { back: 'orders' });
  var h = '<div class="split"><div>';
  h += '<div class="card pad"><div class="between mb"><b>العميل</b>' + (d.customer.id ? '<button class="link" data-act="odCustClear">تغيير</button>' : '') + '</div>';
  if (d.customer.id) {
    var c = custById(d.customer.id) || d.customer;
    h += '<div class="row"><div class="avatar">' + initials(c.name) + '</div><div class="grow"><b>' + esc(c.name) + '</b><div class="faint">' + esc(c.phone || '') + (c.address ? ' · ' + esc(c.address) : '') + '</div></div></div>';
  } else {
    h += '<div class="grid g2"><div class="field" style="margin:0"><label>اسم العميل</label><input class="inp" id="odc_name" maxlength="60" data-live="odc" data-f="name" value="' + esc(d.customer.name) + '" placeholder="اسم العميل" autocomplete="off"></div>' +
      '<div class="field" style="margin:0"><label>تليفون (واتساب)</label><input class="inp ltr" type="tel" inputmode="tel" id="odc_phone" maxlength="25" data-live="odc" data-f="phone" value="' + esc(d.customer.phone) + '" placeholder="01xxxxxxxxx" autocomplete="off"></div></div>' +
      '<div id="odc_sug"></div><div class="field mt" style="margin-bottom:0"><label>العنوان (للتسليم والتركيب)</label><input class="inp" id="odc_addr" maxlength="150" data-live="odc" data-f="address" value="' + esc(d.customer.address) + '"></div>';
  }
  h += '<div class="grid g2 mt"><div class="field" style="margin:0"><label>تاريخ عرض السعر</label><input class="inp" type="date" id="od_date" data-live="od" data-f="order_date" value="' + esc(d.order_date) + '"></div>' +
    '<div class="field" style="margin:0"><label>موعد التسليم</label><input class="inp" type="date" id="od_due" data-live="od" data-f="due_date" value="' + esc(d.due_date) + '"></div></div></div>';

  var est = draftEstimate(d);
  h += '<div class="sect"><h2>البنود</h2><span class="grow"></span><button class="btn btn-soft btn-sm" data-act="odPickProduct">' + ic('sofa', 'sm') + 'من المنتجات</button><button class="btn btn-soft btn-sm" data-act="odCustomItem">' + ic('plus', 'sm') + 'بند مخصوص</button></div>';
  if (!d.items.length) h += '<div class="card empty"><div class="big">' + ic('sofa') + '</div>ضيف بند من المنتجات (القطع بتتنسخ وتقدر تعدل مقاساتها للعميل ده) أو بند مخصوص جديد.</div>';
  else h += '<div class="card">' + d.items.map(function (it, i) {
    var e = est.items['i' + i] || {}, pieces = (it.lines || []).filter(function (l) { return l.ltype === 'piece'; }).length;
    return '<div class="icard"><div class="between"><div style="min-width:0"><b>' + esc(it.name) + '</b> ' + (it.category ? '<span class="badge b-gray">' + esc(it.category) + '</span>' : '') +
      (it.spec ? '<div class="faint">' + esc(it.spec) + '</div>' : '') + '</div><div style="text-align:left;flex:none"><b>' + money(n(it.qty) * n(it.unit_price), 0) + '</b><div class="faint"><span class="num">' + fmt(it.qty, 0) + '</span> × ' + money(it.unit_price, 0) + '</div></div></div>' +
      '<div class="calc"><span>' + pieces + ' قطعة مقاسات</span><span>تكلفة القطعة: <b>' + money(e.unit_cost, 0) + '</b></span><span class="' + profitCls(e.profit) + '">ربح البند: <b>' + money(e.profit, 0) + '</b></span>' +
      (!(n(it.unit_price) > 0) ? '<span class="badge b-warn">' + ic('alert', 'sm') + 'السعر مش متحدد</span>' : '') + '</div>' +
      '<div class="row mt" style="gap:8px"><button class="btn btn-ghost btn-sm" data-act="odEditItem" data-i="' + i + '">' + ic('edit', 'sm') + 'القطع والمقاسات</button><button class="iconbtn sm" data-act="odDupItem" data-i="' + i + '" aria-label="تكرار">' + ic('copy', 'sm') + '</button><button class="iconbtn sm" data-act="odDelItem" data-i="' + i + '" aria-label="حذف">' + ic('trash', 'sm') + '</button></div></div>';
  }).join('') + '</div>';

  h += '<div class="sect"><h2>الخصم ومصاريف الطلب</h2></div><div class="card pad">' +
    '<div class="field"><label>خصم للعميل (ج)</label><input class="inp ltr" inputmode="decimal" id="od_discount" data-live="od" data-f="discount" value="' + esc(d.discount) + '" placeholder="0"></div>' +
    '<div class="field"><label>مصاريف على الورشة متوقعة للطلب (نقل، تركيب، عمولة…)</label>' + d.extras.map(function (e, i) {
      return '<div class="combo mb"><input class="inp" maxlength="40" placeholder="البند" data-live="ode" data-i="' + i + '" data-f="kind" value="' + esc(e.kind) + '"><input class="inp ltr" style="max-width:140px" inputmode="decimal" placeholder="المبلغ" data-live="ode" data-i="' + i + '" data-f="amount" value="' + esc(e.amount) + '"><button class="iconbtn" style="height:48px;width:48px" data-act="odDelExtra" data-i="' + i + '">' + ic('trash', 'sm') + '</button></div>';
    }).join('') + '<button class="link" data-act="odAddExtra">+ إضافة مصروف</button></div>' +
    '<label class="switch"><input type="checkbox" id="od_full" data-change="odFull"' + (d.full_sheets ? ' checked' : '') + '>احسب ألواح كاملة (بدل المساحة + الهالك)</label>' +
    '<div class="field mt" style="margin-bottom:0"><label>ملاحظات</label><textarea class="inp" maxlength="500" data-live="od" data-f="notes">' + esc(d.notes) + '</textarea></div></div>';

  if (est.materials.length) {
    h += '<div class="sect"><h2>نسبة الهالك في الطلب ده</h2><span class="faint">سيبها فاضية للنسبة العادية</span></div><div class="card tscroll"><table class="t"><tbody>' + est.materials.map(function (x) {
      var m = matById(x.material_id), def = m ? wasteOf_(m, S.data.settings) : 0, cur = d.waste[x.material_id];
      return '<tr><td>' + esc(x.name) + '</td><td class="n" style="width:150px"><div class="combo" style="align-items:center"><input class="inp sm ltr" inputmode="decimal" data-live="odw" data-m="' + esc(x.material_id) + '" placeholder="' + fmt(def, 1) + '" value="' + esc(cur === undefined ? '' : cur) + '"><span class="faint">%</span></div></td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  h += '</div><div class="sticky"><div id="od_sum"></div><div id="od_need" class="mt"></div>' +
    '<div class="grid g2 mt"><button class="btn btn-ghost" data-lockable data-act="odSave">' + ic('save', 'sm') + 'حفظ عرض السعر</button><button class="btn btn-primary" data-lockable data-act="odConfirm">' + ic('check', 'sm') + 'تأكيد الطلب</button></div>' +
    '<div class="faint mt">التأكيد بيثبّت الأسعار والتكلفة المتوقعة. الخامات مش بتتخصم من المخزن غير لما تصرفها أو تسجل تصنيع.</div></div></div>';
  return h;
};
AFTER.orderEdit = function () { odCalc(); odSuggest(); };
function odCalc() {
  var d = S.draft; if (!d || S.view !== 'orderEdit') return;
  var e = draftEstimate(d), mm = matMap();
  var s = document.getElementById('od_sum');
  if (s) s.innerHTML = '<div class="card pad"><div class="between mb"><b style="font-size:17px">ملخص عرض السعر</b><span class="badge b-info">بأسعار النهارده</span></div>' +
    kv('قيمة البنود', money(e.items_total)) + (e.discount ? kv('الخصم', '− ' + money(e.discount)) : '') + kv('الإجمالي للعميل', '<b>' + money(e.total) + '</b>') +
    kv('خامات', '− ' + money(e.material_cost)) + kv('مصنعية وشغل بره', '− ' + money(e.labor_cost)) + (e.extra_cost ? kv('مصاريف الطلب', '− ' + money(e.extra_cost)) : '') +
    '<div class="kv total big"><span>الربح المتوقع</span><span class="' + profitCls(e.profit) + '">' + money(e.profit) + '</span></div>' + kv('هامش الربح', pct(e.margin)) +
    (e.warnings.length ? '<div class="callout warn mt">' + ic('alert', 'sm') + '<div>' + e.warnings.slice(0, 5).map(esc).join('<br>') + '</div></div>' : '') + '</div>';
  var nd = document.getElementById('od_need');
  if (nd) nd.innerHTML = needTable(e.materials.map(function (x) { return { m: mm[x.material_id], need: x.gross, issued: 0, sheets: x.sheets }; }), 'الخامات المطلوبة للطلب');
}
/** rows: [{m, need (base, with waste), issued}] → needed vs in stock, shortage, sheets to buy */
function needTable(rows, title) {
  rows = rows.filter(function (r) { return r.m; });
  if (!rows.length) return '';
  return '<div class="card tscroll"><div class="pad" style="padding-bottom:4px"><b>' + esc(title) + '</b></div><table class="t"><thead><tr><th>الخامة</th><th class="n">المطلوب</th>' + (rows.some(function (r) { return r.issued; }) ? '<th class="n">اتصرف</th>' : '') + '<th class="n">في المخزن</th><th>الحالة</th></tr></thead><tbody>' + rows.map(function (r) {
    var m = r.m, rem = Math.max(0, r.need - (r.issued || 0)), short = Math.max(0, rem - Math.max(0, n(m.stock)));
    var sheetsTxt = m.mtype === 'sheet' ? '<div class="faint">' + (r.sheets ? '<span class="num">' + r.sheets + '</span> لوح كامل' : '') + '</div>' : '';
    var st = rem <= 1e-6 ? '<span class="badge b-ok">' + ic('check', 'sm') + 'اتصرف</span>' : short > 1e-6 ? '<span class="badge b-bad">ناقص ' + qtyM(short, m) + '</span>' + (m.mtype === 'sheet' ? '<div class="faint">اشتري <span class="num">' + Math.ceil(short / sheetArea_(m) - 1e-9) + '</span> لوح</div>' : '') : '<span class="badge b-ok">' + ic('check', 'sm') + 'كفاية</span>';
    return '<tr><td>' + esc(matLabel(m)) + sheetsTxt + '</td><td class="n">' + qtyM(r.need, m) + '</td>' + (rows.some(function (x) { return x.issued; }) ? '<td class="n">' + qtyM(r.issued || 0, m) + '</td>' : '') + '<td class="n">' + qtyM(m.stock, m) + '</td><td>' + st + '</td></tr>';
  }).join('') + '</tbody></table></div>';
}
LIVE.od = function (t) { S.draft[t.getAttribute('data-f')] = t.value; odCalc(); };
LIVE.ode = function (t) { S.draft.extras[+t.getAttribute('data-i')][t.getAttribute('data-f')] = t.value; odCalc(); };
LIVE.odw = function (t) { S.draft.waste[t.getAttribute('data-m')] = t.value; odCalc(); };
LIVE.odc = function (t) { S.draft.customer[t.getAttribute('data-f')] = t.value; odSuggest(); };
CHANGE.odFull = function (t) { S.draft.full_sheets = t.checked; odCalc(); };
function odSuggest() {
  var box = document.getElementById('odc_sug'); if (!box) return;
  var c = S.draft.customer, q = String(c.name || '').trim().toLowerCase(), ph = digits(c.phone || '').replace(/\D/g, '');
  if (q.length < 2 && ph.length < 4) { box.innerHTML = ''; return; }
  var list = (S.data.customers || []).filter(function (x) {
    return isActive(x) && ((q.length >= 2 && String(x.name).toLowerCase().indexOf(q) >= 0) || (ph.length >= 4 && String(x.phone || '').replace(/\D/g, '').indexOf(ph) >= 0));
  }).slice(0, 5);
  box.innerHTML = list.length ? '<div class="suggest">' + list.map(function (x) { return '<button data-act="odCustPick" data-p="' + esc(x.id) + '">' + ic('users', 'sm') + '<span><b>' + esc(x.name) + '</b> <span class="faint num">' + esc(x.phone || '') + '</span></span></button>'; }).join('') + '</div>' : '';
}
ACT.odCustPick = function (el) { var c = custById(el.getAttribute('data-p')); S.draft.customer = { id: c.id, name: c.name, phone: c.phone, address: c.address }; render(); };
ACT.odCustClear = function () { S.draft.customer = { id: '', name: '', phone: '', address: '' }; render(); };
ACT.odAddExtra = function () { S.draft.extras.push({ kind: '', amount: '' }); render(); };
ACT.odDelExtra = function (el) { S.draft.extras.splice(+el.getAttribute('data-i'), 1); render(); };
ACT.odEditItem = function (el) { var i = +el.getAttribute('data-i'); startItemEditor('order', S.draft.items[i], i); };
ACT.odCustomItem = function () { startItemEditor('order', null, -1); };
ACT.odDupItem = function (el) { var i = +el.getAttribute('data-i'); var c = JSON.parse(JSON.stringify(S.draft.items[i])); c.image = null; S.draft.items.splice(i + 1, 0, c); render(); };
ACT.odDelItem = function (el) {
  var i = +el.getAttribute('data-i');
  confirmBox('حذف البند', 'هتشيل "' + esc(S.draft.items[i].name) + '" من عرض السعر.', 'حذف', true).then(function (y) { if (y) { S.draft.items.splice(i, 1); render(); } });
};
ACT.odPickProduct = function () {
  var list = prods().filter(isActive);
  modal({ title: 'اختار منتج', wide: true, body: '<div class="search mb"><input class="inp" id="pp_q" placeholder="ابحث…" data-live="ppq">' + ic('search', 'sm') + '</div><div id="pp_list"></div>' +
    (list.length ? '' : emptyBox('sofa', 'لسه مفيش منتجات في الكتالوج', 'newProduct', 'منتج جديد')),
    mount: function () { ppList(''); } });
};
function ppList(q) {
  var el = document.getElementById('pp_list'); if (!el) return;
  q = String(q || '').toLowerCase();
  var list = prods().filter(function (p) { return isActive(p) && (!q || (p.name + ' ' + (p.category || '')).toLowerCase().indexOf(q) >= 0); });
  el.innerHTML = '<div class="card list" style="box-shadow:none">' + list.map(function (p) {
    return '<div class="li" data-act="odAddProduct" data-p="' + esc(p.id) + '"><div class="avatar">' + initials(p.name) + picImg(p.image_url) + '</div><div class="grow"><div class="main-t">' + esc(p.name) + '</div><div class="faint">' + esc(p.category || '') + ' · ' + p.lines.length + ' سطر · تكلفة ' + money(p.cost.total, 0) + '</div></div><div class="end"><b>' + money(p.selling_price, 0) + '</b>' + (n(p.stock) > 0 ? '<div class="faint pos">جاهز ' + fmt(p.stock, 0) + '</div>' : '') + '</div></div>';
  }).join('') + '</div>';
}
LIVE.ppq = function (t) { ppList(t.value); };
ACT.odAddProduct = function (el) { S.draft.items.push(itemFromProduct(prodById(el.getAttribute('data-p')))); closeModal(); render(); toast('اتضاف — تقدر تعدل المقاسات للعميل من "القطع والمقاسات"', 'ok'); };

function odPayload() {
  var d = S.draft, err = '';
  if (!d.items.length) { toast('ضيف بند واحد على الأقل', 'err'); return null; }
  var items = d.items.map(function (it, i) {
    var lp = ieLinesPayload({ lines: it.lines || [] });
    if (lp.error && !err) err = it.name + ': ' + lp.error;
    var q = parseIn(it.qty), pr = parseIn(it.unit_price);
    if ((!(q >= 1) || Math.floor(q) !== q) && !err) err = it.name + ': الكمية لازم رقم صحيح';
    if (isNaN(pr) && !err) err = it.name + ': السعر غير صحيح';
    return { product_id: it.product_id || '', name: it.name, category: it.category, spec: it.spec, qty: q, unit_price: pr === '' ? 0 : pr, notes: it.notes,
             labor: (it.labor || []).filter(function (x) { return String(x.amount).trim() !== ''; }).map(function (x) { return { kind: x.kind, amount: parseIn(x.amount) }; }),
             lines: lp.lines || [], image_id: it.image_id || '', image: it.image || null, removeImage: !!it.removeImage };
  });
  var disc = parseIn(d.discount);
  if (isNaN(disc)) err = err || 'الخصم غير صحيح';
  if (err) { toast(err, 'err'); return null; }
  var waste = {}; Object.keys(d.waste).forEach(function (k) { var v = parseIn(d.waste[k]); if (v !== '' && !isNaN(v)) waste[k] = v; });
  return { id: d.id, customer: d.customer.id ? { id: d.customer.id } : { name: d.customer.name, phone: d.customer.phone, address: d.customer.address },
    order_date: d.order_date, due_date: d.due_date, discount: disc === '' ? 0 : disc, notes: d.notes, full_sheets: !!d.full_sheets, waste: waste,
    extras: d.extras.filter(function (e) { return String(e.amount).trim() !== ''; }).map(function (e) { return { kind: e.kind || 'مصروف', amount: parseIn(e.amount) }; }),
    items: items };
}
ACT.odSave = function () {
  var pl = odPayload(); if (!pl) return;
  run('saveOrder', pl, { rid: S.draft.rid, ok: 'اتحفظ عرض السعر' }).then(function (r) { if (r) { S.draft = null; go('order', r.result.id); } });
};
ACT.odConfirm = function () {
  var pl = odPayload(); if (!pl) return;
  if (!pl.customer.id && !String(pl.customer.name || '').trim()) return toast('اكتب اسم العميل قبل التأكيد', 'err');
  var tot = draftEstimate(S.draft).total;
  depositModal(tot, function (dep) {
    pl.confirm = true; pl.deposit = dep;
    run('saveOrder', pl, { rid: S.draft.rid }).then(function (r) {
      if (!r) return;
      S.draft = null;
      if (r.result.confirmError) toast('اتحفظ كعرض سعر بس متأكدش: ' + r.result.confirmError, 'err'); else toast('اتأكد الطلب' + (dep ? ' واتسجل العربون' : ''), 'ok');
      go('order', r.result.id);
    });
  });
};
function depositModal(total, cb) {
  modal({ title: 'تأكيد الطلب', body: '<div class="callout info mb">' + ic('shield', 'sm') + '<div>الأسعار والتكلفة المتوقعة هتتثبت دلوقتي — أي تغيير في أسعار الخامات بعد كده مش هيأثر على الطلب ده.</div></div>' +
    kv('إجمالي الطلب', '<b>' + money(total) + '</b>') +
    '<div class="field mt"><label>العربون المدفوع (اختياري)</label><input class="inp ltr" id="dp_amount" inputmode="decimal" placeholder="0"></div>' +
    '<div class="grid g2"><div class="field"><label>طريقة الدفع</label><select class="inp" id="dp_method">' + payOpts() + '</select></div><div class="field"><label>التاريخ</label><input class="inp" type="date" id="dp_date" value="' + esc(today()) + '"></div></div>',
    footer: '<button class="btn btn-ghost" data-act="closeModal">رجوع</button><button class="btn btn-primary" id="dpGo">' + ic('check', 'sm') + 'تأكيد الطلب</button>',
    mount: function () {
      document.getElementById('dpGo').onclick = function () {
        var a = parseIn(val('dp_amount'));
        if (isNaN(a) || a < 0) return toast('اكتب مبلغ العربون صح', 'err');
        if (a > total + 0.01) return toast('العربون أكبر من إجمالي الطلب', 'err');
        var dep = a > 0 ? { amount: a, method: val('dp_method'), date: val('dp_date') } : null;
        closeModal(); cb(dep);
      };
    } });
}

/* ---------- order page ---------- */
var STEPS = [['quote', 'عرض سعر'], ['confirmed', 'مؤكد'], ['production', 'تصنيع'], ['ready', 'جاهز'], ['delivered', 'اتسلم']];
function stepsBar(o) {
  var idx = STEPS.map(function (s) { return s[0]; }).indexOf(o.status);
  return '<div class="steps' + (o.status === 'cancelled' ? ' cancel' : '') + '">' + STEPS.map(function (s, i) { return '<div class="' + (o.status === 'cancelled' ? '' : i < idx ? 'done' : i === idx ? 'cur' : '') + '">' + s[1] + '</div>'; }).join('') + '</div>';
}
function orderMaterials(o) {
  var mm = matMap(), issued = {};
  (o.issued || []).forEach(function (x) { issued[x.material_id] = x; });
  var rows, list = o.status === 'quote' ? (draftEstimateFromOrder(o).materials) : ((o.snapshot && o.snapshot.materials) || []);
  rows = list.map(function (x) { return { m: mm[x.material_id], need: n(x.gross), sheets: x.sheets, issued: issued[x.material_id] ? Math.max(0, issued[x.material_id].qty) : 0 }; });
  Object.keys(issued).forEach(function (k) { if (!list.some(function (x) { return x.material_id === k; }) && Math.abs(issued[k].qty) > 1e-9) rows.push({ m: mm[k], need: 0, issued: issued[k].qty }); });
  return rows;
}
function draftEstimateFromOrder(o) {
  var lbi = {}; (o.lines || []).forEach(function (l) { (lbi[l.item_id] = lbi[l.item_id] || []).push(l); });
  return orderEstimate_({ discount: o.discount, extras: o.extras, waste: o.waste, full_sheets: o.full_sheets },
    (o.items || []).map(function (it) { return { id: it.id, name: it.name, qty: it.qty, unit_price: it.unit_price, labor: it.labor }; }), lbi, matMap(), S.data.settings);
}
VIEWS.order = function (id) {
  var o = orderById(id);
  if (!o) { topbar('الطلب', { back: 'orders' }); return emptyBox('receipt', 'الطلب مش موجود'); }
  var c = custOf(o), st = o.status, open = isOpen(o);
  topbar((st === 'quote' ? 'عرض سعر ' : 'طلب ') + o.order_no, { back: 'orders' });
  var h = '<div class="split"><div>';
  h += '<div class="card pad"><div class="between" style="align-items:flex-start"><div style="min-width:0"><div style="font-size:19px;font-weight:700">' + esc(c.name || 'بدون اسم') + ' <button class="link" style="font-size:13px" data-act="ordInfo" data-p="' + esc(o.id) + '">تعديل</button></div>' +
    (c.phone ? '<div class="row" style="gap:12px">' + telLink(c.phone) + ' <a class="link" target="_blank" rel="noopener" href="' + esc(waLink(c.phone)) + '">واتساب</a></div>' : '') +
    (c.address ? '<div class="faint">' + esc(c.address) + '</div>' : '') + '</div><div style="text-align:left">' + statusBadge(o) + '</div></div>' +
    '<div class="grid g2 mt">' + stat('التاريخ', fmtDate(o.order_date)) + stat('موعد التسليم', o.due_date ? fmtDate(o.due_date) + (isLate(o) ? ' <span class="neg" style="font-size:13px">متأخر</span>' : '') : '<span class="faint">مش متحدد</span>') + '</div>' +
    stepsBar(o) + (o.notes ? '<div class="muted mt">' + esc(o.notes) + '</div>' : '') +
    (st === 'quote' ? '<div class="callout warn mt">' + ic('clock', 'sm') + '<div>لسه عرض سعر — الأرقام تقديرية بأسعار الخامات النهارده.</div></div>' : '') + '</div>';

  // actions
  h += '<div class="actions mt">';
  if (st === 'quote') h += '<button class="btn btn-primary full" data-lockable data-act="ordConfirm" data-p="' + esc(o.id) + '">' + ic('check', 'sm') + 'تأكيد الطلب</button><button class="btn btn-soft" data-act="ordEdit" data-p="' + esc(o.id) + '">' + ic('edit', 'sm') + 'تعديل</button><button class="btn btn-soft" data-act="nav" data-v="doc" data-p="' + esc(o.id) + '">' + ic('receipt', 'sm') + 'عرض السعر للعميل</button>';
  if (open) {
    h += '<button class="btn btn-primary full" data-lockable data-act="ordDeliver" data-p="' + esc(o.id) + '">' + ic('truck', 'sm') + 'تسليم للعميل</button>' +
      '<button class="btn btn-soft" data-act="ordPay" data-p="' + esc(o.id) + '">' + ic('money', 'sm') + 'تسجيل دفعة</button><button class="btn btn-soft" data-act="nav" data-v="doc" data-p="' + esc(o.id) + '">' + ic('receipt', 'sm') + 'الفاتورة</button>' +
      '<button class="btn btn-ghost" data-act="ordIssue" data-p="' + esc(o.id) + '">' + ic('out', 'sm') + 'صرف خامات</button><button class="btn btn-ghost" data-act="ordProduce" data-p="' + esc(o.id) + '">' + ic('saw', 'sm') + 'تسجيل تصنيع</button>';
    if (st === 'confirmed') h += '<button class="btn btn-ghost" data-lockable data-act="ordStatus" data-s="production" data-p="' + esc(o.id) + '">' + ic('play', 'sm') + 'بدأ التصنيع</button>';
    if (st === 'production' || st === 'confirmed') h += '<button class="btn btn-ghost" data-lockable data-act="ordStatus" data-s="ready" data-p="' + esc(o.id) + '">' + ic('flag', 'sm') + 'جاهز للتسليم</button>';
    if (st === 'ready') h += '<button class="btn btn-ghost" data-lockable data-act="ordStatus" data-s="production" data-p="' + esc(o.id) + '">' + ic('undo', 'sm') + 'رجوع للتصنيع</button>';
  }
  if (st === 'delivered') h += '<button class="btn btn-primary" data-act="ordPay" data-p="' + esc(o.id) + '">' + ic('money', 'sm') + 'تسجيل دفعة</button><button class="btn btn-soft" data-act="nav" data-v="doc" data-p="' + esc(o.id) + '">' + ic('receipt', 'sm') + 'الفاتورة</button>';
  if (st !== 'quote' && st !== 'cancelled') h += '<button class="btn btn-ghost" data-act="ordCost" data-p="' + esc(o.id) + '">' + ic('coins', 'sm') + 'تكلفة فعلية</button>';
  h += '<button class="btn btn-ghost" data-act="nav" data-v="cutlist" data-p="' + esc(o.id) + '">' + ic('cut', 'sm') + 'كشف تقطيع</button>';
  if (st !== 'quote' && st !== 'cancelled' && st !== 'delivered') h += '<button class="btn btn-ghost" data-lockable data-act="ordReopen" data-p="' + esc(o.id) + '">' + ic('undo', 'sm') + 'رجوع لعرض سعر</button>';
  if (st === 'cancelled') { h += '<button class="btn btn-soft" data-act="nav" data-v="doc" data-p="' + esc(o.id) + '">' + ic('receipt', 'sm') + 'الفاتورة</button>'; if ((o.issued || []).some(function (x) { return x.qty > 1e-9; })) h += '<button class="btn btn-ghost" data-act="ordReturn" data-p="' + esc(o.id) + '">' + ic('in', 'sm') + 'مرتجع خامات</button>'; }
  if (st !== 'cancelled') h += '<button class="btn btn-ghost full" style="color:var(--bad)" data-lockable data-act="ordCancel" data-p="' + esc(o.id) + '">' + ic('x', 'sm') + 'إلغاء الطلب</button>';
  h += '</div>';

  // items
  h += '<div class="sect"><h2>البنود</h2></div><div class="card">' + (o.items || []).map(function (it) {
    var made = n(it.made_qty), out = n(it.out_item) + n(it.out_product), q = n(it.qty);
    var prog = st === 'quote' || st === 'cancelled' ? '' : '<div class="calc"><span class="badge ' + (made >= q ? 'b-ok' : made > 0 ? 'b-warn' : 'b-gray') + '">اتصنع <span class="num">' + fmt(made, 0) + '/' + fmt(q, 0) + '</span></span>' +
      (out ? '<span class="badge b-ok">اتسلم <span class="num">' + fmt(out, 0) + '</span></span>' : '') +
      (open && made < q ? '<button class="link" data-act="ordProduceItem" data-p="' + esc(o.id) + '" data-i="' + esc(it.id) + '">+ تسجيل تصنيع</button>' : '') + '</div>';
    var uc = st === 'quote' ? null : n(it.est_unit_cost);
    return '<div class="icard"><div class="between"><div style="min-width:0"><b>' + esc(it.name) + '</b>' + (it.spec ? '<div class="faint">' + esc(it.spec) + '</div>' : '') + (it.notes ? '<div class="faint">' + esc(it.notes) + '</div>' : '') + '</div>' +
      '<div style="text-align:left;flex:none"><b>' + money(q * n(it.unit_price), 0) + '</b><div class="faint"><span class="num">' + fmt(q, 0) + '</span> × ' + money(it.unit_price, 0) + '</div>' + (uc !== null ? '<div class="faint">تكلفة القطعة ' + money(uc, 0) + '</div>' : '') + '</div></div>' + prog +
      (it.image_url ? '<img src="' + esc(it.image_url) + '" alt="" style="max-width:160px;border-radius:12px;margin-top:8px;display:block" onerror="this.remove()">' : '') + '</div>';
  }).join('') + '</div>';

  // materials
  var mrows = orderMaterials(o);
  if (mrows.length) h += '<div class="sect"><h2>الخامات</h2>' + (o.full_sheets ? '<span class="badge b-wood">بالألواح الكاملة</span>' : '') + '<span class="grow"></span>' + (open || st === 'delivered' ? '<button class="btn btn-soft btn-sm" data-act="ordIssue" data-p="' + esc(o.id) + '">' + ic('out', 'sm') + 'صرف</button>' : '') +
    ((o.issued || []).some(function (x) { return x.qty > 1e-9; }) ? '<button class="btn btn-ghost btn-sm" data-act="ordReturn" data-p="' + esc(o.id) + '">' + ic('in', 'sm') + 'مرتجع</button>' : '') + '</div>' + needTable(mrows, st === 'quote' ? 'المطلوب للطلب (تقديري)' : 'المطلوب (من التكلفة المثبتة) مقابل اللي اتصرف');

  // production history
  var prods = (S.data.production || []).filter(function (b) { return b.order_id === o.id; });
  if (prods.length) h += '<div class="sect"><h2>التصنيع</h2></div><div class="card list">' + prods.map(prodBatchRow).join('') + '</div>';
  h += '</div><div class="sticky">';

  // money
  h += '<div class="card pad"><b style="font-size:17px">الحساب</b><div class="mt">' + kv('قيمة البنود', money(o.items_total)) + (n(o.discount) ? kv('الخصم', '− ' + money(o.discount)) : '') +
    '<div class="kv total"><span>الإجمالي</span><span>' + money(o.total) + '</span></div>' +
    (st !== 'quote' ? kv('المدفوع', money(o.paid)) + '<div class="kv total big"><span>الباقي على العميل</span><span class="' + (n(o.remaining) > 0.009 ? 'neg' : 'pos') + '">' + money(o.remaining) + '</span></div>' : '') + '</div>';
  var pays = (S.data.payments || []).filter(function (x) { return x.order_id === o.id; });
  if (pays.length) h += '<div class="list mt">' + pays.map(function (x) {
    var v = x.status === 'void';
    return '<div class="li static" style="padding:10px 0"><div class="grow"><b' + (v ? ' style="text-decoration:line-through"' : '') + '>' + (PAYKIND_AR[x.kind] || '') + ' ' + money(Math.abs(x.amount)) + '</b><div class="faint">' + fmtDate(x.pay_date) + ' · ' + (PAY_AR[x.method] || '') + ' · <span class="num">' + esc(x.receipt_no) + '</span>' + (v ? ' · ملغية' : '') + '</div></div>' +
      (!v ? '<button class="btn btn-ghost btn-sm" data-act="nav" data-v="receipt" data-p="' + esc(x.id) + '">إيصال</button><button class="iconbtn sm" data-act="voidPay" data-p="' + esc(x.id) + '" aria-label="إلغاء">' + ic('x', 'sm') + '</button>' : '') + '</div>';
  }).join('') + '</div>';
  h += '</div>';

  // estimated vs actual
  h += '<div class="card pad mt"><b style="font-size:17px">الربح: المتوقع مقابل الفعلي</b><div class="vs mt"><span></span><span class="h">المتوقع</span><span class="h">' + (st === 'delivered' ? 'الفعلي' : 'الفعلي لحد دلوقتي') + '</span>' +
    vsRow('خامات', o.est_material, st === 'quote' ? null : o.act_material) + vsRow('مصنعية وشغل بره', o.est_labor, null) + vsRow('مصاريف الطلب', o.est_extra, null) +
    vsRow('تكاليف فعلية مسجلة', null, st === 'quote' ? null : o.act_costs) +
    '<span class="k tot">إجمالي التكلفة</span><span class="v tot">' + money(o.est_cost, 0) + '</span><span class="v tot">' + (st === 'quote' ? '—' : money(o.act_cost, 0)) + '</span>' +
    '<span class="k tot">الربح</span><span class="v tot ' + profitCls(o.est_profit) + '">' + money(o.est_profit, 0) + '</span><span class="v tot ' + (st === 'quote' ? '' : profitCls(o.act_profit)) + '">' + (st === 'quote' ? '—' : money(o.act_profit, 0)) + '</span>' +
    '<span class="k">الهامش</span><span class="v">' + pct(o.est_margin) + '</span><span class="v">' + (st === 'quote' ? '—' : pct(o.act_margin)) + '</span></div>' +
    (st !== 'quote' ? '<div class="faint mt">الفعلي = الخامات اللي اتصرفت فعلًا (بمتوسط سعرها وقت الصرف) + التكاليف اللي سجلتها على الطلب.' + (o.snapshot ? '' : '') + '</div>' : '') + '</div>';
  var costs = (S.data.order_costs || []).filter(function (x) { return x.order_id === o.id; });
  if (st !== 'quote') h += '<div class="card pad mt"><div class="between"><b>تكاليف فعلية على الطلب</b>' + (st !== 'cancelled' ? '<button class="link" data-act="ordCost" data-p="' + esc(o.id) + '">+ إضافة</button>' : '') + '</div>' +
    (costs.length ? '<div class="list mt">' + costs.map(function (x) {
      var v = x.status === 'void';
      return '<div class="li static" style="padding:9px 0"><div class="grow"><b' + (v ? ' style="text-decoration:line-through"' : '') + '>' + esc(x.kind) + ' ' + money(x.amount) + '</b><div class="faint">' + fmtDate(x.cost_date) + (x.paid_to ? ' · ' + esc(x.paid_to) : '') + (x.notes ? ' · ' + esc(x.notes) : '') + (v ? ' · ملغية' : '') + '</div></div>' +
        (!v ? '<button class="iconbtn sm" data-act="voidCost" data-p="' + esc(x.id) + '" aria-label="إلغاء">' + ic('x', 'sm') + '</button>' : '') + '</div>';
    }).join('') + '</div>' : '<div class="faint mt">سجّل هنا المصنعية والتنجيد والدهان والنقل اللي اتدفعوا فعلًا.</div>') + '</div>';
  h += '</div></div>';
  return h;
};
function vsRow(k, a, b) { return '<span class="k">' + k + '</span><span class="v">' + (a === null ? '—' : money(a, 0)) + '</span><span class="v">' + (b === null ? '—' : money(b, 0)) + '</span>'; }

/* ---------- order actions ---------- */
ACT.ordConfirm = function (el) {
  var o = orderById(el.getAttribute('data-p')), r0 = rid();
  if (!o.customer_id) return toast('حدد العميل الأول (تعديل)', 'err');
  depositModal(o.total, function (dep) { run('confirmOrder', { id: o.id, deposit: dep }, { rid: r0, ok: 'اتأكد الطلب' + (dep ? ' واتسجل العربون' : '') }).then(function (r) { if (r) render(); }); });
};
ACT.ordStatus = function (el) {
  var id = el.getAttribute('data-p'), s = el.getAttribute('data-s');
  run('setOrderStatus', { id: id, status: s }, { ok: s === 'ready' ? 'الطلب جاهز للتسليم' : 'تم' }).then(function (r) { if (r) render(); });
};
ACT.ordReopen = function (el) {
  var id = el.getAttribute('data-p');
  confirmBox('رجوع لعرض سعر', 'التكلفة المثبتة هتتشال وهتقدر تعدل البنود والأسعار، وبعدها تأكده تاني. ده متاح بس لو مفيش خامات اتصرفت أو تصنيع اتسجل.', 'رجوع لعرض سعر', true)
    .then(function (y) { if (y) run('setOrderStatus', { id: id, status: 'quote' }, { ok: 'رجع عرض سعر' }).then(function (r) { if (r) render(); }); });
};
ACT.ordDeliver = function (el) {
  var o = orderById(el.getAttribute('data-p')), r0 = rid();
  var rem = n(o.remaining) > 0.009 ? '<div class="callout warn mt">' + ic('alert', 'sm') + '<div>لسه على العميل <b>' + money(o.remaining) + '</b> — التسليم مسموح، والمبلغ هيفضل ظاهر في الحسابات.</div></div>' : '';
  modal({ title: 'تسليم الطلب ' + o.order_no, body: '<div class="muted">القطع الجاهزة هتخرج من مخزن المنتجات والطلب هيتسجل "تم التسليم".</div>' + rem +
    '<div class="field mt"><label>تاريخ التسليم</label><input class="inp" type="date" id="dl_date" value="' + esc(today()) + '"></div>',
    footer: '<button class="btn btn-ghost" data-act="closeModal">رجوع</button><button class="btn btn-primary" data-lockable id="dlGo">' + ic('truck', 'sm') + 'تم التسليم</button>',
    mount: function () {
      document.getElementById('dlGo').onclick = function () {
        var date = val('dl_date');
        run('deliverOrder', { id: o.id, date: date }, { rid: r0, ok: 'اتسلم الطلب', onErr: function (e) {
          if (e.code === 'ITEM_SHORT') { deliverShort(o, e, date); return true; }
          if (e.code === 'MATERIAL_SHORT') { showShort(e); return true; }
        } }).then(function (r) { if (r) { closeModal(); render(); } });
      };
    } });
};
function deliverShort(o, e, date) {
  var r1 = rid();
  modal({ title: 'في قطع لسه متسجلش تصنيعها', body: '<div class="callout warn mb">' + ic('alert', 'sm') + '<div>القطع دي مش متسجلة إنها اتصنعت:</div></div>' + shortTable(e.details) +
    '<div class="callout info mt">' + ic('saw', 'sm') + '<div>"سجّل التصنيع وسلّم" هيصرف خاماتها من المخزن حسب المقاسات (بعد ما يتأكد إن الخامات كلها كفاية — لو مش كفاية مش هيتكتب أي حاجة) وبعدين يسلّم.</div></div>',
    footer: '<button class="btn btn-ghost" data-act="closeModal">رجوع</button><button class="btn btn-primary" data-lockable id="psGo">' + ic('saw', 'sm') + 'سجّل التصنيع وسلّم</button>',
    mount: function () {
      document.getElementById('psGo').onclick = function () {
        run('deliverOrder', { id: o.id, date: date, produce: true }, { rid: r1, ok: 'اتسجل التصنيع واتسلم الطلب', onErr: function (e2) { if (e2.code === 'MATERIAL_SHORT') { showShort(e2, 'الخامات مش كفاية للقطع الناقصة'); return true; } } })
          .then(function (r) { if (r) { closeModal(); render(); } });
      };
    } });
}
ACT.ordCancel = function (el) {
  var o = orderById(el.getAttribute('data-p')), r0 = rid(), paid = n(o.paid);
  modal({ title: 'إلغاء الطلب ' + o.order_no, body: '<div class="muted">الطلب هيتلغي ومش هيتحسب في المبيعات والأرباح، والفاتورة هتاخد ختم CANCELLED.</div>' +
    (o.status === 'delivered' ? '<div class="callout info mt">' + ic('box', 'sm') + '<div>القطع اللي اتسلمت هترجع مخزن المنتجات (مرة واحدة بس).</div></div>' : '') +
    (paid > 0 ? '<div class="callout warn mt">' + ic('money', 'sm') + '<div>العميل دفع <b>' + money(paid) + '</b>. لو رجّعتله فلوس اكتب المبلغ، ولو العربون اتحجز سيبها صفر.</div></div>' +
      '<div class="grid g2 mt"><div class="field"><label>المبلغ اللي اترد</label><input class="inp ltr" id="cn_amount" inputmode="decimal" value="' + paid + '"></div><div class="field"><label>طريقة الرد</label><select class="inp" id="cn_method">' + payOpts() + '</select></div></div>' : ''),
    footer: '<button class="btn btn-ghost" data-act="closeModal">رجوع</button><button class="btn btn-danger" data-lockable id="cnGo">' + ic('x', 'sm') + 'إلغاء الطلب</button>',
    mount: function () {
      document.getElementById('cnGo').onclick = function () {
        var a = paid > 0 ? parseIn(val('cn_amount')) : 0;
        if (isNaN(a) || a < 0 || a > paid + 0.001) return toast('المبلغ المردود لازم يكون بين صفر و ' + fmt(paid), 'err');
        run('cancelOrder', { id: o.id, refund: a > 0 ? { amount: a, method: val('cn_method') } : null }, { rid: r0, ok: 'اتلغى الطلب' }).then(function (r) { if (r) { closeModal(); render(); } });
      };
    } });
};
ACT.ordPay = function (el) {
  var o = orderById(el.getAttribute('data-p')), r0 = rid();
  modal({ title: 'تسجيل دفعة — ' + o.order_no, body: kv('الباقي على العميل', '<b>' + money(o.remaining) + '</b>') +
    '<div class="field mt"><label>المبلغ</label><input class="inp ltr" id="py_amount" inputmode="decimal" value="' + (n(o.remaining) > 0 ? n(o.remaining) : '') + '"></div>' +
    '<div class="grid g2"><div class="field"><label>طريقة الدفع</label><select class="inp" id="py_method">' + payOpts() + '</select></div><div class="field"><label>التاريخ</label><input class="inp" type="date" id="py_date" value="' + esc(today()) + '"></div></div>' +
    '<div class="field"><label>ملاحظات</label><input class="inp" id="py_notes" maxlength="200"></div>',
    footer: footer('savePay', 'تسجيل الدفعة', 'money'), mount: function () { S.py = { order_id: o.id, rid: r0 }; } });
};
ACT.savePay = function () {
  var a = parseIn(val('py_amount'));
  if (!(a > 0)) return toast('اكتب المبلغ', 'err');
  run('addPayment', { order_id: S.py.order_id, amount: a, method: val('py_method'), date: val('py_date'), notes: val('py_notes'), kind: 'payment' }, { rid: S.py.rid, ok: 'اتسجلت الدفعة' })
    .then(function (r) {
      if (!r) return;
      var pid = r.result.id;
      modal({ title: 'اتسجلت الدفعة', body: '<div class="callout ok">' + ic('check', 'sm') + '<div>تحب تبعت للعميل إيصال استلام على واتساب؟</div></div>',
        footer: '<button class="btn btn-ghost" data-act="closeModal">لا شكرًا</button><button class="btn btn-primary" data-act="nav" data-v="receipt" data-p="' + esc(pid) + '">' + ic('receipt', 'sm') + 'الإيصال</button>' });
      render();
    });
};
ACT.voidPay = function (el) {
  var id = el.getAttribute('data-p');
  confirmBox('إلغاء الدفعة', 'الدفعة هتتلغي والمبلغ هيرجع على العميل في الحساب. استخدمها لو الدفعة اتسجلت غلط.', 'إلغاء الدفعة', true)
    .then(function (y) { if (y) run('voidPayment', { id: id }, { ok: 'اتلغت الدفعة' }).then(function (r) { if (r) render(); }); });
};
ACT.ordCost = function (el) {
  var o = orderById(el.getAttribute('data-p')), r0 = rid();
  modal({ title: 'تكلفة فعلية على ' + o.order_no, body: '<div class="field"><label>البند</label><select class="inp" id="oc_kind">' + selOpts(costKinds(), costKinds()[0]) + '</select></div>' +
    '<div class="grid g2"><div class="field"><label>المبلغ</label><input class="inp ltr" id="oc_amount" inputmode="decimal"></div><div class="field"><label>التاريخ</label><input class="inp" type="date" id="oc_date" value="' + esc(today()) + '"></div></div>' +
    '<div class="field"><label>اتدفع لمين (اختياري)</label><input class="inp" id="oc_to" maxlength="60" placeholder="الأسطى / المنجّد / الدهّان…"></div><div class="field"><label>ملاحظات</label><input class="inp" id="oc_notes" maxlength="200"></div>',
    footer: footer('saveCost'), mount: function () { S.oc = { order_id: o.id, rid: r0 }; } });
};
ACT.saveCost = function () {
  var a = parseIn(val('oc_amount'));
  if (!(a > 0)) return toast('اكتب المبلغ', 'err');
  run('addOrderCost', { order_id: S.oc.order_id, kind: val('oc_kind'), amount: a, date: val('oc_date'), paid_to: val('oc_to'), notes: val('oc_notes') }, { rid: S.oc.rid, ok: 'اتسجلت التكلفة' })
    .then(function (r) { if (r) { closeModal(); render(); } });
};
ACT.voidCost = function (el) {
  var id = el.getAttribute('data-p');
  confirmBox('إلغاء التكلفة', 'التكلفة دي هتتشال من الحساب الفعلي للطلب.', 'إلغاء', true).then(function (y) { if (y) run('voidOrderCost', { id: id }, { ok: 'اتلغت' }).then(function (r) { if (r) render(); }); });
};
ACT.ordInfo = function (el) {
  var o = orderById(el.getAttribute('data-p')), c = custOf(o), r0 = rid();
  modal({ title: 'بيانات العميل والموعد', body: '<div class="field"><label>العميل</label><select class="inp" id="oi_cust"><option value="">— عميل جديد —</option>' +
      (S.data.customers || []).filter(function (x) { return isActive(x) || x.id === o.customer_id; }).map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === o.customer_id ? ' selected' : '') + '>' + esc(x.name) + (x.phone ? ' — ' + esc(x.phone) : '') + '</option>'; }).join('') + '</select></div>' +
    '<div id="oi_new" class="' + (o.customer_id ? 'hide' : '') + '"><div class="grid g2"><div class="field"><label>الاسم</label><input class="inp" id="oi_name" maxlength="60"></div><div class="field"><label>التليفون</label><input class="inp ltr" id="oi_phone" type="tel" maxlength="25"></div></div><div class="field"><label>العنوان</label><input class="inp" id="oi_addr" maxlength="150"></div></div>' +
    (o.customer_id ? '<div class="faint mb">لتعديل اسم أو تليفون العميل نفسه: من صفحة <button class="link" data-act="nav" data-v="customer" data-p="' + esc(o.customer_id) + '">العميل</button>.</div>' : '') +
    '<div class="field"><label>موعد التسليم</label><input class="inp" type="date" id="oi_due" value="' + esc(o.due_date || '') + '"></div>' +
    '<div class="field"><label>ملاحظات</label><textarea class="inp" id="oi_notes" maxlength="500">' + esc(o.notes || '') + '</textarea></div>',
    footer: footer('saveOrdInfo'),
    mount: function () {
      S.oi = { id: o.id, rid: r0 };
      document.getElementById('oi_cust').onchange = function (e) { document.getElementById('oi_new').classList.toggle('hide', !!e.target.value); };
    } });
};
ACT.saveOrdInfo = function () {
  var cid = val('oi_cust'), cust = cid ? { id: cid } : { name: val('oi_name'), phone: val('oi_phone'), address: val('oi_addr') };
  if (!cid && !String(cust.name).trim()) return toast('اكتب اسم العميل', 'err');
  run('updateOrderInfo', { id: S.oi.id, customer: cust, due_date: val('oi_due'), notes: val('oi_notes') }, { rid: S.oi.rid, ok: 'اتحفظ' }).then(function (r) { if (r) { closeModal(); render(); } });
};

/* ----- issue / return materials (صرف على أوردر / مرتجع) ----- */
ACT.ordIssue = function (el) {
  var o = orderById(el.getAttribute('data-p')), rows = orderMaterials(o).filter(function (r) { return r.need > 0; });
  var lines = rows.map(function (r) {
    var rem = Math.max(0, r.need - r.issued), m = r.m, u = displayUnit_(m);
    return { material_id: m.id, qty: rem > 1e-9 ? +(rem / unitFactor_(u, m)).toFixed(m.mtype === 'solid' ? 4 : 3) : '', unit: u };
  });
  if (!lines.length) lines.push({ material_id: '', qty: '', unit: '' });
  matLinesModal({ title: 'صرف خامات على ' + o.order_no, intro: 'الكميات متعبية بالباقي من المطلوب (بالهالك). عدّلها حسب اللي اتصرف فعلًا من المخزن.', lines: lines,
    button: 'صرف من المخزن', action: function (payload, r0) {
      run('issueMaterials', { order_id: o.id, lines: payload, date: val('ml_date') }, { rid: r0, ok: 'اتصرفت الخامات على الطلب', onErr: function (e) { if (e.code === 'MATERIAL_SHORT') { showShort(e); return true; } } })
        .then(function (r) { if (r) { closeModal(); render(); } });
    } });
};
ACT.ordReturn = function (el) {
  var o = orderById(el.getAttribute('data-p')), mm = matMap();
  var lines = (o.issued || []).filter(function (x) { return x.qty > 1e-9 && mm[x.material_id]; }).map(function (x) { return { material_id: x.material_id, qty: '', unit: displayUnit_(mm[x.material_id]), max: x.qty }; });
  matLinesModal({ title: 'مرتجع خامات من ' + o.order_no, intro: 'الخامة بترجع المخزن بنفس تكلفة صرفها على الطلب.', lines: lines, fixed: true,
    button: 'رجّع للمخزن', action: function (payload, r0) {
      run('returnMaterials', { order_id: o.id, lines: payload, date: val('ml_date') }, { rid: r0, ok: 'رجعت الخامات للمخزن' }).then(function (r) { if (r) { closeModal(); render(); } });
    } });
};
/** Editable list of materials with quantity + unit. opts: {title, intro, lines:[{material_id, qty, unit, max}], fixed, button, action(payload, rid), extraTop} */
function matLinesModal(opts) {
  S.ml = { lines: opts.lines.map(function (l) { return Object.assign({}, l); }), fixed: !!opts.fixed, rid: rid(), opts: opts };
  modal({ title: opts.title, wide: true, body: (opts.extraTop || '') + '<div class="faint mb">' + esc(opts.intro || '') + '</div><div id="ml_rows"></div>' +
    (opts.fixed ? '' : '<button class="link mt" data-act="mlAdd">+ خامة تانية</button>') +
    '<div class="field mt"><label>التاريخ</label><input class="inp" type="date" id="ml_date" value="' + esc(today()) + '"></div>',
    footer: '<button class="btn btn-ghost" data-act="closeModal">رجوع</button><button class="btn btn-primary" data-lockable data-act="mlGo">' + ic('check', 'sm') + esc(opts.button) + '</button>',
    mount: mlRender, noFocus: true });
}
function mlRender() {
  var box = document.getElementById('ml_rows'); if (!box) return;
  box.innerHTML = S.ml.lines.map(function (l, i) {
    var m = matById(l.material_id);
    return '<div class="piece mb"><div class="pr"><div><label>الخامة</label>' + (S.ml.fixed ? '<input class="inp sm" readonly value="' + esc(m ? matLabel(m) : '') + '">' : '<select class="inp sm" data-change="mlMat" data-i="' + i + '">' + matOptions(l.material_id) + '</select>') + '</div>' +
      '<div><label>الكمية</label><div class="combo"><input class="inp sm ltr" inputmode="decimal" data-live="ml" data-i="' + i + '" value="' + esc(l.qty) + '"><select class="inp sm" style="flex:0 0 120px" data-change="mlUnit" data-i="' + i + '">' + (m ? unitOpts(m, l.unit) : '') + '</select></div></div></div>' +
      '<div class="foot"><span class="grow faint">' + (m ? 'في المخزن: ' + qtyM(m.stock, m) + (l.max !== undefined ? ' · اتصرف على الطلب: ' + qtyM(l.max, m) : '') : '') + '</span>' + (S.ml.fixed ? '' : '<button class="iconbtn sm" data-act="mlDel" data-i="' + i + '">' + ic('trash', 'sm') + '</button>') + '</div></div>';
  }).join('');
}
LIVE.ml = function (t) { S.ml.lines[+t.getAttribute('data-i')].qty = t.value; };
CHANGE.mlMat = function (t) { var l = S.ml.lines[+t.getAttribute('data-i')]; l.material_id = t.value; var m = matById(t.value); l.unit = m ? displayUnit_(m) : ''; mlRender(); };
CHANGE.mlUnit = function (t) { S.ml.lines[+t.getAttribute('data-i')].unit = t.value; };
ACT.mlAdd = function () { S.ml.lines.push({ material_id: '', qty: '', unit: '' }); mlRender(); };
ACT.mlDel = function (el) { S.ml.lines.splice(+el.getAttribute('data-i'), 1); mlRender(); };
ACT.mlGo = function () {
  var out = [], err = '';
  S.ml.lines.forEach(function (l) {
    var q = parseIn(l.qty);
    if (q === '' || q === 0) return;
    if (isNaN(q) || q < 0) { err = 'راجع الكميات'; return; }
    if (!l.material_id) { err = 'اختار الخامة'; return; }
    out.push({ material_id: l.material_id, qty: q, unit: l.unit });
  });
  if (err) return toast(err, 'err');
  if (!out.length && !S.ml.opts.allowEmpty) return toast('اكتب كمية لخامة واحدة على الأقل', 'err');
  S.ml.opts.action(out, S.ml.rid);
};

/* ----- production from the order page ----- */
ACT.ordProduce = function (el) {
  var o = orderById(el.getAttribute('data-p'));
  var it = (o.items || []).find(function (x) { return n(x.made_qty) < n(x.qty); });
  if (!it) return toast('كل البنود اتسجل تصنيعها', 'ok');
  produceItemModal(o, it);
};
ACT.ordProduceItem = function (el) {
  var o = orderById(el.getAttribute('data-p')), it = (o.items || []).find(function (x) { return x.id === el.getAttribute('data-i'); });
  produceItemModal(o, it);
};
function itemMaterials(o, it, k) {
  var lines = (o.lines || []).filter(function (l) { return l.item_id === it.id; });
  var waste = (o.snapshot && o.snapshot.waste) || o.waste || {};
  return materialsForUnits_(lines, k, matMap(), S.data.settings, waste).map(function (x) {
    var m = matById(x.material_id), u = displayUnit_(m);
    return { material_id: x.material_id, qty: +(x.qty / unitFactor_(u, m)).toFixed(m.mtype === 'solid' ? 4 : 3), unit: u };
  });
}
function produceItemModal(o, it) {
  var remain = n(it.qty) - n(it.made_qty);
  var anyIssued = (o.issued || []).some(function (x) { return x.qty > 1e-9; });
  var sel = '<div class="field"><label>البند</label><select class="inp" id="pi_item" data-change="piItem">' + (o.items || []).filter(function (x) { return n(x.made_qty) < n(x.qty); }).map(function (x) {
    return '<option value="' + esc(x.id) + '"' + (x.id === it.id ? ' selected' : '') + '>' + esc(x.name) + ' (باقي ' + fmt(n(x.qty) - n(x.made_qty), 0) + ')</option>'; }).join('') + '</select></div>' +
    '<div class="grid g2"><div class="field"><label>عدد القطع اللي خلصت</label><input class="inp ltr" id="pi_qty" inputmode="numeric" value="' + remain + '" data-live="piQty"></div>' +
    '<div class="field"><label>&nbsp;</label><label class="switch" style="height:48px"><input type="checkbox" id="pi_take" data-change="piTake"' + (anyIssued ? '' : ' checked') + '>اصرف خاماتها دلوقتي</label></div></div>' +
    (anyIssued ? '<div class="callout info mb">' + ic('out', 'sm') + '<div>في خامات اتصرفت على الطلب قبل كده — علشان كده "اصرف خاماتها" مقفول. فعّله لو محتاج تصرف زيادة.</div></div>' : '');
  S.pi = { order_id: o.id, item_id: it.id, take: !anyIssued };
  matLinesModal({ title: 'تسجيل تصنيع — ' + o.order_no, intro: 'الخامات متعبية من مقاسات القطع (بالهالك) — عدّلها حسب اللي اتصرف فعلًا.', extraTop: sel,
    lines: !anyIssued ? itemMaterials(o, it, remain) : [], button: 'تسجيل التصنيع',
    action: function (payload, r0) {
      var q = parseIn(val('pi_qty'));
      if (!(q >= 1) || Math.floor(q) !== q) return toast('اكتب عدد قطع صحيح', 'err');
      run('recordProduction', { target: 'order', item_id: S.pi.item_id, qty: q, materials: S.pi.take ? payload : [], date: val('ml_date') }, { rid: r0, ok: 'اتسجل التصنيع', onErr: function (e) { if (e.code === 'MATERIAL_SHORT') { showShort(e); return true; } } })
        .then(function (r) { if (r) { closeModal(); render(); } });
    } });
  S.ml.opts.allowEmpty = true;
  if (!S.pi.take) document.getElementById('ml_rows').classList.add('hide');
}
function piRefill() {
  var o = orderById(S.pi.order_id), it = (o.items || []).find(function (x) { return x.id === S.pi.item_id; }), q = parseIn(val('pi_qty'));
  S.ml.lines = S.pi.take && q > 0 ? itemMaterials(o, it, q) : [];
  mlRender(); document.getElementById('ml_rows').classList.toggle('hide', !S.pi.take);
}
CHANGE.piItem = function (t) {
  S.pi.item_id = t.value;
  var o = orderById(S.pi.order_id), it = (o.items || []).find(function (x) { return x.id === t.value; });
  document.getElementById('pi_qty').value = n(it.qty) - n(it.made_qty); piRefill();
};
LIVE.piQty = function () { piRefill(); };
CHANGE.piTake = function (t) { S.pi.take = t.checked; piRefill(); };

function prodBatchRow(b) {
  var v = b.status === 'reversed';
  return '<div class="li static"><div class="avatar no">' + esc(b.batch_no) + '</div><div class="grow"><div class="main-t"' + (v ? ' style="text-decoration:line-through"' : '') + '>' + esc(b.name) + ' × <span class="num">' + fmt(b.qty, 0) + '</span></div>' +
    '<div class="faint">' + fmtDate(b.prod_date) + ' · ' + (b.target === 'order' ? 'لطلب ' + esc((orderById(b.order_id) || {}).order_no || '') : 'للمخزن') + (v ? ' · ملغي' : '') + '</div></div>' +
    '<div class="end"><div style="font-weight:700">' + money(b.material_cost, 0) + '</div><div class="faint">خامات</div>' + (!v ? '<button class="link faint" data-act="revProduction" data-p="' + esc(b.id) + '">إلغاء</button>' : '') + '</div></div>';
}
ACT.revProduction = function (el) {
  var id = el.getAttribute('data-p');
  confirmBox('إلغاء التصنيع', 'الخامات هترجع المخزن بنفس تكلفتها، وعدد القطع الجاهزة هيقل.', 'إلغاء التصنيع', true)
    .then(function (y) { if (y) run('reverseProduction', { id: id }, { ok: 'اتلغى التصنيع' }).then(function (r) { if (r) render(); }); });
};
