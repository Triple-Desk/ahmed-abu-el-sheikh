/* Reports: period summary, profit per order, balances, stock, deliveries, best sellers. */
var REPORTS = [['summary', 'الملخص'], ['orders', 'ربح الطلبات'], ['customers', 'حسابات العملاء'], ['suppliers', 'حسابات الموردين'],
  ['materials', 'مخزن الخامات'], ['products', 'المنتجات الجاهزة'], ['delivery', 'مواعيد التسليم'], ['best', 'الأكثر مبيعًا']];
function reportState() {
  if (!S.report) { var r = monthRange(today().slice(0, 7)); S.report = { tab: 'summary', preset: 'month', from: r[0], to: r[1], sort: 'date' }; }
  return S.report;
}
function setPreset(p) {
  var R = S.report, t = today(), ym = t.slice(0, 7);
  if (p === 'month') { var r = monthRange(ym); R.from = r[0]; R.to = r[1]; }
  if (p === 'last') { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1; if (m === 0) { m = 12; y--; } var r2 = monthRange(y + '-' + ('0' + m).slice(-2)); R.from = r2[0]; R.to = r2[1]; }
  if (p === 'year') { R.from = t.slice(0, 4) + '-01-01'; R.to = t.slice(0, 4) + '-12-31'; }
  if (p === 'all') { R.from = '2000-01-01'; R.to = '2999-12-31'; }
  R.preset = p;
}
VIEWS.reports = function () {
  topbar('التقارير');
  var R = reportState();
  var h = '<div class="chips mb">' + REPORTS.map(function (x) { return '<button class="chip ' + (R.tab === x[0] ? 'on' : '') + '" data-act="repTab" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
  var periodTabs = ['summary', 'orders', 'best'];
  if (periodTabs.indexOf(R.tab) >= 0) {
    h += '<div class="card pad mb"><div class="chips">' + [['month', 'الشهر ده'], ['last', 'الشهر اللي فات'], ['year', 'السنة دي'], ['all', 'كل الوقت'], ['custom', 'فترة مخصوصة']].map(function (x) {
      return '<button class="chip ' + (R.preset === x[0] ? 'on' : '') + '" data-act="repPreset" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      (R.preset === 'custom' ? '<div class="grid g2 mt"><div class="field" style="margin:0"><label>من</label><input class="inp" type="date" id="rp_from" data-change="repDates" value="' + esc(R.from) + '"></div><div class="field" style="margin:0"><label>إلى</label><input class="inp" type="date" id="rp_to" data-change="repDates" value="' + esc(R.to) + '"></div></div>' : '') + '</div>';
  }
  return h + (REP_VIEWS[R.tab] || REP_VIEWS.summary)(R);
};
ACT.repTab = function (el) { reportState().tab = el.getAttribute('data-v'); render(); };
ACT.repPreset = function (el) { var p = el.getAttribute('data-v'); if (p === 'custom') S.report.preset = 'custom'; else setPreset(p); render(); };
CHANGE.repDates = function () { S.report.from = val('rp_from') || S.report.from; S.report.to = val('rp_to') || S.report.to; render(); };
ACT.repSort = function (el) { S.report.sort = el.getAttribute('data-v'); render(); };

var REP_VIEWS = {};
REP_VIEWS.summary = function (R) {
  var s = periodStats(R.from, R.to);
  var h = '<div class="grid g2 g4">' + kpi('المبيعات', money(s.sales, 0), s.sold.length + ' طلب اتأكد', 'coins', true) + kpi('التحصيل', money(s.collected, 0), 'كل الدفعات (ناقص المردود)', 'money') +
    kpi('خامات اتصرفت', money(s.used, 0), 'على الطلبات وتصنيع المخزن', 'layers') + kpi('مصنعية وشغل بره', money(s.labor, 0), 'متسجلة على الطلبات', 'saw') + '</div>';
  h += '<div class="split mt"><div class="card pad"><b style="font-size:17px">صافي الربح</b><div class="mt">' +
    kv('ربح الطلبات اللي اتسلمت (فعلي)', money(s.actProfit)) + kv('مصاريف الورشة', '− ' + money(s.expenses)) + kv('هالك وتسويات جرد', (s.adjust >= 0 ? '− ' : '+ ') + money(Math.abs(s.adjust))) +
    '<div class="kv total big"><span>صافي الربح</span><span class="' + profitCls(s.net) + '">' + money(s.net) + '</span></div></div>' +
    '<div class="faint mt">ربح الطلب بيتحسب لما يتسلم: إجماليه − (الخامات اللي اتصرفت عليه + المصنعية والتكاليف المسجلة عليه). المتوقع لنفس الطلبات كان ' + money(s.estProfit, 0) + '.</div></div>';
  var byCat = {}; s.exps.forEach(function (e) { byCat[e.category] = (byCat[e.category] || 0) + n(e.amount); });
  var tt = s.expenses || 1, cls = ['', 'c2', 'c3', 'c4'];
  h += '<div class="card pad"><b>مصاريف الورشة</b><div class="bars mt">' + (Object.keys(byCat).length ? Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; }).map(function (k, i) { return bar(k, byCat[k], tt, cls[i % 4]); }).join('') : '<div class="faint">مفيش مصاريف في الفترة دي.</div>') + '</div></div></div>';
  h += '<div class="grid g2 g4 mt">' + kpi('طلبات اتسلمت', '<span class="num">' + s.delivered.length + '</span>', 'بقيمة ' + fmt(s.deliveredSales, 0) + ' ج', 'truck') +
    kpi('فلوس عند العملاء', money(totalOwedByCustomers(), 0), 'دلوقتي', 'users') + kpi('علينا للموردين', money(totalOwedToSuppliers(), 0), 'دلوقتي', 'truck') +
    kpi('قيمة الخامات', money(materialsValue(), 0), 'في المخزن دلوقتي', 'box') + '</div>';
  return h;
};
REP_VIEWS.orders = function (R) {
  var list = (S.data.orders || []).filter(function (o) { var d = String(o.confirmed_at || '').slice(0, 10); return countsAsSale(o) && d >= R.from && d <= R.to; });
  var sorters = { date: function (a, b) { return String(b.confirmed_at).localeCompare(String(a.confirmed_at)); }, best: function (a, b) { return n(b.act_profit) - n(a.act_profit); },
    worst: function (a, b) { return n(a.act_profit) - n(b.act_profit); }, diff: function (a, b) { return Math.abs(n(b.act_profit) - n(b.est_profit)) - Math.abs(n(a.act_profit) - n(a.est_profit)); } };
  list.sort(sorters[R.sort] || sorters.date);
  var h = '<div class="chips mb">' + [['date', 'الأحدث'], ['best', 'أعلى ربح'], ['worst', 'أقل ربح'], ['diff', 'أكبر فرق عن المتوقع']].map(function (x) { return '<button class="chip ' + (R.sort === x[0] ? 'on' : '') + '" data-act="repSort" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
  if (!list.length) return h + '<div class="card empty">مفيش طلبات اتأكدت في الفترة دي.</div>';
  var te = 0, ta = 0, tt = 0;
  h += '<div class="card tscroll"><table class="t"><thead><tr><th>الطلب</th><th class="n">الإجمالي</th><th class="n">ربح متوقع</th><th class="n">ربح فعلي</th><th class="n">الفرق</th><th class="n">الهامش</th></tr></thead><tbody>' + list.map(function (o) {
    var d = n(o.act_profit) - n(o.est_profit); te += n(o.est_profit); ta += n(o.act_profit); tt += n(o.total);
    return '<tr data-act="nav" data-v="order" data-p="' + esc(o.id) + '" style="cursor:pointer"><td><b class="num">' + esc(o.order_no) + '</b> ' + esc(custOf(o).name || '') + '<div>' + statusBadge(o) + '</div></td><td class="n">' + money(o.total, 0) + '</td><td class="n">' + money(o.est_profit, 0) + '</td>' +
      '<td class="n ' + profitCls(o.act_profit) + '">' + money(o.act_profit, 0) + (o.status !== 'delivered' ? '<div class="faint">لسه شغال</div>' : '') + '</td><td class="n ' + profitCls(d) + '">' + money(d, 0) + '</td><td class="n">' + pct(o.act_margin) + '</td></tr>';
  }).join('') + '<tr class="tot"><td>الإجمالي</td><td class="n">' + money(tt, 0) + '</td><td class="n">' + money(te, 0) + '</td><td class="n">' + money(ta, 0) + '</td><td class="n">' + money(ta - te, 0) + '</td><td class="n">' + (tt > 0 ? pct(ta / tt) : '—') + '</td></tr></tbody></table></div>' +
    '<div class="faint mt">الفعلي للطلبات اللي لسه شغالة ناقص لحد ما تتصرف كل خاماتها وتتسجل تكاليفها.</div>';
  return h;
};
REP_VIEWS.customers = function () {
  var list = (S.data.customers || []).map(function (c) { return { c: c, b: custBalance(c) }; }).filter(function (x) { return x.b.due > 0.009; }).sort(function (a, b) { return b.b.due - a.b.due; });
  var tot = list.reduce(function (a, x) { return a + x.b.due; }, 0);
  var h = '<div class="card pad mb between"><b>إجمالي اللي عند العملاء</b><b class="neg" style="font-size:20px">' + money(tot, 0) + '</b></div>';
  if (!list.length) return h + '<div class="card empty">مفيش فلوس عند حد — كله خالص.</div>';
  return h + '<div class="card list">' + list.map(function (x) {
    return '<div class="li static"><div class="avatar">' + initials(x.c.name) + '</div><div class="grow" data-act="nav" data-v="customer" data-p="' + esc(x.c.id) + '" style="cursor:pointer"><div class="main-t">' + esc(x.c.name) + '</div><div class="faint">' + x.b.orders.filter(function (o) { return countsAsSale(o) && n(o.remaining) > 0.009; }).map(function (o) { return esc(o.order_no); }).join('، ') + '</div></div>' +
      '<div class="end"><b class="neg">' + money(x.b.due, 0) + '</b>' + (x.c.phone ? '<div><a class="link" target="_blank" rel="noopener" href="' + esc(waLink(x.c.phone, reminderText(x.c, x.b))) + '">تذكير واتساب</a></div>' : '') + '</div></div>';
  }).join('') + '</div>';
};
REP_VIEWS.suppliers = function () {
  var list = (S.data.suppliers || []).map(function (s) { return { s: s, b: supBalance(s) }; }).filter(function (x) { return Math.abs(x.b.due) > 0.009; }).sort(function (a, b) { return b.b.due - a.b.due; });
  var tot = list.reduce(function (a, x) { return a + Math.max(0, x.b.due); }, 0);
  var h = '<div class="card pad mb between"><b>إجمالي اللي علينا للموردين</b><b class="neg" style="font-size:20px">' + money(tot, 0) + '</b></div>';
  if (!list.length) return h + '<div class="card empty">مفيش حسابات مفتوحة مع الموردين.</div>';
  return h + '<div class="card list">' + list.map(function (x) {
    return '<div class="li" data-act="nav" data-v="supplier" data-p="' + esc(x.s.id) + '"><div class="avatar">' + initials(x.s.name) + '</div><div class="grow"><div class="main-t">' + esc(x.s.name) + '</div><div class="faint">مشتريات ' + money(x.b.total, 0) + ' · مدفوع ' + money(x.b.paid, 0) + '</div></div><div class="end"><b class="' + (x.b.due > 0 ? 'neg' : 'pos') + '">' + money(Math.abs(x.b.due), 0) + '</b><div class="faint">' + (x.b.due > 0 ? 'علينا' : 'لينا') + '</div></div></div>';
  }).join('') + '</div>';
};
REP_VIEWS.materials = function () {
  var list = mats().filter(isActive).slice().sort(function (a, b) { return (isLow(b) ? 1 : 0) - (isLow(a) ? 1 : 0) || String(a.name).localeCompare(String(b.name), 'ar'); });
  var tot = 0;
  var h = '<div class="card tscroll"><table class="t"><thead><tr><th>الخامة</th><th class="n">الرصيد</th><th class="n">متوسط السعر</th><th class="n">القيمة</th></tr></thead><tbody>' + list.map(function (m) {
    var v = Math.max(0, n(m.stock)) * n(m.avg_cost); tot += v;
    return '<tr data-act="nav" data-v="material" data-p="' + esc(m.id) + '" style="cursor:pointer"><td><b>' + esc(matLabel(m)) + '</b> ' + (isLow(m) ? '<span class="badge b-bad">قليل</span>' : '') + '<div class="faint">' + MT_AR[m.mtype] + '</div></td><td class="n">' + qtyM(m.stock, m) + '</td><td class="n">' + (n(m.avg_cost) > 0 ? priceM(m.avg_cost, m) : '<span class="neg">—</span>') + '</td><td class="n">' + money(v, 0) + '</td></tr>';
  }).join('') + '<tr class="tot"><td colspan="3">إجمالي قيمة الخامات</td><td class="n">' + money(tot, 0) + '</td></tr></tbody></table></div><div class="faint mt">اضغط على أي خامة تشوف كل حركاتها.</div>';
  return h;
};
REP_VIEWS.products = function () { return storeView(); };
REP_VIEWS.delivery = function () {
  var open = (S.data.orders || []).filter(isOpen);
  var late = open.filter(isLate), week = open.filter(function (o) { return dueSoon(o, 7); }), later = open.filter(function (o) { return o.due_date && String(o.due_date) > addDays(today(), 7); }), none = open.filter(function (o) { return !o.due_date; });
  var sortD = function (a, b) { return String(a.due_date).localeCompare(String(b.due_date)); };
  function block(t, l, cls) { return '<div class="sect"><h2>' + t + '</h2><span class="badge ' + cls + '">' + l.length + '</span></div>' + (l.length ? '<div class="card list">' + l.sort(sortD).map(orderRow).join('') + '</div>' : '<div class="card empty">مفيش</div>'); }
  return block('متأخرة', late, 'b-bad') + block('خلال 7 أيام', week, 'b-warn') + block('بعد كده', later, 'b-gray') + block('من غير موعد', none, 'b-gray');
};
REP_VIEWS.best = function (R) {
  var list = (S.data.orders || []).filter(function (o) { var d = String(o.confirmed_at || '').slice(0, 10); return countsAsSale(o) && d >= R.from && d <= R.to; });
  var byCat = {}, byItem = {};
  list.forEach(function (o) {
    (o.items || []).forEach(function (it) {
      var rev = n(it.qty) * n(it.unit_price), c = it.category || 'بدون نوع', k = it.product_id ? (prodById(it.product_id) || {}).name || it.name : it.name;
      byCat[c] = byCat[c] || { rev: 0, qty: 0 }; byCat[c].rev += rev; byCat[c].qty += n(it.qty);
      byItem[k] = byItem[k] || { rev: 0, qty: 0 }; byItem[k].rev += rev; byItem[k].qty += n(it.qty);
    });
  });
  function tbl(title, o) {
    var ks = Object.keys(o).sort(function (a, b) { return o[b].rev - o[a].rev; }), tot = ks.reduce(function (a, k) { return a + o[k].rev; }, 0) || 1;
    return '<div class="card pad"><b>' + title + '</b><div class="bars mt">' + (ks.length ? ks.slice(0, 12).map(function (k, i) { return bar(k + ' (' + fmt(o[k].qty, 0) + ')', o[k].rev, tot, ['', 'c2', 'c3', 'c4'][i % 4]); }).join('') : '<div class="faint">مفيش مبيعات في الفترة دي.</div>') + '</div></div>';
  }
  return '<div class="split">' + tbl('حسب النوع', byCat) + tbl('حسب المنتج', byItem) + '</div>';
};
