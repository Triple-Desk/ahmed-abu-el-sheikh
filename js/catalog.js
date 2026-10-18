/* Catalog products (templates with pieces), the shared piece editor, products store. */

/* ---------- products list ---------- */
VIEWS.products = function () {
  topbar('المنتجات', { right: '<button class="btn btn-primary btn-sm desk-only" data-act="newProduct">' + ic('plus', 'sm') + 'منتج جديد</button>' });
  var f = S.filters;
  var h = '<div class="seg mb" style="max-width:420px"><button class="' + (f.storeTab === 'catalog' ? 'on' : '') + '" data-act="storeTab" data-v="catalog">الكتالوج</button><button class="' + (f.storeTab === 'store' ? 'on' : '') + '" data-act="storeTab" data-v="store">مخزن المنتجات الجاهزة</button></div>';
  if (f.storeTab === 'store') return h + storeView();
  var all = prods().filter(function (p) { return f.archived ? !isActive(p) : isActive(p); });
  var cl = cats().slice(); all.forEach(function (p) { if (p.category && cl.indexOf(p.category) < 0) cl.push(p.category); });
  var list = all.filter(function (p) {
    return (f.prodCat === 'all' || p.category === f.prodCat) && (!f.prodQ || String(p.name).toLowerCase().indexOf(f.prodQ.toLowerCase()) >= 0);
  });
  h += '<div class="row mb"><div class="search"><input class="inp" id="prodQ" placeholder="ابحث عن منتج…" value="' + esc(f.prodQ) + '" data-live="prodQ">' + ic('search', 'sm') + '</div></div>';
  h += '<div class="chips mb"><button class="chip ' + (f.prodCat === 'all' ? 'on' : '') + '" data-act="prodCat" data-v="all">الكل</button>' +
    cl.map(function (c) { return '<button class="chip ' + (f.prodCat === c ? 'on' : '') + '" data-act="prodCat" data-v="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') +
    '<button class="chip ' + (f.archived ? 'on' : '') + '" data-act="toggleArchived">' + (f.archived ? 'المؤرشف' : 'عرض المؤرشف') + '</button></div>';
  if (!list.length) return h + emptyBox('sofa', f.archived ? 'مفيش منتجات مؤرشفة' : 'مفيش منتجات هنا لسه — ضيف أول منتج بقطعه ومقاساته', f.archived ? '' : 'newProduct', 'منتج جديد');
  h += '<div class="pgrid">' + list.map(productCard).join('') + '</div>';
  h += '<button class="btn btn-primary fab" data-act="newProduct">' + ic('plus') + 'منتج جديد</button>';
  return h;
};
function productCard(p) {
  var c = p.cost, st = n(p.stock);
  return '<div class="card pcard" data-act="nav" data-v="product" data-p="' + esc(p.id) + '">' +
    '<div class="pimg">' + initials(p.name) + picImg(p.image_url) +
    (c.warnings.length ? '<span class="flag badge b-warn">' + ic('alert', 'sm') + '</span>' : '') +
    '<span class="stock-pill ' + (st > 0 ? 'ok' : 'out') + '">' + ic('box', 'sm') + 'في المخزن <span class="num">' + fmt(st, 0) + '</span></span></div>' +
    '<div class="pbody"><div class="pname">' + esc(p.name) + '</div><div class="faint">' + esc(p.category || 'بدون نوع') + '</div>' +
    '<div class="pmeta"><span>التكلفة</span><span class="num">' + fmt(c.total, 0) + '</span></div>' +
    '<div class="pmeta"><span>السعر</span><span class="pprice">' + money(p.selling_price, 0) + '</span></div>' +
    '<div style="margin-top:auto;padding-top:4px">' + marginBadge(c) + '</div></div></div>';
}
function marginBadge(c) {
  if (!c || !(n(c.price) > 0)) return '<span class="badge b-gray">بدون سعر</span>';
  var m = n(c.margin) * 100;
  if (c.profit <= 0) return '<span class="badge b-bad">' + ic('alert', 'sm') + ' خسارة</span>';
  if (m < target()) return '<span class="badge b-warn">هامش ' + pct(c.margin) + '</span>';
  return '<span class="badge b-ok">هامش ' + pct(c.margin) + '</span>';
}
ACT.storeTab = function (el) { S.filters.storeTab = el.getAttribute('data-v'); render(); };
ACT.prodCat = function (el) { S.filters.prodCat = el.getAttribute('data-v'); render(); };
LIVE.prodQ = function (t) { S.filters.prodQ = t.value; softRender('prodQ'); };

/** Products store: ready catalog items + finished pieces waiting for their orders. */
function storeView() {
  var stockP = prods().filter(function (p) { return n(p.stock) !== 0; });
  var waiting = [];
  (S.data.orders || []).forEach(function (o) {
    (o.items || []).forEach(function (it) {
      var avail = n(it.made_qty) - n(it.out_item);
      if (avail > 0) waiting.push({ o: o, it: it, avail: avail });
    });
  });
  var val = stockP.reduce(function (a, p) { return a + Math.max(0, n(p.stock)) * n(p.avg_cost); }, 0);
  var h = '<div class="grid g2 g4 mb">' + kpi('قطع جاهزة للبيع', '<span class="num">' + fmt(stockP.reduce(function (a, p) { return a + Math.max(0, n(p.stock)); }, 0), 0) + '</span>', 'من المنتجات القياسية', 'box') +
    kpi('قيمتها (خامات)', money(val, 0), 'بمتوسط تكلفة التصنيع', 'coins') +
    kpi('قطع مستنية التسليم', '<span class="num">' + fmt(waiting.reduce(function (a, x) { return a + x.avail; }, 0), 0) + '</span>', 'اتصنعت لطلبات', 'truck') + '</div>';
  h += '<div class="sect"><h2>منتجات جاهزة في المخزن</h2><span class="grow"></span><button class="btn btn-soft btn-sm" data-act="nav" data-v="production">' + ic('saw', 'sm') + 'تصنيع للمخزن</button></div>';
  h += stockP.length ? '<div class="card tscroll"><table class="t"><thead><tr><th>المنتج</th><th class="n">الرصيد</th><th class="n">تكلفة القطعة</th><th class="n">القيمة</th></tr></thead><tbody>' + stockP.map(function (p) {
    return '<tr data-act="nav" data-v="product" data-p="' + esc(p.id) + '" style="cursor:pointer"><td><b>' + esc(p.name) + '</b></td><td class="n"><b class="num" style="font-size:18px">' + fmt(p.stock, 0) + '</b></td><td class="n">' + money(p.avg_cost) + '</td><td class="n">' + money(Math.max(0, n(p.stock)) * n(p.avg_cost), 0) + '</td></tr>';
  }).join('') + '</tbody></table></div>' : '<div class="card empty">مفيش منتجات جاهزة — سجّل "تصنيع للمخزن" للحاجات القياسية زي الأبواب.</div>';
  h += '<div class="sect"><h2>قطع اتصنعت ومستنية التسليم</h2></div>';
  h += waiting.length ? '<div class="card list">' + waiting.map(function (x) {
    return '<div class="li" data-act="nav" data-v="order" data-p="' + esc(x.o.id) + '"><div class="avatar no">' + esc(x.o.order_no) + '</div><div class="grow"><div class="main-t">' + esc(x.it.name) + '</div><div class="faint">' + esc(custOf(x.o).name || '') + ' · ' + statusBadge(x.o) + '</div></div><div class="end"><b class="num" style="font-size:20px">' + fmt(x.avail, 0) + '</b><div class="faint">قطعة</div></div></div>';
  }).join('') + '</div>' : '<div class="card empty">مفيش قطع مستنية.</div>';
  var mv = (S.data.movements || []).filter(function (x) { return x.item_type !== 'material'; }).slice(0, 40);
  h += '<div class="sect"><h2>آخر حركات مخزن المنتجات</h2></div>' + productMovesTable(mv, true);
  return h;
}
var MV_AR = { OPENING: 'رصيد افتتاحي', PURCHASE: 'شراء', PURCHASE_REVERSAL: 'إلغاء شراء', ISSUE: 'صرف على طلب', ISSUE_REVERSAL: 'إلغاء صرف (تصنيع)',
  RETURN: 'مرتجع من طلب', CONSUME: 'تصنيع للمخزن', CONSUME_REVERSAL: 'إلغاء تصنيع', COUNT: 'جرد', WASTE: 'هالك / تالف', ADD: 'إضافة بدون شراء',
  PRICE: 'تعديل سعر', PRODUCE: 'تصنيع للمخزن', PRODUCE_REVERSAL: 'إلغاء تصنيع', SALE: 'تسليم لعميل', SALE_RETURN: 'رجوع من طلب ملغي',
  MAKE: 'اتصنع للطلب', MAKE_REVERSAL: 'إلغاء تصنيع', DELIVER: 'تسليم لعميل', DELIVER_RETURN: 'رجوع من طلب ملغي' };
function mvName(x) { return '<b>' + (MV_AR[x.type] || esc(x.type)) + '</b>'; }
function productMovesTable(mv, withName) {
  if (!mv.length) return '<div class="card empty">لسه مفيش حركة.</div>';
  return '<div class="card tscroll"><table class="t"><thead><tr><th>التاريخ</th>' + (withName ? '<th>المنتج</th>' : '') + '<th>الحركة</th><th class="n">القطع</th><th class="n">الرصيد بعدها</th></tr></thead><tbody>' + mv.map(function (x) {
    var o = x.order_id ? orderById(x.order_id) : null;
    return '<tr><td>' + fmtDate(x.mv_date) + '</td>' + (withName ? '<td>' + esc(x.item_name) + '</td>' : '') + '<td>' + mvName(x) + (o ? ' <button class="link" data-act="nav" data-v="order" data-p="' + esc(o.id) + '">' + esc(o.order_no) + '</button>' : '') + (x.notes && !o ? '<div class="faint">' + esc(x.notes) + '</div>' : '') + '</td>' +
      '<td class="n ' + (n(x.qty) < 0 ? 'neg' : 'pos') + '"><span class="num">' + fmt(x.qty, 0) + '</span></td><td class="n"><span class="num">' + fmt(x.stock_after, 0) + '</span></td></tr>';
  }).join('') + '</tbody></table></div>';
}

/* ---------- product page ---------- */
VIEWS.product = function (id) {
  var p = prodById(id);
  if (!p) { topbar('المنتج', { back: 'products' }); return emptyBox('sofa', 'المنتج مش موجود'); }
  var c = p.cost, tm = target(), mm = matMap();
  topbar(p.name, { back: 'products', right: '<button class="iconbtn" data-act="editProduct" data-p="' + esc(p.id) + '" aria-label="تعديل">' + ic('edit') + '</button>' });
  var h = '<div class="split"><div>';
  h += '<div class="card pad"><div class="hero-head"><div class="hero-img">' + initials(p.name) + picImg(p.image_url) + '</div>' +
    '<div style="min-width:0"><div style="font-size:20px;font-weight:700">' + esc(p.name) + '</div><div class="faint">' + esc(p.category || 'بدون نوع') + '</div>' +
    (!isActive(p) ? '<span class="badge b-gray mt">مؤرشف</span>' : '') + '</div></div>';
  h += '<div class="stockbox ' + (n(p.stock) > 0 ? 'ok' : 'out') + '"><div class="big num">' + fmt(p.stock, 0) + '</div><div class="lbl"><b>' + (n(p.stock) > 0 ? 'قطعة جاهزة في المخزن' : 'مفيش قطع جاهزة') + '</b><span>مخزن المنتجات الجاهزة</span></div>' +
    '<button class="btn btn-ghost btn-sm" data-act="goProduceStock" data-p="' + esc(p.id) + '">' + ic('saw', 'sm') + 'تصنيع</button></div>';
  h += '<div class="grid g2 g4 mt">' + stat('تكلفة القطعة', money(c.total, 0)) + stat('سعر البيع', money(p.selling_price, 0)) +
    stat('ربح القطعة', '<span class="' + profitCls(c.profit) + '">' + money(c.profit, 0) + '</span>') + stat('هامش الربح', pct(c.margin)) + '</div></div>';
  if (c.warnings.length) h += '<div class="callout warn mt">' + ic('alert', 'sm') + '<div>' + c.warnings.map(esc).join('<br>') + '</div></div>';
  var pieces = p.lines.filter(function (l) { return l.ltype === 'piece'; }), items = p.lines.filter(function (l) { return l.ltype === 'item'; });
  h += '<div class="sect"><h2>القطع والمقاسات</h2><span class="grow"></span><button class="btn btn-soft btn-sm" data-act="editProduct" data-p="' + esc(p.id) + '">' + ic('edit', 'sm') + 'تعديل القطع</button></div>';
  h += pieces.length ? '<div class="card tscroll"><table class="t"><thead><tr><th>القطعة</th><th class="n">العدد</th><th class="n">المقاس (سم)</th><th>الخامة</th></tr></thead><tbody>' + pieces.map(function (l) {
    var m = mm[l.material_id] || {};
    return '<tr><td><b>' + esc(l.name || 'قطعة') + '</b>' + (l.notes ? '<div class="faint">' + esc(l.notes) + '</div>' : '') + '</td><td class="n num">' + fmt(l.count, 0) + '</td><td class="n"><span class="num">' + dimsText(l, m) + '</span></td><td>' + esc(m.name ? matLabel(m) : '—') + '</td></tr>';
  }).join('') + '</tbody></table></div>' : '<div class="card empty">لسه مفيش قطع.</div>';
  if (items.length) {
    h += '<div class="sect"><h2>إكسسوارات وتشطيب (للقطعة الواحدة)</h2></div><div class="card tscroll"><table class="t"><tbody>' + items.map(function (l) {
      var m = mm[l.material_id] || {};
      return '<tr><td><b>' + esc(l.name || m.name || '') + '</b>' + (l.name && m.name && l.name !== m.name ? '<div class="faint">' + esc(m.name) + '</div>' : '') + '</td><td class="n"><span class="num">' + fmt(l.qty, 3) + '</span> ' + esc(unitLabel(l.unit, m)) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  if (p.labor.length) h += '<div class="sect"><h2>مصنعية وشغل بره (للقطعة)</h2></div><div class="card pad">' + p.labor.map(function (x) { return kv(esc(x.kind), money(x.amount)); }).join('') + '</div>';
  var mv = (S.data.movements || []).filter(function (x) { return x.item_id === p.id; }).slice(0, 30);
  h += '<div class="sect"><h2>حركة المنتج في المخزن</h2></div>' + productMovesTable(mv, false);
  h += '</div><div class="sticky">';
  h += costCard(c, n(p.selling_price), 1);
  h += '<div class="card pad mt"><div class="row mb">' + ic('calc', 'sm') + '<b>سعر مقترح حسب هامش الربح</b></div>';
  [tm, 20, 40].filter(function (x, i, a) { return a.indexOf(x) === i; }).sort(function (a, b) { return a - b; }).forEach(function (m) {
    h += '<div class="kv"><span>هامش <span class="num">' + m + '%</span>' + (m === tm ? ' <span class="badge b-wood">المستهدف</span>' : '') + '</span><b>' + money(Math.ceil(suggestedPrice_(c.total, m)), 0) + '</b></div>';
  });
  h += '<div class="faint mt">الهامش = الربح ÷ سعر البيع.</div></div>';
  h += '<div class="actions mt"><button class="btn btn-primary full" data-act="quoteWithProduct" data-p="' + esc(p.id) + '">' + ic('receipt', 'sm') + 'عرض سعر بالمنتج ده</button>' +
    '<button class="btn btn-ghost" data-act="dupProduct" data-p="' + esc(p.id) + '">' + ic('copy', 'sm') + 'نسخ المنتج</button>' +
    '<button class="btn btn-ghost" data-act="adjustProduct" data-p="' + esc(p.id) + '">' + ic('box', 'sm') + 'جرد المخزن</button>' +
    '<button class="btn btn-ghost full" data-act="archiveProduct" data-p="' + esc(p.id) + '">' + ic('archive', 'sm') + (isActive(p) ? 'أرشفة المنتج' : 'استرجاع المنتج') + '</button></div>';
  h += '</div></div>';
  return h;
};
function dimsText(l, m) {
  var t = m && m.mtype;
  if (t === 'solid') return fmt(l.length, 1) + '×' + fmt(l.width, 1) + '×' + fmt(l.thickness, 1);
  if (t === 'linear') return fmt(l.length, 1);
  if (t === 'count') return '—';
  return fmt(l.length, 1) + '×' + fmt(l.width, 1);
}
/** Cost box: materials by category + labor, price, profit, margin. c = productCost_/costGroups group-like {material_cost, labor_cost, total, by_cat} */
function costCard(c, price, qty, title) {
  var tot = n(c.total) || 1, h = '<div class="card pad"><div class="between mb"><b>' + esc(title || 'تكلفة القطعة الواحدة') + '</b><span class="faint">بأسعار النهارده</span></div><div class="bars">';
  var keys = Object.keys(c.by_cat || {}).sort(function (a, b) { return c.by_cat[b] - c.by_cat[a]; });
  var cls = ['', 'c2', 'c3', 'c4'];
  keys.forEach(function (k, i) { h += bar(k, c.by_cat[k], tot, cls[i % 4]); });
  if (n(c.labor_cost) > 0) h += bar('مصنعية وشغل بره', c.labor_cost, tot, 'c4');
  if (!keys.length && !(n(c.labor_cost) > 0)) h += '<div class="faint">لسه مفيش تكلفة — ضيف القطع والخامات.</div>';
  h += '</div><div class="mt">' + kv('الخامات', money(c.material_cost)) + kv('المصنعية والشغل', money(c.labor_cost)) +
    '<div class="kv total"><span>إجمالي التكلفة</span><span>' + money(c.total) + '</span></div>';
  if (price !== undefined) {
    var profit = n(price) - n(c.total);
    h += kv('سعر البيع', money(price)) + '<div class="kv total"><span>الربح</span><span class="' + profitCls(profit) + '">' + money(profit) + '</span></div>' +
      kv('هامش الربح', n(price) > 0 ? pct(profit / n(price)) : '—');
  }
  return h + '</div></div>';
}

/* ---------- product actions ---------- */
ACT.newProduct = function () { startItemEditor('product', null); };
ACT.editProduct = function (el) { startItemEditor('product', prodById(el.getAttribute('data-p'))); };
ACT.dupProduct = function (el) {
  var p = prodById(el.getAttribute('data-p')), r0 = rid();
  modal({ title: 'نسخ المنتج', body: '<div class="faint mb">هيتعمل منتج جديد بنفس القطع والمقاسات والسعر، وتعدل فيه براحتك.</div><div class="field"><label>اسم المنتج الجديد</label><input class="inp" id="dup_name" maxlength="80" value="' + esc(p.name) + ' (نسخة)"></div>',
    footer: '<button class="btn btn-ghost" data-act="closeModal">إلغاء</button><button class="btn btn-primary" data-lockable id="dupGo">' + ic('copy', 'sm') + 'نسخ</button>',
    mount: function () { document.getElementById('dupGo').onclick = function () { run('duplicateProduct', { id: p.id, name: val('dup_name') }, { rid: r0, ok: 'اتنسخ المنتج' }).then(function (r) { if (r) go('product', r.result.id); }); }; } });
};
ACT.archiveProduct = function (el) {
  var p = prodById(el.getAttribute('data-p')), on = isActive(p);
  confirmBox(on ? 'أرشفة المنتج' : 'استرجاع المنتج', on ? 'المنتج هيختفي من القوائم وعروض الأسعار الجديدة، والطلبات القديمة هتفضل زي ما هي.' : 'المنتج هيرجع يظهر في القوائم.', on ? 'أرشفة' : 'استرجاع', on)
    .then(function (y) { if (y) run('setProductActive', { id: p.id, active: !on }, { ok: 'تم' }).then(function (r) { if (r) go('products'); }); });
};
ACT.adjustProduct = function (el) {
  var p = prodById(el.getAttribute('data-p')), r0 = rid();
  modal({ title: 'جرد المخزن: ' + p.name, body: '<div class="faint mb">الرصيد في السيستم: <b class="num">' + fmt(p.stock, 0) + '</b> قطعة</div>' +
    '<div class="field"><div class="seg" id="ap_mode"><button type="button" class="on" data-act="apMode" data-v="count">العدد الفعلي (جرد)</button><button type="button" data-act="apMode" data-v="waste">تالف / هالك</button></div></div>' +
    '<div class="field"><label id="ap_lbl">العدد الموجود فعلًا</label><input class="inp ltr" id="ap_qty" inputmode="numeric" placeholder="0"></div>' +
    '<div class="field"><label>السبب (اختياري)</label><input class="inp" id="ap_notes" maxlength="200"></div>',
    footer: footer('saveAdjustProduct'), mount: function () { S.ap = { id: p.id, mode: 'count', rid: r0 }; } });
};
ACT.apMode = function (el) { S.ap.mode = el.getAttribute('data-v'); document.querySelectorAll('#ap_mode button').forEach(function (b) { b.classList.toggle('on', b === el); }); document.getElementById('ap_lbl').textContent = S.ap.mode === 'count' ? 'العدد الموجود فعلًا' : 'عدد القطع التالفة'; };
ACT.saveAdjustProduct = function () {
  var q = parseIn(val('ap_qty'));
  if (q === '' || isNaN(q) || q < 0 || Math.floor(q) !== q) return toast('اكتب عدد صحيح', 'err');
  run('adjustProductStock', { product_id: S.ap.id, mode: S.ap.mode, qty: q, notes: val('ap_notes') }, { rid: S.ap.rid, ok: 'اتعدل الرصيد' }).then(function (r) { if (r) { closeModal(); render(); } });
};
ACT.goProduceStock = function (el) { S.prodPre = { target: 'stock', product_id: el.getAttribute('data-p') }; go('production'); };
ACT.quoteWithProduct = function (el) {
  var p = prodById(el.getAttribute('data-p'));
  startOrder(null); S.draft.items.push(itemFromProduct(p)); render();
};

/* ======================= the piece editor (product template OR one order item) ======================= */
function cloneLines(lines) {
  return (lines || []).map(function (l) {
    return { ltype: l.ltype, name: l.name || '', material_id: l.material_id || '', count: l.count === '' ? '' : l.count, length: l.length, width: l.width,
             thickness: l.thickness, qty: l.qty, unit: l.unit || '', notes: l.notes || '' };
  });
}
function startItemEditor(mode, src, idx) {
  src = src || {};
  if (mode === 'product') {
    S.idraft = { mode: 'product', id: src.id || '', name: src.name || '', category: src.category || '', price: src.selling_price === undefined ? '' : src.selling_price,
      notes: src.notes || '', labor: (src.labor || []).map(function (x) { return { kind: x.kind, amount: x.amount }; }), lines: cloneLines(src.lines),
      image_url: src.image_url || '', image: null, removeImage: false, rid: rid() };
  } else {
    S.idraft = { mode: 'order', idx: idx === undefined ? -1 : idx, product_id: src.product_id || '', name: src.name || '', category: src.category || '',
      qty: src.qty || 1, price: src.unit_price === undefined ? '' : src.unit_price, spec: src.spec || '', notes: src.notes || '',
      labor: (src.labor || []).map(function (x) { return { kind: x.kind, amount: x.amount }; }), lines: cloneLines(src.lines),
      image_id: src.image_id || '', image_url: src.image_url || src.preview || '', image: src.image || null, removeImage: false };
  }
  if (!S.idraft.lines.length && !src.id && !src.name) S.idraft.lines.push(newPiece());
  go('itemEdit');
}
function lastMaterial(type) {
  var d = S.idraft, ls = (d && d.lines) || [];
  for (var i = ls.length - 1; i >= 0; i--) { var m = matById(ls[i].material_id); if (m && (!type || type.indexOf(m.mtype) >= 0)) return m.id; }
  var first = mats().find(function (m) { return isActive(m) && (!type || type.indexOf(m.mtype) >= 0); });
  return first ? first.id : '';
}
function newPiece() { return { ltype: 'piece', name: '', material_id: lastMaterial(['sheet', 'solid']), count: 1, length: '', width: '', thickness: '', notes: '' }; }
function newAccessory() { return { ltype: 'item', name: '', material_id: '', qty: 1, unit: '', notes: '' }; }

function ieCost() {
  var d = S.idraft, mm = matMap();
  var lines = d.lines.map(function (l) { return { ltype: l.ltype, name: l.name, material_id: l.material_id, count: n(l.count), length: n(l.length), width: n(l.width), thickness: n(l.thickness), qty: n(l.qty), unit: l.unit || (mm[l.material_id] ? unitsFor_(mm[l.material_id])[0] : '') }; });
  var labor = d.labor.map(function (x) { return { amount: n(x.amount) }; });
  var waste = d.mode === 'order' && S.draft ? S.draft.waste : {};
  var c = costGroups_([{ key: 'x', qty: 1, name: '', lines: lines, labor: labor }], { materials: mm, settings: S.data.settings, waste: waste });
  var g = c.groups.x;
  return { c: c, g: g, unit: { material_cost: g.material_cost, labor_cost: g.labor_cost, total: g.total_cost, by_cat: g.by_cat } };
}

VIEWS.itemEdit = function () {
  var d = S.idraft;
  if (!d) { S.view = 'products'; return VIEWS.products(); }
  var isP = d.mode === 'product';
  var back = isP ? (d.id ? { back: 'product', backP: d.id } : { back: 'products' }) : { back: 'orderEdit' };
  topbar(isP ? (d.id ? 'تعديل: ' + d.name : 'منتج جديد') : (d.idx >= 0 ? 'تعديل بند' : 'بند جديد في الطلب'), back);
  var catList = cats().slice(); if (d.category && catList.indexOf(d.category) < 0) catList.push(d.category);
  var h = '<div class="split"><div>';
  h += '<div class="card pad"><div class="grid g2"><div class="field"><label>' + (isP ? 'اسم المنتج' : 'اسم البند') + '</label><input class="inp" id="ie_name" maxlength="80" data-live="ie" data-b="name" value="' + esc(d.name) + '" placeholder="مثال: دولاب 4 ضلف"></div>' +
    '<div class="field"><label>النوع</label><select class="inp" id="ie_cat" data-change="ieBasic" data-b="category">' + selOpts(catList, d.category, '— اختار —') + '</select></div></div>';
  if (isP) h += '<div class="field"><label>سعر البيع المقترح للقطعة (ج)</label><input class="inp ltr" id="ie_price" inputmode="decimal" data-live="ie" data-b="price" value="' + esc(d.price) + '" placeholder="0"></div>';
  else h += '<div class="grid g2"><div class="field"><label>الكمية</label><div class="stepper"><button type="button" data-act="ieQty" data-d="1">+</button><input inputmode="numeric" id="ie_qty" data-live="ie" data-b="qty" value="' + esc(d.qty) + '"><button type="button" data-act="ieQty" data-d="-1">−</button></div></div>' +
    '<div class="field"><label>سعر القطعة للعميل (ج)</label><input class="inp ltr" id="ie_price" inputmode="decimal" data-live="ie" data-b="price" value="' + esc(d.price) + '" placeholder="0"></div></div>' +
    '<div class="field"><label>المواصفات اللي هتظهر في الفاتورة</label><input class="inp" id="ie_spec" maxlength="200" data-live="ie" data-b="spec" value="' + esc(d.spec) + '" placeholder="مثال: 240×200×60 سم — كونتر 18 مم — لون جوز"></div>';
  h += '<div class="field"><label>ملاحظات' + (isP ? '' : ' للورشة') + '</label><input class="inp" id="ie_notes" maxlength="300" data-live="ie" data-b="notes" value="' + esc(d.notes) + '"></div>' +
    photoField('ie', d.image_url, isP ? 'صورة المنتج (اختياري)' : 'صورة / تصميم (اختياري)') + '</div>';

  // pieces
  h += '<div class="sect"><h2>القطع والمقاسات</h2><span class="faint">لكل قطعة واحدة من ' + (isP ? 'المنتج' : 'البند') + ' — المقاسات بالسنتيمتر</span></div><div class="pieces" id="ie_pieces">';
  d.lines.forEach(function (l, i) { if (l.ltype === 'piece') h += pieceRow(l, i); });
  h += '</div><button class="btn btn-soft btn-block mt" data-act="ieAddPiece">' + ic('plus', 'sm') + 'إضافة قطعة</button>';

  // accessories
  h += '<div class="sect"><h2>إكسسوارات وتشطيب</h2><span class="faint">مفصلات، مقابض، بويات، إسفنج، قماش…</span></div><div class="pieces">';
  d.lines.forEach(function (l, i) { if (l.ltype === 'item') h += accRow(l, i); });
  h += '</div><button class="btn btn-soft btn-block mt" data-act="ieAddAcc">' + ic('plus', 'sm') + 'إضافة إكسسوار / تشطيب</button>';

  // labor
  h += '<div class="sect"><h2>مصنعية وشغل بره</h2><span class="faint">فلوس للقطعة الواحدة</span></div><div class="card pad">';
  d.labor.forEach(function (x, i) {
    var kinds = costKinds().slice(); if (x.kind && kinds.indexOf(x.kind) < 0) kinds.push(x.kind);
    h += '<div class="combo mb"><select class="inp" data-change="ieLabor" data-lab="' + i + '" data-f="kind">' + selOpts(kinds, x.kind) + '</select>' +
      '<input class="inp ltr" style="max-width:150px" inputmode="decimal" placeholder="المبلغ" data-live="ie" data-lab="' + i + '" data-f="amount" value="' + esc(x.amount) + '">' +
      '<button class="iconbtn" style="height:48px;width:48px" data-act="ieDelLabor" data-i="' + i + '" aria-label="حذف">' + ic('trash', 'sm') + '</button></div>';
  });
  h += '<button class="link" data-act="ieAddLabor">+ إضافة مصنعية / شغل بره</button></div>';
  h += '</div><div class="sticky"><div id="ie_cost"></div><div id="ie_mats" class="mt"></div>' +
    '<div class="grid g2 mt"><button class="btn btn-ghost" data-act="' + (isP ? (d.id ? 'nav" data-v="product" data-p="' + esc(d.id) : 'nav" data-v="products') : 'nav" data-v="orderEdit') + '">رجوع بدون حفظ</button>' +
    '<button class="btn btn-primary" data-lockable data-act="ieSave">' + ic(isP ? 'save' : 'check', 'sm') + (isP ? 'حفظ المنتج' : 'تم — رجوع للطلب') + '</button></div></div></div>';
  return h;
};
AFTER.itemEdit = function () { bindPhoto('ie', S.idraft); ieCalc(); };

function pieceRow(l, i) {
  var m = matById(l.material_id), t = m ? m.mtype : 'sheet';
  var opts = matOptions(l.material_id, function (x) { return x.mtype !== 'liquid'; }, '— الخامة —');
  var dims = '<div><label>العدد</label><input class="inp sm ltr" inputmode="numeric" data-live="ie" data-ix="' + i + '" data-f="count" value="' + esc(l.count) + '"></div>';
  if (t !== 'count') dims += '<div><label>الطول</label><input class="inp sm ltr" inputmode="decimal" data-live="ie" data-ix="' + i + '" data-f="length" value="' + esc(l.length) + '"></div>';
  if (t === 'sheet' || t === 'solid') dims += '<div><label>العرض</label><input class="inp sm ltr" inputmode="decimal" data-live="ie" data-ix="' + i + '" data-f="width" value="' + esc(l.width) + '"></div>';
  if (t === 'solid') dims += '<div><label>السُمك</label><input class="inp sm ltr" inputmode="decimal" data-live="ie" data-ix="' + i + '" data-f="thickness" value="' + esc(l.thickness) + '"></div>';
  else if (t === 'sheet') dims += '<div><label>السُمك</label><input class="inp sm" readonly value="' + esc(m && m.thickness_mm ? m.thickness_mm + ' مم' : 'من الخامة') + '"></div>';
  return '<div class="piece" id="pc' + i + '"><div class="pr"><div><label>القطعة</label><input class="inp sm" maxlength="60" placeholder="جنب، ضلفة، رف…" data-live="ie" data-ix="' + i + '" data-f="name" value="' + esc(l.name) + '"></div>' +
    '<div><label>الخامة</label><select class="inp sm" data-change="ieMat" data-ix="' + i + '">' + opts + '</select></div></div>' +
    '<div class="dims">' + dims + '</div>' +
    '<div class="foot"><span class="grow" id="pcc' + i + '"></span><button class="iconbtn sm" data-act="ieDupLine" data-i="' + i + '" aria-label="تكرار">' + ic('copy', 'sm') + '</button><button class="iconbtn sm" data-act="ieDelLine" data-i="' + i + '" aria-label="حذف">' + ic('trash', 'sm') + '</button></div></div>';
}
function accRow(l, i) {
  var m = matById(l.material_id);
  return '<div class="piece" id="pc' + i + '"><div class="pr"><div><label>الخامة</label><select class="inp sm" data-change="ieMat" data-ix="' + i + '">' + matOptions(l.material_id, null, '— الخامة —') + '</select></div>' +
    '<div><label>الكمية للقطعة</label><div class="combo"><input class="inp sm ltr" inputmode="decimal" data-live="ie" data-ix="' + i + '" data-f="qty" value="' + esc(l.qty) + '">' +
    '<select class="inp sm" style="flex:0 0 130px" data-change="ieUnit" data-ix="' + i + '">' + (m ? unitOpts(m, l.unit || unitsFor_(m)[0]) : '<option value="">—</option>') + '</select></div></div></div>' +
    '<div class="foot"><input class="inp sm" style="flex:1" maxlength="60" placeholder="وصف (اختياري)" data-live="ie" data-ix="' + i + '" data-f="name" value="' + esc(l.name) + '"><span id="pcc' + i + '"></span><button class="iconbtn sm" data-act="ieDelLine" data-i="' + i + '" aria-label="حذف">' + ic('trash', 'sm') + '</button></div></div>';
}
function ieCalc() {
  var d = S.idraft; if (!d || S.view !== 'itemEdit') return;
  var r = ieCost(), mm = matMap(), price = n(d.price);
  d.lines.forEach(function (l, i) {
    var el = document.getElementById('pcc' + i), box = document.getElementById('pc' + i); if (!el) return;
    var info = r.g.lines[i] || {}, m = mm[l.material_id];
    if (info.error || !m) { el.innerHTML = '<span class="neg">' + esc(info.error || 'اختار الخامة') + '</span>'; if (box) box.classList.add('err'); return; }
    if (box) box.classList.remove('err');
    var q = m.mtype === 'sheet' ? '<span class="num">' + fmt(info.net / 10000, 3) + '</span> م²' : m.mtype === 'solid' ? '<span class="num">' + fmt(info.net / 1e6, 4) + '</span> م³' : qtyM(info.net, m, 3);
    el.innerHTML = q + ' · <b>' + money(info.cost, 0) + '</b>';
  });
  var qty = d.mode === 'order' ? Math.max(1, n(d.qty)) : 1;
  var box = document.getElementById('ie_cost');
  if (box) {
    var h = costCard(r.unit, price, 1, 'تكلفة القطعة الواحدة');
    if (d.mode === 'order' && qty > 1) h += '<div class="card pad mt">' + kv('الكمية', '<span class="num">' + qty + '</span>') + kv('إجمالي التكلفة', money(r.unit.total * qty)) + kv('إجمالي البند للعميل', '<b>' + money(price * qty) + '</b>') +
      '<div class="kv total"><span>ربح البند</span><span class="' + profitCls((price - r.unit.total) * qty) + '">' + money((price - r.unit.total) * qty) + '</span></div></div>';
    var sp = Math.ceil(suggestedPrice_(r.unit.total, target()));
    if (r.unit.total > 0) h += '<div class="callout info mt">' + ic('calc', 'sm') + '<div>السعر المقترح لهامش <span class="num">' + target() + '%</span>: <b>' + money(sp, 0) + '</b> <button class="link" data-act="ieUseSuggested" data-v="' + sp + '">استخدمه</button></div></div>';
    if (r.c.warnings.length) h += '<div class="callout warn mt">' + ic('alert', 'sm') + '<div>' + r.c.warnings.slice(0, 6).map(esc).join('<br>') + '</div></div>';
    box.innerHTML = h;
  }
  var mb = document.getElementById('ie_mats');
  if (mb) mb.innerHTML = r.c.materials.length ? '<div class="card tscroll"><table class="t"><thead><tr><th>الخامة للقطعة</th><th class="n">صافي</th><th class="n">بالهالك</th><th class="n">التكلفة</th></tr></thead><tbody>' + r.c.materials.map(function (x) {
    var m = mm[x.material_id];
    return '<tr><td>' + esc(x.name) + '<div class="faint">هالك <span class="num">' + fmt(x.waste_pct, 1) + '%</span>' + (x.mtype === 'sheet' ? ' · <span class="num">' + fmt(x.sheets_exact, 2) + '</span> لوح' : '') + '</div></td><td class="n">' + qtyM(x.net, m, 3) + '</td><td class="n">' + qtyM(x.gross, m, 3) + '</td><td class="n">' + money(x.cost, 0) + '</td></tr>';
  }).join('') + '</tbody></table></div>' : '';
}
LIVE.ie = function (t) {
  var d = S.idraft; if (!d) return;
  var b = t.getAttribute('data-b'), ix = t.getAttribute('data-ix'), lab = t.getAttribute('data-lab'), f = t.getAttribute('data-f');
  if (b) d[b] = t.value;
  else if (ix !== null) d.lines[+ix][f] = t.value;
  else if (lab !== null) d.labor[+lab][f] = t.value;
  ieCalc();
};
CHANGE.ieBasic = function (t) { S.idraft[t.getAttribute('data-b')] = t.value; };
CHANGE.ieMat = function (t) {
  var l = S.idraft.lines[+t.getAttribute('data-ix')]; l.material_id = t.value;
  var m = matById(t.value); if (m && l.ltype === 'item') l.unit = unitsFor_(m)[0];
  if (m && l.ltype === 'piece' && !l.name) l.name = '';
  ieRerender();
};
CHANGE.ieUnit = function (t) { S.idraft.lines[+t.getAttribute('data-ix')].unit = t.value; ieCalc(); };
CHANGE.ieLabor = function (t) { S.idraft.labor[+t.getAttribute('data-lab')].kind = t.value; };
function ieRerender() { var y = window.scrollY; render(); window.scrollTo(0, y); }
ACT.ieAddPiece = function () { S.idraft.lines.push(newPiece()); ieRerender(); var ins = document.querySelectorAll('#ie_pieces .piece'); if (ins.length) { var x = ins[ins.length - 1].querySelector('input'); if (x) x.focus(); } };
ACT.ieAddAcc = function () { var a = newAccessory(); a.material_id = lastMaterial(['count']); var m = matById(a.material_id); if (m) a.unit = unitsFor_(m)[0]; S.idraft.lines.push(a); ieRerender(); };
ACT.ieDelLine = function (el) { S.idraft.lines.splice(+el.getAttribute('data-i'), 1); ieRerender(); };
ACT.ieDupLine = function (el) { var i = +el.getAttribute('data-i'), c = JSON.parse(JSON.stringify(S.idraft.lines[i])); S.idraft.lines.splice(i + 1, 0, c); ieRerender(); };
ACT.ieAddLabor = function () { S.idraft.labor.push({ kind: costKinds()[0] || 'مصنعية', amount: '' }); ieRerender(); };
ACT.ieDelLabor = function (el) { S.idraft.labor.splice(+el.getAttribute('data-i'), 1); ieRerender(); };
ACT.ieQty = function (el) { var d = S.idraft; d.qty = Math.max(1, (parseIn(d.qty) || 0) + (+el.getAttribute('data-d'))); var i = document.getElementById('ie_qty'); if (i) i.value = d.qty; ieCalc(); };
ACT.ieUseSuggested = function (el) { S.idraft.price = el.getAttribute('data-v'); var i = document.getElementById('ie_price'); if (i) i.value = S.idraft.price; ieCalc(); };

/** Lines in the shape the server expects (numbers parsed). Returns {lines} or {error}. */
function ieLinesPayload(d) {
  var out = [], err = '';
  d.lines.forEach(function (l, i) {
    if (err) return;
    var m = matById(l.material_id);
    if (!m) { err = 'اختار الخامة في السطر ' + (i + 1); return; }
    var x = { ltype: l.ltype, name: l.name, material_id: l.material_id, notes: l.notes || '' };
    if (l.ltype === 'piece') {
      ['count', 'length', 'width', 'thickness'].forEach(function (k) { var v = parseIn(l[k]); if (isNaN(v)) err = 'رقم غير صحيح في السطر ' + (i + 1); x[k] = v === '' ? '' : v; });
    } else { var q = parseIn(l.qty); if (isNaN(q) || !(q > 0)) err = 'اكتب الكمية في السطر ' + (i + 1); x.qty = q; x.unit = l.unit || unitsFor_(m)[0]; }
    if (!err) { var chk = lineNet_(Object.assign({}, x, { count: n(x.count), length: n(x.length), width: n(x.width), thickness: n(x.thickness), qty: n(x.qty) }), m); if (chk.error) err = (l.name || m.name) + ': ' + chk.error; }
    out.push(x);
  });
  return err ? { error: err } : { lines: out };
}
function ieLaborPayload(d) { return d.labor.filter(function (x) { return String(x.amount).trim() !== ''; }).map(function (x) { return { kind: x.kind, amount: parseIn(x.amount) }; }); }

ACT.ieSave = function () {
  var d = S.idraft;
  if (!String(d.name).trim()) return toast(d.mode === 'product' ? 'اكتب اسم المنتج' : 'اكتب اسم البند', 'err');
  var lp = ieLinesPayload(d); if (lp.error) return toast(lp.error, 'err');
  var labor = ieLaborPayload(d); if (labor.some(function (x) { return isNaN(x.amount) || x.amount < 0; })) return toast('راجع مبالغ المصنعية', 'err');
  var price = parseIn(d.price); if (isNaN(price) || price < 0) return toast('اكتب السعر بشكل صحيح', 'err');
  if (d.mode === 'product') {
    run('saveProduct', { id: d.id, name: d.name, category: d.category, selling_price: price === '' ? 0 : price, labor: labor, notes: d.notes, lines: lp.lines,
      image: d.image, removeImage: d.removeImage }, { rid: d.rid, ok: 'اتحفظ المنتج' }).then(function (r) { if (r) { var id = (r.result && r.result.id) || d.id; S.idraft = null; go('product', id); } });
    return;
  }
  var q = parseIn(d.qty); if (!(q >= 1) || Math.floor(q) !== q) return toast('الكمية لازم تكون رقم صحيح (1 أو أكتر)', 'err');
  var item = { product_id: d.product_id, name: d.name, category: d.category, qty: q, unit_price: price === '' ? 0 : price, spec: d.spec, notes: d.notes,
    labor: labor, lines: lp.lines, image_id: d.removeImage ? '' : d.image_id, image: d.image, removeImage: d.removeImage, preview: d.image ? (d.preview || '') : '', image_url: d.removeImage ? '' : d.image_url };
  if (d.idx >= 0) S.draft.items[d.idx] = item; else S.draft.items.push(item);
  S.idraft = null;
  go('orderEdit');
};
