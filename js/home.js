/* Dashboard and settings. */

/** Money figures for a date range (inclusive, yyyy-mm-dd). Shared by the dashboard and the reports. */
function periodStats(from, to) {
  function inR(d) { d = String(d || '').slice(0, 10); return d && d >= from && d <= to; }
  var orders = S.data.orders || [];
  var sold = orders.filter(function (o) { return countsAsSale(o) && inR(o.confirmed_at); });
  var delivered = orders.filter(function (o) { return o.status === 'delivered' && inR(o.delivered_at); });
  var pays = (S.data.payments || []).filter(function (p) { return p.status !== 'void' && inR(p.pay_date); });
  var costs = (S.data.order_costs || []).filter(function (c) { return c.status !== 'void' && inR(c.cost_date); });
  var exps = (S.data.expenses || []).filter(function (e) { return e.status !== 'void' && inR(e.exp_date); });
  var used = 0, adjust = 0;
  (S.data.daily || []).forEach(function (r) {
    if (!inR(r[0])) return;
    if (r[1] === 'material' && ['ISSUE', 'ISSUE_REVERSAL', 'RETURN', 'CONSUME', 'CONSUME_REVERSAL'].indexOf(r[2]) >= 0) used -= n(r[3]);
    if (['WASTE', 'COUNT', 'ADD'].indexOf(r[2]) >= 0) adjust -= n(r[3]);
  });
  var sum = function (l, f) { return l.reduce(function (a, x) { return a + n(f(x)); }, 0); };
  var s = { sold: sold, delivered: delivered, sales: sum(sold, function (o) { return o.total; }), collected: sum(pays, function (p) { return p.amount; }),
    used: used, labor: sum(costs, function (c) { return c.amount; }), expenses: sum(exps, function (e) { return e.amount; }), adjust: adjust,
    deliveredSales: sum(delivered, function (o) { return o.total; }), actProfit: sum(delivered, function (o) { return o.act_profit; }), estProfit: sum(delivered, function (o) { return o.est_profit; }), exps: exps };
  s.net = s.actProfit - s.expenses - s.adjust;
  return s;
}
function monthRange(ym) { var p = ym.split('-'), last = new Date(Date.UTC(+p[0], +p[1], 0)).getUTCDate(); return [ym + '-01', ym + '-' + ('0' + last).slice(-2)]; }
function totalOwedByCustomers() { return (S.data.orders || []).filter(countsAsSale).reduce(function (a, o) { return a + Math.max(0, n(o.remaining)); }, 0); }
function totalOwedToSuppliers() { return (S.data.suppliers || []).reduce(function (a, s) { return a + Math.max(0, supBalance(s).due); }, 0); }
function materialsValue() { return mats().filter(isActive).reduce(function (a, m) { return a + Math.max(0, n(m.stock)) * n(m.avg_cost); }, 0); }

VIEWS.dashboard = function () {
  topbar(appName());
  var ym = today().slice(0, 7), r = monthRange(ym), s = periodStats(r[0], r[1]);
  var orders = S.data.orders || [], open = orders.filter(isOpen), late = orders.filter(isLate), soon = orders.filter(function (o) { return dueSoon(o, 7); });
  var quotes = orders.filter(function (o) { return o.status === 'quote'; }).length;
  var low = mats().filter(function (m) { return isActive(m) && isLow(m); });
  var h = '<div class="faint" style="margin-bottom:12px">' + esc(fmtDateLong(today())) + '</div>';
  h += '<div class="grid g2 g4">' +
    kpi('مبيعات الشهر', money(s.sales, 0), s.sold.length + ' طلب اتأكد في ' + monthName(ym), 'coins', true, 'reports') +
    kpi('اللي اتحصّل', money(s.collected, 0), 'كل الدفعات الشهر ده', 'money', false, 'reports') +
    kpi('الربح الفعلي', '<span class="' + profitCls(s.actProfit) + '">' + money(s.actProfit, 0) + '</span>', 'من ' + s.delivered.length + ' طلب اتسلم الشهر ده', 'trend', false, 'reports') +
    kpi('طلبات مفتوحة', '<span class="num">' + open.length + '</span>', quotes ? quotes + ' عرض سعر مستني رد' : 'مؤكدة ولسه متسلمتش', 'receipt', false, 'orders') + '</div>';
  h += '<div class="grid g2 g4 mt">' +
    kpi('فلوس عند العملاء', money(totalOwedByCustomers(), 0), 'باقي حساب الطلبات', 'users', false, 'customers') +
    kpi('علينا للموردين', money(totalOwedToSuppliers(), 0), 'باقي فواتير الشراء', 'truck', false, 'suppliers') +
    kpi('قيمة الخامات في المخزن', money(materialsValue(), 0), 'بمتوسط سعر الشراء', 'box', false, 'materials') +
    kpi('خامات رصيدها قليل', '<span class="num ' + (low.length ? 'neg' : '') + '">' + low.length + '</span>', low.length ? 'محتاجة شراء' : 'كله تمام', 'alert', false, 'materials') + '</div>';
  h += '<div class="sect"><h2>إجراءات سريعة</h2></div><div class="quick">' + qa('newOrder', 'receipt', 'طلب جديد') + qa('quickPay', 'money', 'تسجيل دفعة') +
    qa('nav', 'cart', 'شراء خامات', ' data-v="purchases"') + qa('nav', 'saw', 'تسجيل تصنيع', ' data-v="production"') + '</div>';
  h += '<div class="split mt2"><div>';
  h += '<div class="sect" style="margin-top:0"><h2>متأخرة</h2>' + (late.length ? '<span class="badge b-bad">' + late.length + '</span>' : '') + '</div>' +
    (late.length ? '<div class="card list">' + late.map(orderRow).join('') + '</div>' : '<div class="card pad row"><span class="ico-dot" style="background:var(--ok-bg);color:var(--ok)">' + ic('check', 'sm') + '</span><span>مفيش طلبات متأخرة.</span></div>');
  h += '<div class="sect"><h2>تسليمات الأسبوع ده</h2></div>' + (soon.length ? '<div class="card list">' + soon.sort(function (a, b) { return String(a.due_date).localeCompare(String(b.due_date)); }).map(orderRow).join('') + '</div>' : '<div class="card empty">مفيش تسليمات خلال 7 أيام.</div>');
  h += '</div><div>';
  h += '<div class="sect" style="margin-top:0"><h2>خامات رصيدها قليل</h2></div>' + (low.length ? '<div class="card list">' + low.slice(0, 8).map(function (m) {
    return '<div class="li" data-act="nav" data-v="material" data-p="' + esc(m.id) + '"><span class="ico-dot" style="background:var(--bad-bg);color:var(--bad)">' + ic('alert', 'sm') + '</span><div class="grow"><b>' + esc(matLabel(m)) + '</b><div class="faint">المتاح ' + qtyM(m.stock, m) + (n(m.min_stock) ? ' · الحد ' + qtyM(m.min_stock, m) : '') + '</div></div>' + ic('chev', 'sm') + '</div>';
  }).join('') + '</div>' : '<div class="card pad row"><span class="ico-dot" style="background:var(--ok-bg);color:var(--ok)">' + ic('check', 'sm') + '</span><span>كل الخامات فوق حد التنبيه.</span></div>');
  var noPrice = mats().filter(function (m) { return isActive(m) && !(n(m.avg_cost) > 0); });
  if (noPrice.length) h += '<div class="callout warn mt">' + ic('alert', 'sm') + '<div><b>' + noPrice.length + ' خامة من غير سعر</b> — التكلفة مش هتبقى دقيقة غير لما تسجل أسعارها (من "المشتريات" أو تعديل الخامة).<br><button class="link" data-act="nav" data-v="materials">راجع الخامات</button></div></div>';
  var recent = orders.slice(0, 5);
  h += '<div class="sect"><h2>آخر الطلبات</h2><span class="grow"></span><button class="link" data-act="nav" data-v="orders">الكل</button></div>' + (recent.length ? '<div class="card list">' + recent.map(orderRow).join('') + '</div>' : emptyBox('receipt', 'لسه مفيش طلبات', 'newOrder', 'أول طلب'));
  h += '</div></div>';
  return h;
};
ACT.quickPay = function () {
  var list = (S.data.orders || []).filter(function (o) { return countsAsSale(o) && n(o.remaining) > 0.009; });
  if (!list.length) return toast('مفيش طلبات عليها فلوس', 'ok');
  modal({ title: 'تسجيل دفعة — اختار الطلب', body: '<div class="card list" style="box-shadow:none">' + list.map(function (o) {
    return '<div class="li" data-act="ordPay" data-p="' + esc(o.id) + '"><div class="avatar no">' + esc(o.order_no) + '</div><div class="grow"><div class="main-t">' + esc(custOf(o).name || '') + '</div><div class="faint">' + statusBadge(o) + '</div></div><div class="end"><b class="neg">' + money(o.remaining, 0) + '</b></div></div>';
  }).join('') + '</div>' });
};

/* ---------- settings ---------- */
VIEWS.settings = function () {
  topbar('الإعدادات');
  S.st = S.st || { rid: rid() };
  var links = S.data.links || {};
  var h = '<div style="max-width:720px">';
  h += '<div class="card pad"><b style="font-size:17px">بيانات الورشة (بتظهر في الفاتورة)</b><div class="mt"></div>' +
    '<div class="grid g2"><div class="field"><label>اسم الورشة</label><input class="inp" id="st_name" maxlength="60" value="' + esc(setting('business_name', '')) + '"></div><div class="field"><label>الاسم بالإنجليزي</label><input class="inp ltr" id="st_en" maxlength="60" value="' + esc(setting('business_name_en', '')) + '"></div></div>' +
    '<div class="grid g2"><div class="field"><label>اسم السيستم</label><input class="inp" id="st_app" maxlength="40" value="' + esc(setting('app_name', '')) + '"></div><div class="field"><label>التليفون</label><input class="inp ltr" id="st_phone" maxlength="25" value="' + esc(setting('phone', '')) + '"></div></div>' +
    '<div class="field"><label>العنوان (اختياري)</label><input class="inp" id="st_addr" maxlength="150" value="' + esc(setting('address', '')) + '"></div>' +
    '<div class="field"><label>شروط عرض السعر</label><textarea class="inp" id="st_qnote" maxlength="300">' + esc(setting('quote_note', '')) + '</textarea></div>' +
    '<div class="field"><label>جملة آخر الفاتورة</label><input class="inp" id="st_inote" maxlength="200" value="' + esc(setting('invoice_note', '')) + '"></div></div>';
  h += '<div class="card pad mt"><b style="font-size:17px">الحسابات</b><div class="mt"></div><div class="field"><label>هامش الربح المستهدف %</label><input class="inp ltr" id="st_margin" inputmode="decimal" value="' + esc(setting('target_margin', 30)) + '"><span class="hint">بيستخدم في السعر المقترح وتلوين المنتجات. الهامش = الربح ÷ سعر البيع.</span></div>' +
    '<label class="lbl2">نسبة الهالك العادية لكل نوع خامة %</label><div class="grid g3s mt">' + ['sheet', 'solid', 'linear', 'count', 'liquid'].map(function (t) {
      return '<div class="field"><label style="font-size:12.5px">' + MT_AR[t] + '</label><input class="inp ltr" id="st_w_' + t + '" inputmode="decimal" value="' + esc(setting('waste_' + t, '')) + '"></div>';
    }).join('') + '</div><div class="faint">أي خامة ليها نسبة خاصة بتتكتب في الخامة نفسها، وتقدر تغيّرها لطلب معيّن من صفحة عرض السعر.</div></div>';
  h += '<div class="card pad mt"><b style="font-size:17px">القوايم</b><div class="faint mb">كل اختيار في سطر لوحده</div>' +
    '<div class="field"><label>أنواع المنتجات</label><textarea class="inp" id="st_cats" rows="6">' + esc(cats().join('\n')) + '</textarea></div>' +
    '<div class="field"><label>بنود المصنعية والشغل بره</label><textarea class="inp" id="st_ck" rows="5">' + esc(costKinds().join('\n')) + '</textarea></div>' +
    '<div class="field"><label>بنود مصاريف الورشة</label><textarea class="inp" id="st_ek" rows="5">' + esc(expKinds().join('\n')) + '</textarea></div>' +
    '<div class="field"><label>القطع السريعة في الطلب الجديد</label><textarea class="inp" id="st_qi" rows="6">' + esc(quickItems().join('\n')) + '</textarea></div></div>';
  h += '<button class="btn btn-primary btn-block mt" data-lockable data-act="saveSettings">' + ic('save', 'sm') + 'حفظ الإعدادات</button>';
  h += '<div class="card pad mt"><div class="row mb">' + ic('phone') + '<b>افتح السيستم على الموبايل أو جهاز تاني</b></div>' +
    '<div class="muted">صوّر الكود ده بكاميرا الموبايل، وبعد ما يفتح اختار "إضافة إلى الشاشة الرئيسية" عشان يبقى أيقونة زي أي تطبيق.</div>' +
    '<div id="st_qr" style="display:grid;place-items:center;padding:14px;margin-top:12px;background:#fff;border:1px solid var(--line);border-radius:14px;min-height:120px"><span class="faint">جاري تجهيز الكود…</span></div>' +
    '<div class="grid g2 mt"><button class="btn btn-soft" data-act="copyLink">' + ic('copy', 'sm') + 'نسخ الرابط</button><button class="btn" style="background:#1FA855;color:#fff" data-act="waLink">' + WA_ICON + 'ابعته لنفسك واتساب</button></div>' +
    '<div class="faint mt">الرابط ده خاص بيك — اللي معاه الرابط يقدر يفتح السيستم.</div></div>';
  h += '<div class="card pad mt"><div class="row mb">' + ic('shield') + '<b>النسخ الاحتياطي والملفات</b></div><div class="muted">السيستم بياخد نسخة احتياطية تلقائي كل يوم ويحتفظ بآخر 30 نسخة في فولدر Backups على جوجل درايف.</div>' +
    '<button class="btn btn-soft btn-block mt" data-lockable data-act="backupNow">' + ic('save', 'sm') + 'خد نسخة احتياطية دلوقتي</button>' +
    (links.folder ? '<div class="row mt wrapr"><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc(links.folder) + '">فولدر الورشة على درايف</a><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc(links.db) + '">شيت البيانات</a></div>' : '') + '</div>';
  h += '<div class="faint mt">الإصدار ' + esc(S.data.version) + '</div></div>';
  return h;
};
AFTER.settings = function () {
  var box = document.getElementById('st_qr'); if (!box || !CFG) return;
  loadOne('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js').then(function () {
    box.innerHTML = '';
    new window.QRCode(box, { text: privateLink(), width: 220, height: 220, colorDark: '#2E2520', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
  }).catch(function () { box.innerHTML = '<span class="faint">الكود محتاج نت — استخدم "نسخ الرابط".</span>'; });
};
function privateLink() { return location.origin + location.pathname + '#d=' + CFG.d + '&k=' + CFG.k; }
ACT.copyLink = function () {
  var t = privateLink();
  function oldCopy() {
    var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove();
    return ok ? Promise.resolve() : Promise.reject();
  }
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).catch(oldCopy).then(function () { toast('اتنسخ الرابط — الصقه في المتصفح التاني أو ابعته لنفسك', 'ok'); }, function () {
    modal({ title: 'الرابط الخاص بيك', body: '<textarea class="inp ltr" rows="4" readonly onclick="this.select()">' + esc(t) + '</textarea>' });
  });
};
ACT.waLink = function () { window.open('https://wa.me/?text=' + encodeURIComponent('رابط سيستم ' + appName() + ':\n' + privateLink()), '_blank'); };
function textLines(id) { return val(id).split('\n').map(function (s) { return s.trim(); }).filter(Boolean); }
ACT.saveSettings = function () {
  var m = parseIn(val('st_margin')); if (m === '' || isNaN(m) || m < 0 || m >= 95) return toast('الهامش لازم يكون بين 0 و 95', 'err');
  var pl = { business_name: val('st_name'), business_name_en: val('st_en'), app_name: val('st_app'), phone: val('st_phone'), address: val('st_addr'),
    quote_note: val('st_qnote'), invoice_note: val('st_inote'), target_margin: m, categories: textLines('st_cats'), cost_kinds: textLines('st_ck'), expense_kinds: textLines('st_ek'), quick_items: textLines('st_qi') };
  var bad = false;
  ['sheet', 'solid', 'linear', 'count', 'liquid'].forEach(function (t) { var w = parseIn(val('st_w_' + t)); if (w === '' || isNaN(w) || w < 0) bad = true; pl['waste_' + t] = w; });
  if (bad) return toast('اكتب نسب الهالك كأرقام', 'err');
  run('saveSettings', pl, { rid: S.st.rid, ok: 'اتحفظت الإعدادات' }).then(function (r) { if (r) { S.st.rid = rid(); render(); } });
};
ACT.backupNow = function () { run('backupNow', {}, { rid: rid() }).then(function (r) { if (r && r.result) toast(r.result.message, 'ok'); }); };
