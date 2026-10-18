/* Customers, suppliers, workshop expenses. */

function custBalance(c) {
  var os = (S.data.orders || []).filter(function (o) { return o.customer_id === c.id; });
  var sale = os.filter(countsAsSale);
  return { orders: os, total: sale.reduce(function (a, o) { return a + n(o.total); }, 0), paid: sale.reduce(function (a, o) { return a + n(o.paid); }, 0),
           due: sale.reduce(function (a, o) { return a + Math.max(0, n(o.remaining)); }, 0) };
}
VIEWS.customers = function () {
  topbar('العملاء', { right: '<button class="btn btn-primary btn-sm desk-only" data-act="newCustomer">' + ic('plus', 'sm') + 'عميل جديد</button>' });
  var q = S.filters.custQ.toLowerCase();
  var list = (S.data.customers || []).filter(function (c) { return (S.filters.archived ? !isActive(c) : isActive(c)) && (!q || (c.name + ' ' + (c.phone || '') + ' ' + digits(c.phone || '')).toLowerCase().indexOf(q) >= 0); })
    .map(function (c) { return { c: c, b: custBalance(c) }; }).sort(function (a, b) { return b.b.due - a.b.due || String(a.c.name).localeCompare(String(b.c.name), 'ar'); });
  var owed = list.reduce(function (a, x) { return a + x.b.due; }, 0);
  var h = '<div class="grid g2 mb">' + kpi('فلوس عند العملاء', money(owed, 0), 'باقي حساب الطلبات', 'coins', true) + kpi('عدد العملاء', '<span class="num">' + list.length + '</span>', '', 'users') + '</div>';
  h += '<div class="row mb"><div class="search"><input class="inp" id="custQ" placeholder="ابحث بالاسم أو التليفون…" value="' + esc(S.filters.custQ) + '" data-live="custQ">' + ic('search', 'sm') + '</div></div>';
  h += '<div class="chips mb"><button class="chip ' + (S.filters.archived ? 'on' : '') + '" data-act="toggleArchived">' + (S.filters.archived ? 'المؤرشفين' : 'عرض المؤرشفين') + '</button></div>';
  h += list.length ? '<div class="card list">' + list.map(function (x) {
    return '<div class="li" data-act="nav" data-v="customer" data-p="' + esc(x.c.id) + '"><div class="avatar">' + initials(x.c.name) + '</div><div class="grow"><div class="main-t">' + esc(x.c.name) + '</div><div class="faint num">' + esc(x.c.phone || '') + '</div></div>' +
      '<div class="end">' + (x.b.due > 0.009 ? '<b class="neg">' + money(x.b.due, 0) + '</b><div class="faint">عليه</div>' : '<span class="faint">' + x.b.orders.length + ' طلب</span>') + '</div></div>';
  }).join('') + '</div>' : emptyBox('users', 'مفيش عملاء — العميل بيتسجل لوحده مع أول عرض سعر', 'newCustomer', 'عميل جديد');
  h += '<button class="btn btn-primary fab" data-act="newCustomer">' + ic('plus') + 'عميل</button>';
  return h;
};
LIVE.custQ = function (t) { S.filters.custQ = t.value; softRender('custQ'); };
VIEWS.customer = function (id) {
  var c = custById(id);
  if (!c) { topbar('العميل', { back: 'customers' }); return emptyBox('users', 'العميل مش موجود'); }
  var b = custBalance(c);
  topbar(c.name, { back: 'customers', right: '<button class="iconbtn" data-act="editCustomer" data-p="' + esc(c.id) + '" aria-label="تعديل">' + ic('edit') + '</button>' });
  var h = '<div class="split"><div><div class="card pad"><div class="hero-head"><div class="avatar" style="width:60px;height:60px;font-size:24px">' + initials(c.name) + '</div><div><div style="font-size:20px;font-weight:700">' + esc(c.name) + '</div>' +
    (c.phone ? telLink(c.phone) : '<span class="faint">من غير تليفون</span>') + (c.address ? '<div class="faint">' + esc(c.address) + '</div>' : '') + '</div></div>' +
    '<div class="grid g3s mt">' + stat('إجمالي الطلبات', money(b.total, 0)) + stat('المدفوع', money(b.paid, 0)) + stat('الباقي عليه', '<span class="' + (b.due > 0.009 ? 'neg' : 'pos') + '">' + money(b.due, 0) + '</span>') + '</div>' +
    (c.notes ? '<div class="faint mt">' + esc(c.notes) + '</div>' : '') + '</div>';
  h += '<div class="actions mt"><button class="btn btn-primary" data-act="quoteForCustomer" data-p="' + esc(c.id) + '">' + ic('receipt', 'sm') + 'عرض سعر جديد</button>' +
    (c.phone ? (b.due > 0.009 ? '<a class="btn" style="background:#1FA855;color:#fff" target="_blank" rel="noopener" href="' + esc(waLink(c.phone, reminderText(c, b))) + '">' + WA_ICON + 'تذكير بالباقي</a>' : '<a class="btn btn-soft" target="_blank" rel="noopener" href="' + esc(waLink(c.phone)) + '">' + WA_ICON + 'واتساب</a>') : '<span></span>') + '</div>';
  h += '<div class="sect"><h2>الطلبات</h2></div>' + (b.orders.length ? '<div class="card list">' + b.orders.map(orderRow).join('') + '</div>' : '<div class="card empty">مفيش طلبات</div>');
  h += '</div><div class="sticky"><button class="btn btn-ghost btn-block" data-act="archiveCustomer" data-p="' + esc(c.id) + '">' + ic('archive', 'sm') + (isActive(c) ? 'أرشفة العميل' : 'استرجاع العميل') + '</button></div></div>';
  return h;
};
function reminderText(c, b) {
  var open = b.orders.filter(function (o) { return countsAsSale(o) && n(o.remaining) > 0.009; });
  return 'أهلاً ' + c.name + '\nبنفكّرك إن الباقي من حسابك في ' + bizName() + ': ' + fmt(b.due, 2) + ' ج.م' +
    (open.length ? '\n' + open.map(function (o) { return 'طلب ' + o.order_no + ': ' + fmt(o.remaining, 2) + ' ج.م'; }).join('\n') : '') + '\nشكرًا لثقتك' + (setting('phone', '') ? '\n' + setting('phone') : '');
}
function customerForm(c) {
  c = c || {}; var r0 = rid();
  modal({ title: c.id ? 'تعديل العميل' : 'عميل جديد', body: '<div class="field"><label>الاسم</label><input class="inp" id="cu_name" maxlength="60" value="' + esc(c.name) + '"></div>' +
    '<div class="field"><label>التليفون (واتساب)</label><input class="inp ltr" type="tel" inputmode="tel" id="cu_phone" maxlength="25" value="' + esc(c.phone) + '" placeholder="01xxxxxxxxx"></div>' +
    '<div class="field"><label>العنوان (للتسليم والتركيب)</label><input class="inp" id="cu_addr" maxlength="150" value="' + esc(c.address) + '"></div>' +
    '<div class="field"><label>ملاحظات</label><textarea class="inp" id="cu_notes" maxlength="300">' + esc(c.notes) + '</textarea></div>',
    footer: footer('saveCustomer'), mount: function () { S.cu = { id: c.id || '', rid: r0 }; } });
}
ACT.newCustomer = function () { customerForm(null); };
ACT.editCustomer = function (el) { customerForm(custById(el.getAttribute('data-p'))); };
ACT.saveCustomer = function () {
  run('saveCustomer', { id: S.cu.id, name: val('cu_name'), phone: val('cu_phone'), address: val('cu_addr'), notes: val('cu_notes') }, { rid: S.cu.rid, ok: 'اتحفظ العميل' })
    .then(function (r) { if (r) go('customer', r.result.id); });
};
ACT.archiveCustomer = function (el) {
  var c = custById(el.getAttribute('data-p')), on = isActive(c);
  run('setCustomerActive', { id: c.id, active: !on }, { ok: on ? 'اتأرشف العميل' : 'رجع العميل' }).then(function (r) { if (r) render(); });
};
ACT.quoteForCustomer = function (el) { var c = custById(el.getAttribute('data-p')); startOrder(null); S.draft.customer = { id: c.id, name: c.name, phone: c.phone, address: c.address }; render(); };

/* ---------- suppliers ---------- */
function supBalance(s) {
  var pur = (S.data.purchases || []).filter(function (p) { return p.supplier_id === s.id && p.status !== 'reversed'; });
  var pays = (S.data.supplier_payments || []).filter(function (p) { return p.supplier_id === s.id && p.status !== 'void'; });
  var tp = pur.reduce(function (a, p) { return a + n(p.total); }, 0), pp = pays.reduce(function (a, p) { return a + n(p.amount); }, 0);
  return { purchases: pur, payments: pays, total: tp, paid: pp, opening: n(s.opening_balance), due: n(s.opening_balance) + tp - pp };
}
VIEWS.suppliers = function () {
  topbar('الموردين', { right: '<button class="btn btn-primary btn-sm desk-only" data-act="newSupplier">' + ic('plus', 'sm') + 'مورد جديد</button>' });
  var q = S.filters.supQ.toLowerCase();
  var list = (S.data.suppliers || []).filter(function (s) { return (S.filters.archived ? !isActive(s) : isActive(s)) && (!q || (s.name + ' ' + (s.phone || '') + ' ' + (s.supplies || '')).toLowerCase().indexOf(q) >= 0); })
    .map(function (s) { return { s: s, b: supBalance(s) }; }).sort(function (a, b) { return b.b.due - a.b.due; });
  var due = list.reduce(function (a, x) { return a + Math.max(0, x.b.due); }, 0);
  var h = '<div class="grid g2 mb">' + kpi('علينا للموردين', money(due, 0), 'باقي فواتير الشراء', 'truck', true) + kpi('عدد الموردين', '<span class="num">' + list.length + '</span>', '', 'users') + '</div>';
  h += '<div class="row mb"><div class="search"><input class="inp" id="supQ" placeholder="ابحث…" value="' + esc(S.filters.supQ) + '" data-live="supQ">' + ic('search', 'sm') + '</div></div>';
  h += list.length ? '<div class="card list">' + list.map(function (x) {
    return '<div class="li" data-act="nav" data-v="supplier" data-p="' + esc(x.s.id) + '"><div class="avatar">' + initials(x.s.name) + '</div><div class="grow"><div class="main-t">' + esc(x.s.name) + '</div><div class="faint">' + esc(x.s.supplies || x.s.phone || '') + '</div></div>' +
      '<div class="end">' + (x.b.due > 0.009 ? '<b class="neg">' + money(x.b.due, 0) + '</b><div class="faint">علينا</div>' : x.b.due < -0.009 ? '<b class="pos">' + money(-x.b.due, 0) + '</b><div class="faint">لينا عنده</div>' : '<span class="faint">خالص</span>') + '</div></div>';
  }).join('') + '</div>' : emptyBox('truck', 'مفيش موردين', 'newSupplier', 'مورد جديد');
  h += '<button class="btn btn-primary fab" data-act="newSupplier">' + ic('plus') + 'مورد</button>';
  return h;
};
LIVE.supQ = function (t) { S.filters.supQ = t.value; softRender('supQ'); };
VIEWS.supplier = function (id) {
  var s = supById(id);
  if (!s) { topbar('المورد', { back: 'suppliers' }); return emptyBox('truck', 'المورد مش موجود'); }
  var b = supBalance(s);
  topbar(s.name, { back: 'suppliers', right: '<button class="iconbtn" data-act="editSupplier" data-p="' + esc(s.id) + '" aria-label="تعديل">' + ic('edit') + '</button>' });
  var h = '<div class="split"><div><div class="card pad"><div style="font-size:20px;font-weight:700">' + esc(s.name) + '</div>' + (s.phone ? telLink(s.phone) : '') + (s.supplies ? '<div class="faint">' + esc(s.supplies) + '</div>' : '') +
    '<div class="grid g3s mt">' + stat('المشتريات', money(b.total, 0)) + stat('المدفوع', money(b.paid, 0)) + stat('الباقي علينا', '<span class="' + (b.due > 0.009 ? 'neg' : 'pos') + '">' + money(b.due, 0) + '</span>') + '</div>' +
    (b.opening ? '<div class="faint mt">شامل رصيد سابق ' + money(b.opening) + '</div>' : '') + '</div>';
  h += '<div class="actions mt"><button class="btn btn-primary" data-act="supPay" data-p="' + esc(s.id) + '">' + ic('money', 'sm') + 'دفعة للمورد</button><button class="btn btn-soft" data-act="supBuy" data-p="' + esc(s.id) + '">' + ic('cart', 'sm') + 'فاتورة شراء</button></div>';
  var rows = b.purchases.map(function (p) { return { d: p.purchase_date, t: 'buy', x: p }; }).concat(b.payments.map(function (p) { return { d: p.pay_date, t: 'pay', x: p }; }))
    .sort(function (a, c) { return String(c.d).localeCompare(String(a.d)); });
  h += '<div class="sect"><h2>الحركة</h2></div>' + (rows.length ? '<div class="card list">' + rows.map(function (r) {
    if (r.t === 'buy') return '<div class="li static"><div class="ico-dot">' + ic('cart', 'sm') + '</div><div class="grow"><b>فاتورة ' + esc(r.x.purchase_no) + '</b><div class="faint">' + fmtDate(r.d) + ' · ' + r.x.lines.map(function (l) { return esc(l.material_name); }).join('، ') + '</div></div><div class="end"><b>' + money(r.x.total, 0) + '</b></div></div>';
    return '<div class="li static"><div class="ico-dot" style="background:var(--ok-bg);color:var(--ok)">' + ic('money', 'sm') + '</div><div class="grow"><b>دفعة</b><div class="faint">' + fmtDate(r.d) + ' · ' + (PAY_AR[r.x.method] || '') + (r.x.notes ? ' · ' + esc(r.x.notes) : '') + '</div></div><div class="end"><b class="pos">− ' + money(r.x.amount, 0) + '</b>' +
      (!r.x.purchase_id ? '<button class="link faint" data-act="voidSupPay" data-p="' + esc(r.x.id) + '">إلغاء</button>' : '') + '</div></div>';
  }).join('') + '</div>' : '<div class="card empty">مفيش حركة لسه</div>');
  h += '</div><div class="sticky"><button class="btn btn-ghost btn-block" data-act="archiveSupplier" data-p="' + esc(s.id) + '">' + ic('archive', 'sm') + (isActive(s) ? 'أرشفة المورد' : 'استرجاع المورد') + '</button></div></div>';
  return h;
};
function supplierForm(s) {
  s = s || {}; var r0 = rid();
  modal({ title: s.id ? 'تعديل المورد' : 'مورد جديد', body: '<div class="field"><label>الاسم</label><input class="inp" id="su_name" maxlength="60" value="' + esc(s.name) + '"></div>' +
    '<div class="field"><label>التليفون</label><input class="inp ltr" type="tel" id="su_phone" maxlength="25" value="' + esc(s.phone) + '"></div>' +
    '<div class="field"><label>بيورّد إيه</label><input class="inp" id="su_sup" maxlength="120" value="' + esc(s.supplies) + '" placeholder="كونتر وMDF، حدايد…"></div>' +
    '<div class="field"><label>رصيد سابق علينا قبل السيستم (اختياري)</label><input class="inp ltr" id="su_open" inputmode="decimal" value="' + esc(n(s.opening_balance) || '') + '" placeholder="0"></div>' +
    '<div class="field"><label>ملاحظات</label><textarea class="inp" id="su_notes" maxlength="300">' + esc(s.notes) + '</textarea></div>',
    footer: footer('saveSupplier'), mount: function () { S.su = { id: s.id || '', rid: r0 }; } });
}
ACT.newSupplier = function () { supplierForm(null); };
ACT.editSupplier = function (el) { supplierForm(supById(el.getAttribute('data-p'))); };
ACT.saveSupplier = function () {
  var ob = parseIn(val('su_open')); if (isNaN(ob)) return toast('الرصيد السابق غير صحيح', 'err');
  run('saveSupplier', { id: S.su.id, name: val('su_name'), phone: val('su_phone'), supplies: val('su_sup'), opening_balance: ob === '' ? 0 : ob, notes: val('su_notes') }, { rid: S.su.rid, ok: 'اتحفظ المورد' })
    .then(function (r) { if (r) go('supplier', r.result.id); });
};
ACT.archiveSupplier = function (el) { var s = supById(el.getAttribute('data-p')), on = isActive(s); run('setSupplierActive', { id: s.id, active: !on }, { ok: 'تم' }).then(function (r) { if (r) render(); }); };
ACT.supBuy = function (el) { startPurchase(null); S.pu.supplier_id = el.getAttribute('data-p'); go('purchases'); };
ACT.supPay = function (el) {
  var s = supById(el.getAttribute('data-p')), b = supBalance(s), r0 = rid();
  modal({ title: 'دفعة لـ ' + s.name, body: kv('الباقي علينا', '<b>' + money(b.due) + '</b>') + '<div class="field mt"><label>المبلغ</label><input class="inp ltr" id="sp_amount" inputmode="decimal" value="' + (b.due > 0 ? Math.round(b.due * 100) / 100 : '') + '"></div>' +
    '<div class="grid g2"><div class="field"><label>طريقة الدفع</label><select class="inp" id="sp_method">' + payOpts() + '</select></div><div class="field"><label>التاريخ</label><input class="inp" type="date" id="sp_date" value="' + esc(today()) + '"></div></div>' +
    '<div class="field"><label>ملاحظات</label><input class="inp" id="sp_notes" maxlength="200"></div>', footer: footer('saveSupPay', 'تسجيل الدفعة', 'money'), mount: function () { S.sp = { id: s.id, rid: r0 }; } });
};
ACT.saveSupPay = function () {
  var a = parseIn(val('sp_amount')); if (!(a > 0)) return toast('اكتب المبلغ', 'err');
  run('addSupplierPayment', { supplier_id: S.sp.id, amount: a, method: val('sp_method'), date: val('sp_date'), notes: val('sp_notes') }, { rid: S.sp.rid, ok: 'اتسجلت الدفعة' }).then(function (r) { if (r) { closeModal(); render(); } });
};
ACT.voidSupPay = function (el) {
  var id = el.getAttribute('data-p');
  confirmBox('إلغاء الدفعة', 'الدفعة هتتلغي والمبلغ يرجع على حساب المورد.', 'إلغاء الدفعة', true).then(function (y) { if (y) run('voidSupplierPayment', { id: id }, { ok: 'اتلغت' }).then(function (r) { if (r) render(); }); });
};

/* ---------- workshop expenses ---------- */
VIEWS.expenses = function () {
  topbar('مصاريف الورشة', { right: '<button class="btn btn-primary btn-sm desk-only" data-act="newExpense">' + ic('plus', 'sm') + 'مصروف</button>' });
  var month = S.expMonth || today().slice(0, 7);
  var all = (S.data.expenses || []).filter(function (e) { return e.status !== 'void'; });
  var months = []; all.forEach(function (e) { var m = String(e.exp_date).slice(0, 7); if (months.indexOf(m) < 0) months.push(m); });
  if (months.indexOf(today().slice(0, 7)) < 0) months.unshift(today().slice(0, 7));
  months.sort().reverse();
  var list = all.filter(function (e) { return String(e.exp_date).slice(0, 7) === month; });
  var tot = list.reduce(function (a, e) { return a + n(e.amount); }, 0), byCat = {};
  list.forEach(function (e) { byCat[e.category] = (byCat[e.category] || 0) + n(e.amount); });
  var h = '<div class="chips mb">' + months.slice(0, 12).map(function (m) { return '<button class="chip ' + (m === month ? 'on' : '') + '" data-act="expMonth" data-v="' + m + '">' + monthName(m) + '</button>'; }).join('') + '</div>';
  h += '<div class="split"><div>' + (list.length ? '<div class="card list">' + list.map(function (e) {
    return '<div class="li static"><div class="ico-dot">' + ic('wallet', 'sm') + '</div><div class="grow"><b>' + esc(e.category) + '</b><div class="faint">' + fmtDate(e.exp_date) + (e.notes ? ' · ' + esc(e.notes) : '') + '</div></div><div class="end"><b>' + money(e.amount, 0) + '</b><div><button class="link faint" data-act="editExpense" data-p="' + esc(e.id) + '">تعديل</button> · <button class="link faint" data-act="voidExpense" data-p="' + esc(e.id) + '">حذف</button></div></div></div>';
  }).join('') + '</div>' : emptyBox('wallet', 'مفيش مصاريف في ' + monthName(month), 'newExpense', 'مصروف')) + '</div>';
  var tt = tot || 1, cls = ['', 'c2', 'c3', 'c4'];
  h += '<div class="sticky"><div class="card pad"><div class="between mb"><b>إجمالي ' + monthName(month) + '</b><b>' + money(tot, 0) + '</b></div><div class="bars">' +
    Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; }).map(function (k, i) { return bar(k, byCat[k], tt, cls[i % 4]); }).join('') + '</div></div></div></div>';
  h += '<button class="btn btn-primary fab" data-act="newExpense">' + ic('plus') + 'مصروف</button>';
  return h;
};
ACT.expMonth = function (el) { S.expMonth = el.getAttribute('data-v'); render(); };
function expenseForm(e) {
  e = e || {}; var r0 = rid(), kinds = expKinds().slice(); if (e.category && kinds.indexOf(e.category) < 0) kinds.push(e.category);
  modal({ title: e.id ? 'تعديل مصروف' : 'مصروف جديد', body: '<div class="field"><label>البند</label><select class="inp" id="ex_cat">' + selOpts(kinds, e.category || kinds[0]) + '</select></div>' +
    '<div class="grid g2"><div class="field"><label>المبلغ</label><input class="inp ltr" id="ex_amount" inputmode="decimal" value="' + esc(e.amount || '') + '"></div><div class="field"><label>التاريخ</label><input class="inp" type="date" id="ex_date" value="' + esc(e.exp_date || today()) + '"></div></div>' +
    '<div class="field"><label>ملاحظات</label><input class="inp" id="ex_notes" maxlength="200" value="' + esc(e.notes || '') + '"></div><div class="faint">المصاريف هنا مش مربوطة بطلب (إيجار، كهرباء، عدد، أجور…). مصنعية طلب معيّن بتتسجل في صفحة الطلب.</div>',
    footer: footer('saveExpense'), mount: function () { S.ex = { id: e.id || '', rid: r0 }; } });
}
ACT.newExpense = function () { expenseForm(null); };
ACT.editExpense = function (el) { expenseForm((S.data.expenses || []).find(function (e) { return e.id === el.getAttribute('data-p'); })); };
ACT.saveExpense = function () {
  var a = parseIn(val('ex_amount')); if (!(a > 0)) return toast('اكتب المبلغ', 'err');
  var d = val('ex_date');
  run('saveExpense', { id: S.ex.id, category: val('ex_cat'), amount: a, date: d, notes: val('ex_notes') }, { rid: S.ex.rid, ok: 'اتحفظ المصروف' }).then(function (r) { if (r) { S.expMonth = String(d || today()).slice(0, 7); closeModal(); render(); } });
};
ACT.voidExpense = function (el) {
  var id = el.getAttribute('data-p');
  confirmBox('حذف المصروف', 'المصروف هيتشال من الحسابات (هيفضل في السجل كملغي).', 'حذف', true).then(function (y) { if (y) run('voidExpense', { id: id }, { ok: 'اتشال' }).then(function (r) { if (r) render(); }); });
};
