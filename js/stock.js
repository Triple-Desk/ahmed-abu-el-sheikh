/* Materials store, purchases, production. */

/* ---------- materials list ---------- */
VIEWS.materials = function () {
  topbar('الخامات', { right: '<button class="btn btn-primary btn-sm desk-only" data-act="newMaterial">' + ic('plus', 'sm') + 'خامة جديدة</button>' });
  var f = S.filters, q = f.matQ.toLowerCase();
  var list = mats().filter(function (m) {
    return (f.archived ? !isActive(m) : isActive(m)) && (f.matType === 'all' || (f.matType === 'low' ? isLow(m) : m.mtype === f.matType)) &&
      (!q || (m.name + ' ' + (m.category || '')).toLowerCase().indexOf(q) >= 0);
  });
  var value = mats().filter(isActive).reduce(function (a, m) { return a + Math.max(0, n(m.stock)) * n(m.avg_cost); }, 0);
  var lowN = mats().filter(function (m) { return isActive(m) && isLow(m); }).length;
  var h = '<div class="grid g2 mb">' + kpi('قيمة الخامات في المخزن', money(value, 0), 'بمتوسط سعر الشراء', 'box') + kpi('رصيد قليل', '<span class="num">' + lowN + '</span>', lowN ? 'محتاجة شراء' : 'كله تمام', 'alert') + '</div>';
  h += '<div class="row mb"><div class="search"><input class="inp" id="matQ" placeholder="ابحث عن خامة…" value="' + esc(f.matQ) + '" data-live="matQ">' + ic('search', 'sm') + '</div></div>';
  h += '<div class="chips mb">' + [['all', 'الكل'], ['sheet', 'ألواح'], ['solid', 'خشب'], ['linear', 'بالمتر'], ['count', 'حدايد وإكسسوار'], ['liquid', 'دهانات وغراء'], ['low', 'رصيد قليل']].map(function (x) {
    return '<button class="chip ' + (f.matType === x[0] ? 'on' : '') + '" data-act="matType" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') +
    '<button class="chip ' + (f.archived ? 'on' : '') + '" data-act="toggleArchived">' + (f.archived ? 'المؤرشف' : 'عرض المؤرشف') + '</button></div>';
  if (!list.length) return h + emptyBox('layers', 'مفيش خامات هنا', f.archived ? '' : 'newMaterial', 'خامة جديدة');
  h += '<div class="card list">' + list.map(function (m) {
    return '<div class="li" data-act="nav" data-v="material" data-p="' + esc(m.id) + '"><div class="avatar">' + initials(m.name) + picImg(m.image_url) + '</div>' +
      '<div class="grow"><div class="main-t">' + esc(matLabel(m)) + '</div><div class="faint">' + MT_AR[m.mtype] + (m.category && m.category !== MT_AR[m.mtype] ? ' · ' + esc(m.category) : '') + '</div>' +
      '<div class="faint" style="font-size:12.5px">' + (n(m.avg_cost) > 0 ? priceM(m.avg_cost, m) : '<span class="neg">السعر مش متسجل</span>') + '</div></div>' +
      '<div class="end"><div style="font-weight:700">' + qtyM(m.stock, m) + '</div>' + (isLow(m) ? '<span class="badge b-bad">' + (n(m.stock) < 0 ? 'رصيد سالب' : 'قليل') + '</span>' : '<span class="faint">في المخزن</span>') + '</div></div>';
  }).join('') + '</div>';
  h += '<button class="btn btn-primary fab" data-act="newMaterial">' + ic('plus') + 'خامة جديدة</button>';
  return h;
};
ACT.matType = function (el) { S.filters.matType = el.getAttribute('data-v'); render(); };
LIVE.matQ = function (t) { S.filters.matQ = t.value; softRender('matQ'); };

VIEWS.material = function (id) {
  var m = matById(id);
  if (!m) { topbar('الخامة', { back: 'materials' }); return emptyBox('layers', 'الخامة مش موجودة'); }
  topbar(m.name, { back: 'materials', right: '<button class="iconbtn" data-act="editMaterial" data-p="' + esc(m.id) + '" aria-label="تعديل">' + ic('edit') + '</button>' });
  var usedIn = prods().filter(function (p) { return p.lines.some(function (l) { return l.material_id === m.id; }); });
  var sup = m.supplier_id ? supById(m.supplier_id) : null;
  var h = '<div class="split"><div>';
  h += '<div class="card pad"><div class="hero-head"><div class="avatar" style="width:64px;height:64px;border-radius:18px;font-size:26px">' + initials(m.name) + picImg(m.image_url) + '</div><div><div style="font-size:20px;font-weight:700">' + esc(matLabel(m)) + '</div>' +
    '<div class="faint">' + MT_ONE[m.mtype] + (m.category ? ' · ' + esc(m.category) : '') + (sup ? ' · المورد: ' + esc(sup.name) : '') + '</div>' + (!isActive(m) ? '<span class="badge b-gray">مؤرشفة</span>' : '') + '</div></div>' +
    '<div class="grid g2 mt">' + stat('الرصيد الحالي', qtyM(m.stock, m)) + stat('متوسط السعر', n(m.avg_cost) > 0 ? priceM(m.avg_cost, m) : '<span class="neg">مش متسجل</span>') +
    stat('قيمة المخزون', money(Math.max(0, n(m.stock)) * n(m.avg_cost), 0)) + stat('حد التنبيه', n(m.min_stock) ? qtyM(m.min_stock, m) : '<span class="faint">مش متحدد</span>') +
    stat('نسبة الهالك', '<span class="num">' + fmt(wasteOf_(m, S.data.settings), 1) + '%</span>' + (m.waste_pct === '' ? ' <span class="faint" style="font-size:12px">العادية</span>' : '')) +
    (m.mtype === 'sheet' ? stat('مقاس اللوح', '<span class="num">' + fmt(m.sheet_len, 1) + '×' + fmt(m.sheet_wid, 1) + '</span> سم' + (m.thickness_mm ? ' · <span class="num">' + fmt(m.thickness_mm, 1) + '</span> مم' : '')) : n(m.pack_qty) ? stat(esc(m.pack_label || 'العبوة'), qtyM(m.pack_qty, m, 3)) : '') + '</div>' +
    (m.notes ? '<div class="faint mt">' + esc(m.notes) + '</div>' : '') + '</div>';
  h += '<div class="grid g2 mt"><button class="btn btn-primary" data-act="buyMaterial" data-p="' + esc(m.id) + '">' + ic('cart', 'sm') + 'تسجيل شراء</button>' +
    '<button class="btn btn-soft" data-act="adjust" data-p="' + esc(m.id) + '">' + ic('box', 'sm') + 'جرد / هالك</button></div>';
  var mv = (S.data.movements || []).filter(function (x) { return x.item_id === m.id; }).slice(0, 60);
  h += '<div class="sect"><h2>حركة الخامة</h2></div>';
  h += !mv.length ? '<div class="card empty">لسه مفيش حركات</div>' : '<div class="card tscroll"><table class="t"><thead><tr><th>التاريخ</th><th>الحركة</th><th class="n">الكمية</th><th class="n">الرصيد بعدها</th></tr></thead><tbody>' + mv.map(function (x) {
    var o = x.order_id ? orderById(x.order_id) : null;
    return '<tr><td>' + fmtDate(x.mv_date) + '</td><td>' + mvName(x) + (o ? ' <button class="link" data-act="nav" data-v="order" data-p="' + esc(o.id) + '">' + esc(o.order_no) + '</button>' : '') + (x.notes && !o ? '<div class="faint">' + esc(x.notes) + '</div>' : '') +
      (n(x.qty) && n(x.unit_cost) ? '<div class="faint">' + priceM(x.unit_cost, m) + '</div>' : '') + '</td><td class="n ' + (n(x.qty) < 0 ? 'neg' : n(x.qty) > 0 ? 'pos' : '') + '">' + (n(x.qty) ? qtyM(x.qty, m, 3) : '—') + '</td><td class="n">' + qtyM(x.stock_after, m) + '</td></tr>';
  }).join('') + '</tbody></table></div>';
  h += '</div><div class="sticky"><div class="card pad"><b>بتدخل في المنتجات</b>' + (usedIn.length ? '<div class="list mt">' + usedIn.map(function (p) {
    return '<div class="li" style="padding:10px 0" data-act="nav" data-v="product" data-p="' + esc(p.id) + '"><div class="grow main-t">' + esc(p.name) + '</div>' + ic('chev', 'sm') + '</div>'; }).join('') + '</div>' : '<div class="faint mt">مش مستخدمة في أي منتج لسه.</div>') + '</div>' +
    '<button class="btn btn-ghost btn-block mt" data-act="archiveMaterial" data-p="' + esc(m.id) + '">' + ic('archive', 'sm') + (isActive(m) ? 'أرشفة الخامة' : 'استرجاع الخامة') + '</button></div></div>';
  return h;
};

/* ---------- material form ---------- */
function mfProbe() { var f = S.mf; return { name: 'الخامة', mtype: f.mtype, base_unit: f.base, sheet_len: parseIn(val('mf_len')) || 244, sheet_wid: parseIn(val('mf_wid')) || 122, pack_qty: packBase(), pack_label: val('mf_plabel') }; }
function packBase() { var q = parseIn(val('mf_pack')); if (!(q > 0)) return 0; return q * (S.mf.mtype === 'linear' ? 100 : S.mf.mtype === 'count' ? 1 : 1000); }
function materialForm(m, after) {
  var isNew = !m; m = m || { mtype: 'sheet', base_unit: 'cm2', sheet_len: 244, sheet_wid: 122 };
  S.mf = { id: m.id || '', mtype: m.mtype, base: m.base_unit || 'ml', rid: rid(), after: after || null, image: null, removeImage: false };
  var catsM = []; mats().forEach(function (x) { if (x.category && catsM.indexOf(x.category) < 0) catsM.push(x.category); });
  var dp = isNew ? null : displayPrice_(m.avg_cost, m);
  var body =
    '<div class="field"><label>اسم الخامة</label><input class="inp" id="mf_name" maxlength="80" value="' + esc(m.name) + '" placeholder="مثال: كونتر أرو 18 مم"><span class="hint">كل سُمك خامة لوحده (كونتر 18 مم غير كونتر 3 مم).</span></div>' +
    '<div class="field"><label>بتتحسب إزاي</label><div class="seg" id="mf_type">' + Object.keys(MT_ONE).map(function (t) { return '<button type="button" class="' + (m.mtype === t ? 'on' : '') + '" data-act="mfType" data-v="' + t + '"' + (isNew ? '' : ' disabled') + '>' + MT_ONE[t] + '</button>'; }).join('') + '</div>' +
    (isNew ? '' : '<span class="hint">نوع الخامة مبيتغيرش بعد إنشائها عشان الحسابات القديمة تفضل صح.</span>') + '</div>' +
    '<div id="mf_sheet"><div class="grid g3s"><div class="field"><label>طول اللوح (سم)</label><input class="inp ltr" id="mf_len" inputmode="decimal" data-live="mf" value="' + esc(m.sheet_len || 244) + '"></div><div class="field"><label>عرض اللوح (سم)</label><input class="inp ltr" id="mf_wid" inputmode="decimal" data-live="mf" value="' + esc(m.sheet_wid || 122) + '"></div><div class="field"><label>السُمك (مم)</label><input class="inp ltr" id="mf_th" inputmode="decimal" value="' + esc(m.thickness_mm || '') + '"></div></div></div>' +
    '<div id="mf_liq" class="field"><label>بتتقاس بـ</label><div class="seg" id="mf_base"><button type="button" class="' + (m.base_unit !== 'g' ? 'on' : '') + '" data-act="mfBase" data-v="ml"' + (isNew ? '' : ' disabled') + '>لتر (بويات، ورنيش…)</button><button type="button" class="' + (m.base_unit === 'g' ? 'on' : '') + '" data-act="mfBase" data-v="g"' + (isNew ? '' : ' disabled') + '>كيلو (غراء، معجون…)</button></div></div>' +
    '<div id="mf_packw"><div class="grid g2"><div class="field"><label>اسم العبوة (اختياري)</label><input class="inp" id="mf_plabel" maxlength="20" data-live="mf" value="' + esc(m.pack_label || '') + '" placeholder="علبة، رول، جركن…"></div>' +
    '<div class="field"><label id="mf_packl">العبوة فيها كام</label><input class="inp ltr" id="mf_pack" inputmode="decimal" data-live="mf" value="' + esc(n(m.pack_qty) ? displayQty_(m.pack_qty, m).v : '') + '" placeholder="اختياري"></div></div></div>' +
    '<div class="field"><label>التصنيف</label><input class="inp" id="mf_cat" list="mcats" maxlength="40" value="' + esc(m.category) + '" placeholder="ألواح، خشب، حدايد، دهانات…"><datalist id="mcats">' + catsM.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></div>' +
    '<div class="field"><label>' + (isNew ? 'سعر الشراء' : 'السعر الحالي (متوسط التكلفة)') + '</label><div class="combo"><input class="inp ltr" id="mf_amount" inputmode="decimal" data-live="mf" placeholder="السعر" value="' + esc(dp ? dp.v : '') + '"><span style="align-self:center" class="muted">ج لكل</span>' +
    '<input class="inp ltr" id="mf_pqty" inputmode="decimal" data-live="mf" style="max-width:80px" value="1"><select class="inp unit" id="mf_punit" data-change="mfUnit"></select></div><div id="mf_prev" class="hint"></div>' +
    (isNew ? '' : '<span class="hint">غيّره هنا بس لو عايز تصحح التكلفة — الشراء الجديد بيتسجل من "المشتريات" وبيحسب المتوسط لوحده.</span>') + '</div>' +
    (isNew ? '<div class="field"><label>الرصيد الموجود عندك دلوقتي (اختياري)</label><div class="combo"><input class="inp ltr" id="mf_open" inputmode="decimal" placeholder="0"><select class="inp unit" id="mf_ounit"></select></div></div>' : '') +
    '<div class="field"><label>نبهني لما الرصيد يقل عن</label><div class="combo"><input class="inp ltr" id="mf_min" inputmode="decimal" placeholder="اختياري" value="' + esc(n(m.min_stock) ? displayQty_(m.min_stock, m).v : '') + '"><select class="inp unit" id="mf_munit"></select></div></div>' +
    '<div class="field"><label>نسبة الهالك %</label><input class="inp ltr" id="mf_waste" inputmode="decimal" value="' + esc(m.waste_pct === undefined ? '' : m.waste_pct) + '" placeholder=""><span class="hint" id="mf_wh"></span></div>' +
    '<div class="field"><label>المورد المعتاد (اختياري)</label><select class="inp" id="mf_sup">' + selOpts((S.data.suppliers || []).filter(isActive).map(function (s) { return [s.id, s.name]; }), m.supplier_id, '—') + '</select></div>' +
    photoField('mf', m.image_url, 'صورة الخامة (اختياري)') +
    '<div class="field"><label>ملاحظات</label><textarea class="inp" id="mf_notes" maxlength="300">' + esc(m.notes) + '</textarea></div>';
  modal({ title: isNew ? 'خامة جديدة' : 'تعديل الخامة', body: body, footer: footer('saveMaterial'),
    mount: function () { bindPhoto('mf', S.mf); mfSync(); S.mf.orig = val('mf_amount') + '|' + val('mf_pqty') + '|' + val('mf_punit'); } });
}
function mfSync() {
  var t = S.mf.mtype, p = mfProbe();
  document.getElementById('mf_sheet').classList.toggle('hide', t !== 'sheet');
  document.getElementById('mf_liq').classList.toggle('hide', t !== 'liquid');
  document.getElementById('mf_packw').classList.toggle('hide', !(t === 'linear' || t === 'count' || t === 'liquid'));
  document.getElementById('mf_packl').textContent = 'العبوة فيها كام ' + (t === 'linear' ? 'متر' : t === 'count' ? 'قطعة' : S.mf.base === 'g' ? 'كيلو' : 'لتر');
  var pu = document.getElementById('mf_punit'), keep = pu.value;
  pu.innerHTML = unitOpts(p, keep);
  var ou = document.getElementById('mf_ounit'); if (ou) ou.innerHTML = unitOpts(p, ou.value);
  var mu = document.getElementById('mf_munit'); mu.innerHTML = unitOpts(p, mu.value);
  document.getElementById('mf_waste').placeholder = String(wasteOf_({ mtype: t, waste_pct: '' }, S.data.settings));
  document.getElementById('mf_wh').textContent = 'سيبها فاضية للنسبة العادية لنوع ' + MT_AR[t] + ' (' + wasteOf_({ mtype: t, waste_pct: '' }, S.data.settings) + '%) — بتتغير من الإعدادات.';
  mfPreview();
}
function mfPreview() {
  var box = document.getElementById('mf_prev'); if (!box) return;
  var a = parseIn(val('mf_amount')), q = parseIn(val('mf_pqty')), u = val('mf_punit'), p = mfProbe();
  if (a === '' || isNaN(a) || !(q > 0) || !u) { box.innerHTML = ''; return; }
  try { var per = pricePerBase_(a, q, u, p); box.innerHTML = 'يعني ' + priceM(per, p) + (p.mtype === 'sheet' ? ' · ' + money(per * 10000) + ' / م²' : ''); } catch (e) { box.innerHTML = esc(e.message); }
}
LIVE.mf = function (t) { if (t.id === 'mf_pack' || t.id === 'mf_plabel' || t.id === 'mf_len' || t.id === 'mf_wid') mfSync(); else mfPreview(); };
CHANGE.mfUnit = function () { mfPreview(); };
ACT.mfType = function (el) { S.mf.mtype = el.getAttribute('data-v'); document.querySelectorAll('#mf_type button').forEach(function (b) { b.classList.toggle('on', b === el); }); mfSync(); };
ACT.mfBase = function (el) { S.mf.base = el.getAttribute('data-v'); document.querySelectorAll('#mf_base button').forEach(function (b) { b.classList.toggle('on', b === el); }); mfSync(); };
ACT.newMaterial = function () { materialForm(null); };
ACT.editMaterial = function (el) { materialForm(matById(el.getAttribute('data-p'))); };
ACT.saveMaterial = function () {
  var a = parseIn(val('mf_amount')), pq = parseIn(val('mf_pqty')), mn = parseIn(val('mf_min')), op = document.getElementById('mf_open') ? parseIn(val('mf_open')) : '';
  var w = parseIn(val('mf_waste')), pk = parseIn(val('mf_pack')), len = parseIn(val('mf_len')), wid = parseIn(val('mf_wid')), th = parseIn(val('mf_th'));
  if ([a, pq, mn, op, w, pk, len, wid, th].some(function (x) { return x !== '' && isNaN(x); })) return toast('اكتب الأرقام بشكل صحيح', 'err');
  if (a !== '' && !(pq > 0)) return toast('اكتب الكمية اللي السعر ده ليها', 'err');
  var unchanged = S.mf.id && S.mf.orig === val('mf_amount') + '|' + val('mf_pqty') + '|' + val('mf_punit');
  var pl = { id: S.mf.id, name: val('mf_name'), mtype: S.mf.mtype, base_unit: S.mf.mtype === 'liquid' ? S.mf.base : '', category: val('mf_cat'), notes: val('mf_notes'),
    supplier_id: val('mf_sup'), sheet_len: len, sheet_wid: wid, thickness_mm: th, pack_qty: pk === '' ? 0 : pk, pack_label: val('mf_plabel'), waste_pct: w,
    price: (a === '' || unchanged) ? null : { amount: a, qty: pq, unit: val('mf_punit') },
    min_stock: { qty: mn, unit: val('mf_munit') }, opening: op === '' ? null : { qty: op, unit: val('mf_ounit') },
    image: S.mf.image, removeImage: S.mf.removeImage };
  var after = S.mf.after;
  run('saveMaterial', pl, { rid: S.mf.rid, ok: 'اتحفظت الخامة' }).then(function (r) {
    if (!r) return;
    closeModal();
    if (after) after(r.result.id); else go('material', r.result.id);
  });
};
ACT.archiveMaterial = function (el) {
  var m = matById(el.getAttribute('data-p')), on = isActive(m);
  confirmBox(on ? 'أرشفة الخامة' : 'استرجاع الخامة', on ? 'الخامة هتختفي من القوائم، لكن هتفضل محسوبة في المنتجات والطلبات اللي بتستخدمها.' : 'الخامة هترجع تظهر.', on ? 'أرشفة' : 'استرجاع', on)
    .then(function (y) { if (y) run('setMaterialActive', { id: m.id, active: !on }, { ok: 'تم' }).then(function (r) { if (r) go('materials'); }); });
};
ACT.adjust = function (el) {
  var m = matById(el.getAttribute('data-p'));
  S.adj = { id: m.id, mode: 'count', rid: rid() };
  modal({ title: 'جرد / هالك — ' + m.name, body: '<div class="faint mb">الرصيد في السيستم: <b>' + qtyM(m.stock, m) + '</b></div>' +
    '<div class="field"><div class="seg" id="adj_mode"><button type="button" class="on" data-act="adjMode" data-v="count">جرد (الموجود فعلًا)</button><button type="button" data-act="adjMode" data-v="waste">هالك / تالف</button><button type="button" data-act="adjMode" data-v="add">إضافة بدون شراء</button></div></div>' +
    '<div class="field"><label id="adj_lbl">الكمية الموجودة فعلًا</label><div class="combo"><input class="inp ltr" id="adj_qty" inputmode="decimal" placeholder="0"><select class="inp unit" id="adj_unit">' + unitOpts(m) + '</select></div><span class="hint">ينفع كسور (مثلًا نص لوح = 0.5)</span></div>' +
    '<div class="field"><label>السبب (اختياري)</label><input class="inp" id="adj_notes" maxlength="200"></div>' +
    '<div class="callout info">' + ic('shield', 'sm') + '<div>الجرد والهالك بيعدلوا الكمية بس، مش بيغيروا متوسط السعر.</div></div>', footer: footer('saveAdjust') });
};
ACT.adjMode = function (el) {
  S.adj.mode = el.getAttribute('data-v'); document.querySelectorAll('#adj_mode button').forEach(function (b) { b.classList.toggle('on', b === el); });
  document.getElementById('adj_lbl').textContent = { count: 'الكمية الموجودة فعلًا', waste: 'كمية الهالك', add: 'الكمية المضافة' }[S.adj.mode];
};
ACT.saveAdjust = function () {
  var q = parseIn(val('adj_qty'));
  if (q === '' || isNaN(q) || q < 0) return toast('اكتب كمية صحيحة', 'err');
  run('adjustStock', { material_id: S.adj.id, mode: S.adj.mode, qty: q, unit: val('adj_unit'), notes: val('adj_notes') }, { rid: S.adj.rid, ok: 'اتعدل الرصيد' }).then(function (r) { if (r) { closeModal(); render(); } });
};
ACT.buyMaterial = function (el) { startPurchase(el.getAttribute('data-p')); go('purchases'); };

/* ---------- purchases ---------- */
function startPurchase(matId) {
  var m = matId ? matById(matId) : null;
  S.pu = { supplier_id: m && m.supplier_id ? m.supplier_id : '', supplier_name: '', date: today(), paid: '', paidTouched: false, method: 'cash', notes: '',
           lines: [puLine(m)], rid: rid() };
}
function puLine(m) { return { material_id: m ? m.id : '', qty: '', unit: m ? displayUnit_(m) : '', total: '', bc: '', bl: '', bw: '', bt: '' }; }
VIEWS.purchases = function () {
  topbar('المشتريات');
  if (!S.pu) startPurchase(null);
  var p = S.pu, sups = (S.data.suppliers || []).filter(isActive);
  var h = '<div class="split"><div><div class="card pad"><div class="row mb">' + ic('cart') + '<b style="font-size:17px">فاتورة شراء جديدة</b></div>' +
    '<div class="grid g2"><div class="field"><label>المورد</label><select class="inp" id="pu_sup" data-change="puSup">' + selOpts(sups.map(function (s) { return [s.id, s.name]; }), p.supplier_id, '— اختار —') + '<option value="__new"' + (p.supplier_id === '__new' ? ' selected' : '') + '>+ مورد جديد</option></select></div>' +
    '<div class="field"><label>التاريخ</label><input class="inp" type="date" id="pu_date" data-live="pu" data-f="date" value="' + esc(p.date) + '"></div></div>' +
    (p.supplier_id === '__new' ? '<div class="field"><label>اسم المورد الجديد</label><input class="inp" id="pu_sname" maxlength="60" data-live="pu" data-f="supplier_name" value="' + esc(p.supplier_name) + '"></div>' : '') +
    '<div id="pu_lines"></div><button class="btn btn-soft btn-block" data-act="puAdd">' + ic('plus', 'sm') + 'خامة تانية في نفس الفاتورة</button>' +
    '<div id="pu_sum" class="mt"></div>' +
    '<div class="grid g2 mt"><div class="field"><label>المدفوع دلوقتي</label><input class="inp ltr" id="pu_paid" inputmode="decimal" data-live="pu" data-f="paid" value="' + esc(p.paid) + '"></div>' +
    '<div class="field"><label>طريقة الدفع</label><select class="inp" id="pu_method" data-change="puMethod">' + payOpts(p.method) + '</select></div></div>' +
    '<div class="field"><label>ملاحظات</label><input class="inp" id="pu_notes" maxlength="200" data-live="pu" data-f="notes" value="' + esc(p.notes) + '"></div>' +
    '<button class="btn btn-primary btn-block" data-lockable data-act="savePurchase">' + ic('save', 'sm') + 'تسجيل الفاتورة</button>' +
    '<div class="faint mt">الشراء بيزوّد الرصيد وبيحسب متوسط السعر الجديد لكل خامة. الباقي بيتسجل على المورد.</div></div></div>';
  var list = (S.data.purchases || []).slice(0, 60);
  h += '<div><div class="sect" style="margin-top:0"><h2>آخر فواتير الشراء</h2></div>' + (list.length ? '<div class="card list">' + list.map(function (pu) {
    var s = supById(pu.supplier_id), v = pu.status === 'reversed';
    return '<div class="li static" style="align-items:flex-start"><div class="avatar no">' + esc(pu.purchase_no) + '</div><div class="grow"><div class="main-t"' + (v ? ' style="text-decoration:line-through"' : '') + '>' + esc(s ? s.name : 'بدون مورد') + '</div>' +
      '<div class="faint">' + fmtDate(pu.purchase_date) + (v ? ' · ملغية' : '') + '</div><div class="faint wrap-text">' + pu.lines.map(function (l) { var m = matById(l.material_id) || {}; return esc(l.material_name) + ' ' + (l.input_text ? esc(l.input_text) : '<span class="num">' + fmt(l.input_qty, 3) + '</span> ' + esc(unitLabel(l.input_unit, m))); }).join('، ') + '</div></div>' +
      '<div class="end"><div style="font-weight:700">' + money(pu.total, 0) + '</div>' + (!v ? '<button class="link faint" data-act="revPurchase" data-p="' + esc(pu.id) + '">إلغاء</button>' : '') + '</div></div>';
  }).join('') + '</div>' : emptyBox('cart', 'لسه مفيش مشتريات')) + '</div></div>';
  return h;
};
AFTER.purchases = function () { puRender(); };
function puRender() {
  var box = document.getElementById('pu_lines'); if (!box) return;
  box.innerHTML = S.pu.lines.map(function (l, i) {
    var m = matById(l.material_id), board = l.unit === 'board';
    var units = m ? unitOpts(m, l.unit, m.mtype === 'solid' ? ['board'] : null) : '<option value="">—</option>';
    return '<div class="piece mb"><div class="pr"><div><label>الخامة</label><select class="inp sm" data-change="puMat" data-i="' + i + '">' + matOptions(l.material_id) + '</select></div>' +
      '<div><label>الكمية</label><div class="combo">' + (board ? '' : '<input class="inp sm ltr" inputmode="decimal" data-live="pul" data-i="' + i + '" data-f="qty" value="' + esc(l.qty) + '">') + '<select class="inp sm" ' + (board ? '' : 'style="flex:0 0 130px" ') + 'data-change="puUnit" data-i="' + i + '">' + units + '</select></div></div></div>' +
      (board ? '<div class="dims"><div><label>عدد الألواح/العروق</label><input class="inp sm ltr" inputmode="decimal" data-live="pul" data-i="' + i + '" data-f="bc" value="' + esc(l.bc) + '"></div><div><label>الطول سم</label><input class="inp sm ltr" inputmode="decimal" data-live="pul" data-i="' + i + '" data-f="bl" value="' + esc(l.bl) + '"></div><div><label>العرض سم</label><input class="inp sm ltr" inputmode="decimal" data-live="pul" data-i="' + i + '" data-f="bw" value="' + esc(l.bw) + '"></div><div><label>السُمك سم</label><input class="inp sm ltr" inputmode="decimal" data-live="pul" data-i="' + i + '" data-f="bt" value="' + esc(l.bt) + '"></div></div>' : '') +
      '<div class="dims" style="grid-template-columns:1fr"><div><label>إجمالي سعر السطر ده (ج)</label><input class="inp sm ltr" inputmode="decimal" data-live="pul" data-i="' + i + '" data-f="total" value="' + esc(l.total) + '"></div></div>' +
      '<div class="foot"><span class="grow faint" id="pul' + i + '"></span>' + (S.pu.lines.length > 1 ? '<button class="iconbtn sm" data-act="puDel" data-i="' + i + '">' + ic('trash', 'sm') + '</button>' : '') + '</div></div>';
  }).join('');
  puCalc();
}
function puLineBase(l, m) {
  if (!m) return 0;
  if (l.unit === 'board') return boardVolume_(n(l.bc), n(l.bl), n(l.bw), n(l.bt));
  try { return n(l.qty) * unitFactor_(l.unit || displayUnit_(m), m); } catch (e) { return 0; }
}
function puCalc() {
  var total = 0, seen = {};
  S.pu.lines.forEach(function (l, i) {
    var el = document.getElementById('pul' + i), m = matById(l.material_id), qb = puLineBase(l, m), t = n(l.total);
    total += t;
    if (!el) return;
    if (!m || !(qb > 0)) { el.innerHTML = m ? 'في المخزن: ' + qtyM(m.stock, m) : ''; return; }
    var st = n(m.stock) + (seen[m.id] ? seen[m.id].q : 0), av = seen[m.id] ? seen[m.id].a : n(m.avg_cost);
    var avg = weightedAvg_(st, av, qb, t); seen[m.id] = { q: st + qb - n(m.stock), a: avg };
    el.innerHTML = qtyM(qb, m, 3) + (t > 0 ? ' · سعر الشراء ' + priceM(t / qb, m) + ' · <b>المتوسط الجديد ' + priceM(avg, m) + '</b>' : '') + ' · الرصيد بعد الشراء ' + qtyM(n(m.stock) + qb, m);
  });
  if (!S.pu.paidTouched) { S.pu.paid = total ? String(Math.round(total * 100) / 100) : ''; var pi = document.getElementById('pu_paid'); if (pi && document.activeElement !== pi) pi.value = S.pu.paid; }
  var rem = total - n(S.pu.paid), box = document.getElementById('pu_sum');
  if (box) box.innerHTML = '<div class="card pad" style="box-shadow:none;background:var(--oak-2)">' + kv('إجمالي الفاتورة', '<b>' + money(total) + '</b>') + kv('الباقي على الورشة للمورد', '<b class="' + (rem > 0.009 ? 'neg' : '') + '">' + money(Math.max(0, rem)) + '</b>') + '</div>';
}
LIVE.pu = function (t) { var f = t.getAttribute('data-f'); S.pu[f] = t.value; if (f === 'paid') { S.pu.paidTouched = true; puCalc(); } };
LIVE.pul = function (t) { S.pu.lines[+t.getAttribute('data-i')][t.getAttribute('data-f')] = t.value; puCalc(); };
CHANGE.puSup = function (t) { S.pu.supplier_id = t.value; render(); };
CHANGE.puMethod = function (t) { S.pu.method = t.value; };
CHANGE.puMat = function (t) { var l = S.pu.lines[+t.getAttribute('data-i')], m = matById(t.value); l.material_id = t.value; l.unit = m ? displayUnit_(m) : ''; if (m && m.supplier_id && !S.pu.supplier_id) { S.pu.supplier_id = m.supplier_id; render(); return; } puRender(); };
CHANGE.puUnit = function (t) { S.pu.lines[+t.getAttribute('data-i')].unit = t.value; puRender(); };
ACT.puAdd = function () { S.pu.lines.push(puLine(null)); puRender(); };
ACT.puDel = function (el) { S.pu.lines.splice(+el.getAttribute('data-i'), 1); puRender(); };
ACT.savePurchase = function () {
  var p = S.pu, err = '';
  var lines = p.lines.filter(function (l) { return l.material_id; }).map(function (l, i) {
    var t = parseIn(l.total);
    if (t === '' || isNaN(t) || t < 0) err = err || 'اكتب سعر السطر ' + (i + 1);
    if (l.unit === 'board') {
      var b = { count: parseIn(l.bc), l: parseIn(l.bl), w: parseIn(l.bw), t: parseIn(l.bt) };
      if (!(b.count > 0 && b.l > 0 && b.w > 0 && b.t > 0)) err = err || 'اكتب عدد ومقاسات الخشب في السطر ' + (i + 1);
      return { material_id: l.material_id, unit: 'board', board: b, total_price: t };
    }
    var q = parseIn(l.qty); if (!(q > 0)) err = err || 'اكتب الكمية في السطر ' + (i + 1);
    return { material_id: l.material_id, qty: q, unit: l.unit, total_price: t };
  });
  if (!lines.length) return toast('اختار خامة واحدة على الأقل', 'err');
  if (err) return toast(err, 'err');
  var paid = parseIn(p.paid); if (isNaN(paid) || paid < 0) return toast('المدفوع غير صحيح', 'err');
  var pl = { date: p.date, lines: lines, paid_now: paid === '' ? 0 : paid, method: p.method, notes: p.notes };
  if (p.supplier_id === '__new') { if (!String(p.supplier_name).trim()) return toast('اكتب اسم المورد', 'err'); pl.supplier_name = p.supplier_name; }
  else pl.supplier_id = p.supplier_id;
  run('savePurchase', pl, { rid: p.rid, ok: 'اتسجلت الفاتورة واتحدث المتوسط' }).then(function (r) { if (r) { startPurchase(null); render(); } });
};
ACT.revPurchase = function (el) {
  var id = el.getAttribute('data-p');
  confirmBox('إلغاء فاتورة الشراء', 'الكميات هتتشال من الرصيد والمتوسط يرجع زي ما كان، والمدفوع معاها هيتلغي. متاح بس لو مفيش حركة اتعملت على خاماتها بعد الفاتورة دي.', 'إلغاء الفاتورة', true)
    .then(function (y) { if (y) run('reversePurchase', { id: id }, { ok: 'اتلغت الفاتورة' }).then(function (r) { if (r) render(); }); });
};

/* ---------- production ---------- */
VIEWS.production = function () {
  topbar('التصنيع');
  var open = (S.data.orders || []).filter(isOpen), pend = [];
  open.forEach(function (o) { (o.items || []).forEach(function (it) { if (n(it.made_qty) < n(it.qty)) pend.push({ o: o, it: it }); }); });
  pend.sort(function (a, b) { return String(a.o.due_date || '9999').localeCompare(String(b.o.due_date || '9999')); });
  var h = '<div class="split"><div><div class="sect" style="margin-top:0"><h2>مطلوب تصنيعه للطلبات</h2></div>';
  h += pend.length ? '<div class="card list">' + pend.map(function (x) {
    var rem = n(x.it.qty) - n(x.it.made_qty);
    return '<div class="li static"><div class="avatar no">' + esc(x.o.order_no) + '</div><div class="grow"><div class="main-t">' + esc(x.it.name) + ' <span class="faint">× ' + fmt(rem, 0) + '</span></div><div class="faint">' + esc(custOf(x.o).name || '') + (x.o.due_date ? ' · التسليم ' + fmtDate(x.o.due_date) : '') + (isLate(x.o) ? ' <span class="badge b-bad">متأخر</span>' : '') + '</div></div>' +
      '<button class="btn btn-soft btn-sm" data-act="ordProduceItem" data-p="' + esc(x.o.id) + '" data-i="' + esc(x.it.id) + '">' + ic('saw', 'sm') + 'تسجيل</button></div>';
  }).join('') + '</div>' : '<div class="card empty">مفيش بنود مستنية تصنيع.</div>';
  var ready = prods().filter(function (p) { return isActive(p) && p.lines.length; });
  h += '<div class="sect"><h2>تصنيع للمخزن (منتجات قياسية)</h2></div>' + (ready.length ? '<div class="card list">' + ready.map(function (p) {
    return '<div class="li static"><div class="avatar">' + initials(p.name) + picImg(p.image_url) + '</div><div class="grow"><div class="main-t">' + esc(p.name) + '</div><div class="faint">في المخزن <b class="num">' + fmt(p.stock, 0) + '</b></div></div>' +
      '<button class="btn btn-ghost btn-sm" data-act="produceStock" data-p="' + esc(p.id) + '">' + ic('plus', 'sm') + 'تصنيع</button></div>';
  }).join('') + '</div>' : '<div class="card empty">ضيف منتجات بقطعها في الكتالوج الأول.</div>');
  var list = (S.data.production || []).slice(0, 60);
  h += '</div><div><div class="sect" style="margin-top:0"><h2>آخر عمليات التصنيع</h2></div>' + (list.length ? '<div class="card list">' + list.map(prodBatchRow).join('') + '</div>' : emptyBox('saw', 'لسه مفيش تصنيع متسجل')) + '</div></div>';
  return h;
};
AFTER.production = function () {
  if (S.prodPre) { var p = S.prodPre; S.prodPre = null; if (p.target === 'stock' && prodById(p.product_id)) produceStockModal(prodById(p.product_id)); }
};
ACT.produceStock = function (el) { produceStockModal(prodById(el.getAttribute('data-p'))); };
function stockMaterials(p, k) {
  return materialsForUnits_(p.lines, k, matMap(), S.data.settings, {}).map(function (x) {
    var m = matById(x.material_id), u = displayUnit_(m);
    return { material_id: x.material_id, qty: +(x.qty / unitFactor_(u, m)).toFixed(m.mtype === 'solid' ? 4 : 3), unit: u };
  });
}
function produceStockModal(p) {
  S.ps = { product_id: p.id };
  matLinesModal({ title: 'تصنيع للمخزن — ' + p.name, intro: 'الخامات متعبية من مقاسات المنتج (بالهالك) — عدّلها حسب اللي اتصرف فعلًا.',
    extraTop: '<div class="field"><label>عدد القطع</label><input class="inp ltr" id="ps_qty" inputmode="numeric" value="1" data-live="psQty"></div>',
    lines: stockMaterials(p, 1), button: 'تسجيل التصنيع وخصم الخامات',
    action: function (payload, r0) {
      var q = parseIn(val('ps_qty'));
      if (!(q >= 1) || Math.floor(q) !== q) return toast('اكتب عدد قطع صحيح', 'err');
      run('recordProduction', { target: 'stock', product_id: p.id, qty: q, materials: payload, date: val('ml_date') }, { rid: r0, ok: 'اتسجل التصنيع ودخل المخزن', onErr: function (e) { if (e.code === 'MATERIAL_SHORT') { showShort(e); return true; } } })
        .then(function (r) { if (r) { closeModal(); render(); } });
    } });
}
LIVE.psQty = function (t) { var q = parseIn(t.value); if (q > 0) { S.ml.lines = stockMaterials(prodById(S.ps.product_id), q); mlRender(); } };
