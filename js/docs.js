/* Customer documents: quotation / invoice, payment receipt, workshop cut list. PDF + WhatsApp. No costs on customer documents. */

function docHead(title, sub, stampKey) {
  var st = STAMP[stampKey];
  return '<div class="band"></div><div class="doc-head"><img class="doc-logo" src="logo-full.png" alt="' + esc(bizName()) + '">' +
    '<div class="doc-brand"><div class="title">' + esc(title) + '</div><div class="t">' + esc(bizName()) + (setting('phone', '') ? ' · <span class="num">' + esc(setting('phone')) + '</span>' : '') + '</div>' +
    (setting('address', '') ? '<div class="t">' + esc(setting('address')) + '</div>' : '') + (sub ? '<div class="t">' + sub + '</div>' : '') + '</div>' +
    (st ? '<div class="stamp s-' + esc(stampKey) + '"><i></i><b>' + st[0] + '</b><span>' + st[1] + '</span></div>' : '') + '</div>';
}
function imoney(v) { return '<span class="num">' + fmt(v, 2) + '</span> ج.م'; }
function docActions(kind, id, phone) {
  return '<div class="doc-actions"><button class="btn wa" data-act="docWhatsApp" data-k="' + kind + '" data-p="' + esc(id) + '">' + WA_ICON + (phone ? 'ابعت PDF على واتساب العميل' : 'ضيف رقم العميل عشان تبعت على واتساب') + '</button>' +
    '<button class="btn btn-primary" data-act="docShare" data-k="' + kind + '" data-p="' + esc(id) + '">' + ic('copy', 'sm') + 'مشاركة PDF</button>' +
    '<button class="btn btn-soft" data-act="docPdf" data-k="' + kind + '" data-p="' + esc(id) + '">' + ic('save', 'sm') + 'حفظ PDF</button>' +
    '<button class="btn btn-ghost" data-act="docImg" data-k="' + kind + '" data-p="' + esc(id) + '">' + ic('image', 'sm') + 'حفظ صورة</button>' +
    '<button class="btn btn-ghost" data-act="docPrint">' + ic('receipt', 'sm') + 'طباعة</button></div>';
}

/* ---------- quotation / invoice ---------- */
VIEWS.doc = function (id) {
  var o = orderById(id);
  if (!o) { topbar('الفاتورة', { back: 'orders' }); return emptyBox('receipt', 'الطلب مش موجود'); }
  var c = custOf(o), quote = o.status === 'quote', paidOff = !quote && o.status !== 'cancelled' && n(o.total) > 0 && n(o.remaining) <= 0.009;
  topbar((quote ? 'عرض سعر ' : 'فاتورة ') + o.order_no, { back: 'order', backP: o.id });
  var h = '<div class="doc-wrap">' + docActions('order', o.id, c.phone) + '<div class="doc" id="doc">' + docHead(quote ? 'عرض سعر' : 'فاتورة', '', o.status);
  h += '<div class="doc-info"><div><small>' + (quote ? 'رقم العرض' : 'رقم الفاتورة') + '</small><b class="num">' + nb(o.order_no) + '</b></div><div><small>التاريخ</small><b>' + docDate(o.order_date) + '</b></div>' +
    '<div><small>موعد التسليم</small><b>' + (o.due_date ? docDate(o.due_date) : '—') + '</b></div>' +
    '<div style="grid-column:1/-1"><small>العميل</small><b>' + esc(c.name || '—') + '</b>' + (c.phone ? ' <span class="num" style="font-size:13px;color:var(--ink-2)">' + esc(c.phone) + '</span>' : '') + (c.address ? '<div style="font-size:13px;color:var(--ink-2)">' + esc(c.address) + '</div>' : '') + '</div>' +
    (o.title ? '<div style="grid-column:1/-1"><small>الطلب</small><b>' + esc(o.title) + '</b></div>' : '') + '</div>';
  h += itemsTable(o);
  var agreed = hasAgreed_(o), diff = n(o.items_total) - n(o.total);
  h += '<div class="doc-sum">' + (!agreed ? kv('إجمالي البنود', imoney(o.items_total)) + (n(o.discount) ? kv('خصم', '− ' + imoney(o.discount)) : '') : (n(o.items_total) > 0 && diff > 0.009 ? kv('إجمالي البنود', imoney(o.items_total)) + kv('خصم', '− ' + imoney(diff)) : '')) +
    '<div class="doc-total' + (o.status === 'cancelled' ? ' void' : '') + '"><span>' + (agreed ? 'الإجمالي المتفق عليه' : 'الإجمالي') + '</span><span>' + imoney(o.total) + '</span></div>';
  if (!quote) h += kv('المدفوع', imoney(o.paid)) + '<div class="doc-due' + (n(o.remaining) <= 0.009 ? ' zero' : '') + '"><span>' + (n(o.remaining) < -0.009 ? 'ليه عندنا' : 'الباقي') + '</span><span>' + imoney(Math.abs(n(o.remaining))) + '</span></div>';
  h += '</div>' + (paidOff ? '<div class="paid-mark">PAID</div>' : '');
  if (o.notes) h += '<div class="doc-note"><b>تفاصيل الاتفاق:</b> ' + esc(o.notes) + '</div>';
  var note = quote ? setting('quote_note', '') : '';
  if (note) h += '<div class="doc-note">' + esc(note) + '</div>';
  h += '<div class="doc-foot">' + esc(setting('invoice_note', 'شكرًا لثقتكم')) + '</div></div></div>';
  return h;
};
/** Items on customer documents; the price columns appear only when items have their own prices. */
function itemsTable(o) {
  var priced = (o.items || []).some(function (it) { return n(it.unit_price) > 0; });
  return '<table class="t doc-table"><thead><tr><th>البند</th><th class="n">العدد</th>' + (priced ? '<th class="n">السعر</th><th class="n">الإجمالي</th>' : '') + '</tr></thead><tbody>' + (o.items || []).map(function (it) {
    return '<tr><td><b>' + esc(it.name) + '</b>' + (it.spec ? '<div style="font-size:12.5px;color:var(--ink-2)">' + esc(it.spec) + '</div>' : '') + '</td><td class="n num">' + fmt(it.qty, 0) + '</td>' +
      (priced ? '<td class="n">' + (n(it.unit_price) > 0 ? imoney(it.unit_price) : '—') + '</td><td class="n">' + (n(it.unit_price) > 0 ? imoney(n(it.qty) * n(it.unit_price)) : '—') + '</td>' : '') + '</tr>';
  }).join('') + '</tbody></table>';
}
function orderSig(o) {
  var c = custOf(o);
  return hashStr(JSON.stringify([o.status, o.total, o.paid, o.discount, o.agreed_total, o.title, o.notes, o.order_date, o.due_date, c.name, c.phone, c.address, (o.items || []).map(function (i) { return [i.name, i.spec, i.qty, i.unit_price]; }),
    bizName(), setting('phone', ''), setting('address', ''), setting('quote_note', ''), setting('invoice_note', '')]));
}
function hashStr(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return 'h' + (h >>> 0).toString(36) + s.length.toString(36); }

/* ---------- payment receipt ---------- */
VIEWS.receipt = function (id) {
  var x = (S.data.payments || []).find(function (p) { return p.id === id; });
  if (!x) { topbar('الإيصال', { back: 'orders' }); return emptyBox('receipt', 'الدفعة مش موجودة'); }
  var o = orderById(x.order_id) || {}, c = custOf(o), r = receiptNumbers(x, o), refund = n(x.amount) < 0, v = x.status === 'void';
  topbar('إيصال ' + x.receipt_no, { back: 'order', backP: o.id });
  var h = '<div class="doc-wrap">' + docActions('receipt', x.id, c.phone) + '<div class="doc" id="doc">' + docHead(refund ? 'إيصال رد مبلغ' : 'إيصال استلام', '', v ? 'cancelled' : null);
  h += '<div class="doc-info"><div><small>رقم الإيصال</small><b class="num">' + esc(x.receipt_no) + '</b></div><div><small>التاريخ</small><b>' + docDate(x.pay_date) + '</b></div><div><small>رقم الطلب</small><b class="num">' + esc(o.order_no || '') + '</b></div>' +
    '<div style="grid-column:1/-1"><small>' + (refund ? 'اترد إلى' : 'استلمنا من') + '</small><b>' + esc(c.name || '—') + '</b>' + (c.phone ? ' <span class="num" style="font-size:13px;color:var(--ink-2)">' + esc(c.phone) + '</span>' : '') + '</div></div>';
  h += '<div class="doc-total' + (v ? ' void' : '') + '" style="font-size:22px;padding:16px 18px"><span>' + (PAYKIND_AR[x.kind] || 'مبلغ') + '</span><span>' + imoney(Math.abs(x.amount)) + '</span></div>';
  h += '<div class="doc-sum mt">' + kv('طريقة الدفع', esc(PAY_AR[x.method] || '')) + kv('إجمالي الطلب', imoney(o.total)) + kv('إجمالي المدفوع لحد الإيصال ده', imoney(r.paid)) +
    '<div class="doc-due' + (r.remaining <= 0.009 ? ' zero' : '') + '"><span>الباقي</span><span>' + imoney(Math.max(0, r.remaining)) + '</span></div></div>';
  if (x.notes) h += '<div class="doc-note">' + esc(x.notes) + '</div>';
  h += '<div class="doc-foot">' + esc(setting('invoice_note', 'شكرًا لثقتكم')) + '</div></div></div>';
  return h;
};
/** Paid & remaining as of this payment (payments are listed newest first). */
function receiptNumbers(x, o) {
  var list = (S.data.payments || []).filter(function (p) { return p.order_id === x.order_id && p.status !== 'void'; }).slice().reverse();
  var paid = 0;
  for (var i = 0; i < list.length; i++) { paid += n(list[i].amount); if (list[i].id === x.id) break; }
  return { paid: paid, remaining: n(o.total) - paid };
}
function receiptSig(x) { var o = orderById(x.order_id) || {}; var r = receiptNumbers(x, o), c = custOf(o); return hashStr(JSON.stringify([x.status, x.amount, x.method, x.pay_date, r.paid, o.total, c.name, c.phone, bizName(), setting('phone', '')])); }

/* ---------- account statement (كشف حساب) — one order ("o:<id>") or all of a customer's orders ---------- */
function stmtInfo(param) {
  param = String(param || '');
  if (param.indexOf('o:') === 0) {
    var o = orderById(param.slice(2));
    if (!o) return null;
    return { one: o, c: custOf(o), orders: [o], back: { back: 'order', backP: o.id } };
  }
  var c = custById(param);
  if (!c) return null;
  return { one: null, c: c, orders: custBalance(c).sale, back: { back: 'customer', backP: c.id } };
}
function stmtTotals(info) {
  var t = { total: 0, paid: 0 };
  info.orders.forEach(function (o) { if (o.status !== 'cancelled') { t.total += n(o.total); t.paid += n(o.paid); } });
  t.rem = t.total - t.paid;
  return t;
}
VIEWS.statement = function (param) {
  var info = stmtInfo(param);
  if (!info) { topbar('كشف الحساب', { back: 'customers' }); return emptyBox('receipt', 'مش موجود'); }
  var c = info.c, t = stmtTotals(info), ids = {};
  info.orders.forEach(function (o) { ids[o.id] = o; });
  var pays = (S.data.payments || []).filter(function (x) { return ids[x.order_id] && x.status !== 'void'; }).slice().reverse();
  topbar('كشف حساب ' + (c.name || ''), info.back);
  var h = '<div class="doc-wrap"><div class="doc-actions"><button class="btn wa" data-act="stmtWa" data-p="' + esc(param) + '">' + WA_ICON + (c.phone ? 'ابعت الصورة على واتساب العميل' : 'ضيف رقم العميل عشان تبعت على واتساب') + '</button>' +
    (c.phone ? '<a class="btn btn-soft" target="_blank" rel="noopener" href="' + esc(waLink(c.phone, stmtText(info))) + '">' + ic('send', 'sm') + 'ابعت الحساب كرسالة</a>' : '<span></span>') +
    '<button class="btn btn-soft" data-act="stmtImg" data-p="' + esc(param) + '">' + ic('image', 'sm') + 'حفظ الصورة</button>' +
    '<button class="btn btn-ghost" data-act="docPrint">' + ic('receipt', 'sm') + 'طباعة</button></div>';
  h += '<div class="doc stmt" id="doc">' + docHead('كشف حساب', '', null);
  h += '<div class="doc-info"><div style="grid-column:span 2"><small>العميل</small><b>' + esc(c.name || '—') + '</b>' + (c.phone ? ' <span class="num" style="font-size:13px;color:var(--ink-2)">' + esc(c.phone) + '</span>' : '') + '</div>' +
    '<div><small>التاريخ</small><b>' + docDate(today()) + '</b></div></div>';
  if (!info.orders.length) h += '<div class="empty">مفيش طلبات مؤكدة لسه.</div>';
  info.orders.forEach(function (o) {
    h += '<div class="st-order"><div class="st-head"><b>' + esc(o.title || 'طلب') + '</b><span class="faint">رقم <span class="num">' + nb(o.order_no) + '</span> · ' + docDate(o.order_date) + '</span></div>' +
      '<div class="st-items">' + (o.items || []).map(function (it) { return '<div><span>' + esc(it.name) + (n(it.qty) > 1 ? ' <span class="num">× ' + fmt(it.qty, 0) + '</span>' : '') + '</span>' + (it.spec ? '<span class="faint">' + esc(it.spec) + '</span>' : '') + '</div>'; }).join('') + '</div>' +
      '<div class="st-amt"><span>' + (hasAgreed_(o) ? 'المبلغ المتفق عليه' : 'الإجمالي') + '</span><b>' + imoney(o.total) + '</b></div></div>';
  });
  if (pays.length) h += '<table class="t doc-table mt"><thead><tr><th>التاريخ</th><th>المدفوع</th><th class="n">المبلغ</th></tr></thead><tbody>' + pays.map(function (x) {
    var o = ids[x.order_id];
    return '<tr><td>' + docDate(x.pay_date) + '</td><td>' + (PAYKIND_AR[x.kind] || '') + ' · ' + esc(PAY_AR[x.method] || '') + (info.orders.length > 1 ? ' <span class="faint">(' + esc(o.order_no) + ')</span>' : '') + '</td><td class="n">' + (n(x.amount) < 0 ? '− ' : '') + imoney(Math.abs(x.amount)) + '</td></tr>';
  }).join('') + '</tbody></table>';
  h += '<div class="doc-sum">' + kv('إجمالي الحساب', imoney(t.total)) + kv('إجمالي المدفوع', imoney(t.paid)) +
    '<div class="doc-due' + (t.rem <= 0.009 ? ' zero' : '') + '" style="font-size:20px;padding:14px 16px"><span>' + (t.rem < -0.009 ? 'ليك عندنا' : 'الباقي') + '</span><span>' + imoney(Math.abs(t.rem)) + '</span></div></div>' +
    (t.total > 0 && t.rem <= 0.009 ? '<div class="paid-mark">PAID</div>' : '');
  h += '<div class="doc-foot">' + esc(setting('invoice_note', 'شكرًا لثقتكم')) + '</div></div></div>';
  return h;
};
function stmtText(info) {
  var c = info.c, t = stmtTotals(info), phone = setting('phone', '');
  return 'أهلاً ' + (c.name || '') + '\nده ملخص حسابك في ' + bizName() + ':\n' +
    info.orders.map(function (o) { return 'طلب ' + o.order_no + (o.title ? ' — ' + o.title : '') + ': ' + fmt(o.total, 2) + ' ج.م'; }).join('\n') +
    '\nالإجمالي: ' + fmt(t.total, 2) + ' ج.م\nالمدفوع: ' + fmt(t.paid, 2) + ' ج.م\n' + (t.rem < -0.009 ? 'ليك عندنا: ' + fmt(-t.rem, 2) : 'الباقي: ' + fmt(Math.max(0, t.rem), 2)) + ' ج.م\nشكرًا لثقتك' + (phone ? '\n' + phone : '');
}
function stmtName(info) { return 'Ahmed-Abu-El-Sheikh-Account-' + (info.one ? info.one.order_no : String(info.c.name || '').replace(/\s+/g, '-')) + '-' + today(); }
function docPng() {
  setBusy(true);
  return docCanvas().then(function (c) { return new Promise(function (r) { c.toBlob(r, 'image/png'); }); })
    .then(function (b) { setBusy(false); if (!b) throw new Error('تعذر تجهيز الصورة'); return b; }, function (e) { setBusy(false); throw e; });
}
ACT.stmtImg = function (el) {
  var info = stmtInfo(el.getAttribute('data-p')); if (!info) return;
  docPng().then(function (b) { downloadBlob(b, stmtName(info) + '.png'); toast('اتحفظت الصورة', 'ok'); }).catch(function (e) { toast(e.message, 'err'); });
};
/** The statement as a picture on WhatsApp: phone → share sheet (choose WhatsApp, then the customer);
    computer → the picture is copied, the customer's chat opens, paste it there. */
ACT.stmtWa = function (el) {
  var info = stmtInfo(el.getAttribute('data-p')); if (!info) return;
  var c = info.c;
  if (!c.phone || waNumber_(c.phone).length < 8) { toast('ضيف رقم تليفون العميل الأول', 'err'); go('customer', c.id); return; }
  docPng().then(function (blob) {
    var name = stmtName(info) + '.png', file = null;
    try { file = new File([blob], name, { type: 'image/png' }); } catch (e) { file = null; }
    var touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], text: 'كشف حساب ' + (c.name || '') + ' — ' + bizName() }).catch(function () {});
    }
    var copied = navigator.clipboard && navigator.clipboard.write && window.ClipboardItem ?
      navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]).then(function () { return true; }, function () { return false; }) : Promise.resolve(false);
    return copied.then(function (ok) {
      if (!ok) downloadBlob(blob, name);
      var link = waLink(c.phone, 'أهلاً ' + (c.name || '') + '\nده كشف حسابك من ' + bizName());
      modal({ title: 'صورة الحساب جاهزة', body: '<div class="callout ok">' + ic('check', 'sm') + '<div>' + (ok ? 'الصورة اتنسخت. افتح محادثة العميل، واعمل لصق (Ctrl + V) وبعدين إرسال.' : 'الصورة اتحفظت في التنزيلات. افتح محادثة العميل وابعتها من زرار المرفقات.') + '</div></div>',
        footer: '<a class="btn" style="flex:1;background:#1FA855;color:#fff" target="_blank" rel="noopener" href="' + esc(link) + '" onclick="setTimeout(closeModal,300)">' + WA_ICON + 'افتح محادثة العميل</a>' });
    });
  }).catch(function (e) { toast(e.message, 'err'); });
};

/* ---------- cut list (internal) ---------- */
VIEWS.cutlist = function (id) {
  var o = orderById(id);
  if (!o) { topbar('كشف التقطيع', { back: 'orders' }); return emptyBox('cut', 'الطلب مش موجود'); }
  var c = custOf(o), mm = matMap(), groups = {}, order = [], acc = {};
  var itemsById = {}, itemIdx = {}; (o.items || []).forEach(function (it, i) { itemsById[it.id] = it; itemIdx[it.id] = i; });
  (o.lines || []).forEach(function (l) {
    var it = itemsById[l.item_id]; if (!it) return;
    var m = mm[l.material_id] || { name: '—', mtype: 'count' };
    if (l.ltype === 'piece') {
      if (!groups[l.material_id]) { groups[l.material_id] = { m: m, rows: [] }; order.push(l.material_id); }
      groups[l.material_id].rows.push({ ix: itemIdx[it.id] * 1000 + n(l.sort), item: it.name, name: l.name || 'قطعة', count: n(l.count) * n(it.qty), length: l.length, width: l.width, thickness: l.thickness, notes: l.notes });
    } else {
      acc[l.material_id] = acc[l.material_id] || { m: m, qty: 0 };
      try { acc[l.material_id].qty += n(l.qty) * unitFactor_(l.unit || unitsFor_(m)[0], m) * n(it.qty); } catch (e) {}
    }
  });
  var mats = o.status === 'quote' ? draftEstimateFromOrder(o).materials : ((o.snapshot && o.snapshot.materials) || []);
  var byMat = {}; mats.forEach(function (x) { byMat[x.material_id] = x; });
  topbar('كشف تقطيع ' + o.order_no, { back: 'order', backP: o.id });
  var h = '<div class="doc-wrap"><div class="doc-actions"><button class="btn btn-primary" data-act="docPrint">' + ic('receipt', 'sm') + 'طباعة</button><button class="btn btn-soft" data-act="docPdf" data-k="cut" data-p="' + esc(o.id) + '">' + ic('save', 'sm') + 'حفظ PDF</button></div>' +
    '<div class="doc" id="doc">' + docHead('كشف تقطيع — للورشة', '<span class="num">' + nb(o.order_no) + '</span> · ' + esc(c.name || '') + (o.due_date ? ' · التسليم ' + plainDate(o.due_date) : ''), null);
  h += '<div class="doc-info"><div><small>البنود</small><b>' + (o.items || []).map(function (it) { return esc(it.name) + ' × ' + fmt(it.qty, 0); }).join('، ') + '</b></div><div><small>التاريخ</small><b>' + docDate(today()) + '</b></div><div><small>ملاحظات</small><b>' + esc(o.notes || '—') + '</b></div></div>';
  if (!order.length) h += '<div class="empty">مفيش قطع بمقاسات في الطلب ده.</div>';
  order.forEach(function (mid) {
    var g = groups[mid]; g.rows.sort(function (a, b) { return a.ix - b.ix; });
    var m = g.m, x = byMat[mid], solid = m.mtype === 'solid', lin = m.mtype === 'linear', cnt = m.mtype === 'count';
    h += '<div class="cut-group"><h4>' + esc(matLabel(m)) + (x && m.mtype === 'sheet' ? ' — <span class="num">' + x.sheets + '</span> لوح (' + '<span class="num">' + fmt(x.net / 10000, 2) + '</span> م² صافي)' : '') + (x && solid ? ' — <span class="num">' + fmt(x.gross / 1e6, 4) + '</span> م³ بالهالك' : '') + '</h4>' +
      '<table class="t"><thead><tr><th>البند</th><th>القطعة</th><th class="n">العدد</th>' + (cnt ? '' : '<th class="n">الطول</th>') + (lin || cnt ? '' : '<th class="n">العرض</th>') + (solid ? '<th class="n">السُمك</th>' : '') + '<th>ملاحظات</th></tr></thead><tbody>' +
      g.rows.map(function (r) {
        return '<tr><td>' + esc(r.item) + '</td><td><b>' + esc(r.name) + '</b></td><td class="n num"><b>' + fmt(r.count, 0) + '</b></td>' + (cnt ? '' : '<td class="n num">' + fmt(r.length, 1) + '</td>') + (lin || cnt ? '' : '<td class="n num">' + fmt(r.width, 1) + '</td>') + (solid ? '<td class="n num">' + fmt(r.thickness, 1) + '</td>' : '') + '<td>' + esc(r.notes || '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  });
  var accK = Object.keys(acc);
  if (accK.length) h += '<div class="cut-group"><h4>إكسسوارات وتشطيب (إجمالي الطلب)</h4><table class="t"><tbody>' + accK.map(function (k) { var a = acc[k]; return '<tr><td>' + esc(a.m.name) + '</td><td class="n">' + qtyM(a.qty, a.m, 3) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  h += '<div class="doc-foot">المقاسات بالسنتيمتر · العدد = عدد القطع × كمية البند</div></div></div>';
  return h;
};

/* ---------- PDF & sharing ---------- */
var H2C = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
var JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
var LOADED = {};
function loadOne(src) {
  if (LOADED[src]) return LOADED[src];
  LOADED[src] = new Promise(function (res, rej) {
    var sc = document.createElement('script'); sc.src = src; sc.onload = function () { res(); };
    sc.onerror = function () { delete LOADED[src]; rej(new Error('تعذر تجهيز الملف، اتأكد من النت')); };
    document.head.appendChild(sc);
  });
  return LOADED[src];
}
function docCanvas() {
  var el = document.getElementById('doc');
  return loadOne(H2C).then(function () { return document.fonts && document.fonts.ready; })
    .then(function () { return html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false }); });
}
/** The on-screen document → single-page PDF (base64 + blob). */
function docPdf() {
  setBusy(true);
  return loadOne(JSPDF).then(docCanvas).then(function (c) {
    var w = c.width / 2, h = c.height / 2;
    var pdf = new window.jspdf.jsPDF({ orientation: w > h ? 'l' : 'p', unit: 'pt', format: [w + 40, h + 40], compress: true });
    pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 20, 20, w, h);
    setBusy(false);
    return { b64: pdf.output('datauristring').split(',')[1], blob: pdf.output('blob') };
  }, function (e) { setBusy(false); throw e; });
}
function downloadBlob(blob, name) {
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
function docName(kind, id) {
  if (kind === 'receipt') { var x = (S.data.payments || []).find(function (p) { return p.id === id; }); return 'Ahmed-Abu-El-Sheikh-Receipt-' + (x ? x.receipt_no : ''); }
  var o = orderById(id) || {};
  return 'Ahmed-Abu-El-Sheikh-' + (kind === 'cut' ? 'CutList' : o.status === 'quote' ? 'Quotation' : 'Invoice') + '-' + (o.order_no || '');
}
function waText(kind, id, url) {
  var phone = setting('phone', ''), name = bizName();
  if (kind === 'receipt') {
    var x = (S.data.payments || []).find(function (p) { return p.id === id; }), o = orderById(x.order_id) || {}, r = receiptNumbers(x, o), c = custOf(o);
    return 'أهلاً ' + (c.name || '') + '\n' + (n(x.amount) < 0 ? 'ده إيصال رد مبلغ ' : 'ده إيصال استلام مبلغ ') + fmt(Math.abs(x.amount), 2) + ' ج.م للطلب رقم ' + o.order_no + ' من ' + name + '\n' +
      'الباقي: ' + fmt(Math.max(0, r.remaining), 2) + ' ج.م\nالإيصال PDF:\n' + url + '\n\nشكرًا لثقتك' + (phone ? '\n' + phone : '');
  }
  var o2 = orderById(id), c2 = custOf(o2), q = o2.status === 'quote';
  return 'أهلاً ' + (c2.name || '') + '\n' + (q ? 'ده عرض سعر رقم ' : 'دي فاتورة طلبك رقم ') + o2.order_no + ' من ' + name + '\n' +
    'الإجمالي: ' + fmt(o2.total, 2) + ' ج.م' + (!q && o2.status !== 'cancelled' ? '\nالمدفوع: ' + fmt(o2.paid, 2) + ' ج.م\nالباقي: ' + fmt(Math.max(0, o2.remaining), 2) + ' ج.م' : '') +
    (o2.due_date && !q ? '\nموعد التسليم: ' + plainDate(o2.due_date) : '') + '\n' + (q ? 'عرض السعر' : 'الفاتورة') + ' PDF:\n' + url + '\n\nشكرًا لثقتك' + (phone ? '\n' + phone : '');
}
ACT.docWhatsApp = function (el) {
  var kind = el.getAttribute('data-k'), id = el.getAttribute('data-p');
  var x = kind === 'receipt' ? (S.data.payments || []).find(function (p) { return p.id === id; }) : null;
  var o = kind === 'receipt' ? orderById(x.order_id) : orderById(id), c = custOf(o);
  if (!c.phone) { toast('ضيف رقم تليفون العميل الأول', 'err'); go('customer', o.customer_id); return; }
  if (waNumber_(c.phone).length < 8) return toast('رقم التليفون مش واضح، راجعه في صفحة العميل', 'err');
  var sig = kind === 'receipt' ? receiptSig(x) : orderSig(o);
  var stored = kind === 'receipt' ? { url: x.receipt_url, sig: x.receipt_sig } : { url: o.invoice_url, sig: o.invoice_sig };
  if (stored.url && stored.sig === sig) { openWa(c.phone, waText(kind, id, stored.url)); return; }
  var r0 = rid();
  docPdf().then(function (pdf) {
    return run(kind === 'receipt' ? 'saveReceiptPdf' : 'saveInvoicePdf', kind === 'receipt' ? { payment_id: id, data: pdf.b64, sig: sig } : { order_id: id, data: pdf.b64, sig: sig }, { rid: r0 });
  }).then(function (r) { if (r) openWa(c.phone, waText(kind, id, r.result.url)); }).catch(function (e) { toast(e.message, 'err'); });
};
function openWa(phone, text) {
  var link = waLink(phone, text), win = window.open(link, '_blank');
  if (!win) modal({ title: 'الملف جاهز', body: '<div class="callout ok">' + ic('check', 'sm') + '<div>الـ PDF اترفع. اضغط الزرار وهيفتح واتساب على رقم العميل والرسالة جاهزة — اضغط إرسال بس.</div></div>',
    footer: '<a class="btn" style="flex:1;background:#1FA855;color:#fff" target="_blank" rel="noopener" href="' + esc(link) + '" onclick="setTimeout(closeModal,300)">' + WA_ICON + 'افتح واتساب</a>' });
}
ACT.docPdf = function (el) { var k = el.getAttribute('data-k'), id = el.getAttribute('data-p'); docPdf().then(function (p) { downloadBlob(p.blob, docName(k, id) + '.pdf'); toast('اتحفظ ملف PDF', 'ok'); }).catch(function (e) { toast(e.message, 'err'); }); };
ACT.docImg = function (el) {
  var k = el.getAttribute('data-k'), id = el.getAttribute('data-p'); setBusy(true);
  docCanvas().then(function (c) { return new Promise(function (r) { c.toBlob(r, 'image/png'); }); }).then(function (b) { setBusy(false); downloadBlob(b, docName(k, id) + '.png'); toast('اتحفظت الصورة', 'ok'); }, function (e) { setBusy(false); toast(e.message, 'err'); });
};
ACT.docShare = function (el) {
  var k = el.getAttribute('data-k'), id = el.getAttribute('data-p'), name = docName(k, id) + '.pdf';
  docPdf().then(function (p) {
    var file = new File([p.blob], name, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: name }).catch(function () {});
    downloadBlob(p.blob, name); toast('المشاركة مش متاحة هنا — اتحفظ الملف بدلها', 'ok');
  }).catch(function (e) { toast(e.message, 'err'); });
};
ACT.docPrint = function () { window.print(); };
