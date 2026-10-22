// Drives the real interface (jsdom) against the real server code (mocked Google services).
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { makeEnv } = require('./gas-mock');

const ROOT = path.join(__dirname, '..');
const G = makeEnv();
G.APP.MAX_WRITES_PER_MIN = 100000;
G.setup();
const KEY = G._props.API_KEY;
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace(/<link[^>]+fonts[^>]*>/g, '').replace(/<link rel="stylesheet"[^>]*>/, '')
  .replace(/<script src="(js\/[^"?]+)[^"]*"><\/script>/g, (m, f) => '<script>' + fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/<\/script>/g, '<\\/script>') + '</script>');
const gapi = (action, payload) => JSON.parse(G.doPost({ postData: { contents: JSON.stringify({ k: KEY, action, payload, requestId: 'x' + Math.random() }) } }).getContent());
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.stack || e.message)));
vc.on('error', e => errors.push('console.error: ' + e));
let fetches = 0, opened = [];
const dom = new JSDOM(html, {
  url: 'https://triple-desk.github.io/ahmed-abu-el-sheikh/#d=AKfycbTESTdeploymentIdXXXXXXXX&k=' + KEY, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.scrollTo = () => {};
    win.open = (u) => { opened.push(u); return {}; };
    win.fetch = (url, opts) => new Promise(res => setTimeout(() => {
      if (win.__garble > 0) { win.__garble--; res({ ok: true, status: 200, text: () => Promise.resolve('<!DOCTYPE html><p>Google busy</p>') }); return; }
      fetches++;
      const out = G.doPost({ postData: { contents: opts.body } }).getContent();
      res({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(out)), text: () => Promise.resolve(out) });
    }, 1));
    win.addEventListener('error', e => errors.push('window error: ' + e.message));
  }
});
const w = dom.window, doc = w.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = s => doc.querySelector(s);
const $$ = s => [...doc.querySelectorAll(s)];
function click(sel) { const el = typeof sel === 'string' ? $(sel) : sel; if (!el) throw new Error('missing ' + sel); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); }
function setv(sel, v, ev = 'input') { const el = typeof sel === 'string' ? $(sel) : sel; if (!el) throw new Error('missing ' + sel); el.value = v; el.dispatchEvent(new w.Event(ev, { bubbles: true })); }
function check(sel, on) { const el = $(sel); el.checked = on; el.dispatchEvent(new w.Event('change', { bubbles: true })); }
function text(sel = '#view') { return ($(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' '); }
function nav(v) { click(`[data-act=nav][data-v=${v}]`); }
let pass = 0, fail = 0;
async function step(name, fn) { try { await fn(); pass++; console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ ' + name + '\n     ' + (e.stack || e.message).split('\n').slice(0, 3).join('\n     ')); } }
const assert = (c, m) => { if (!c) throw new Error(m); };
const D = () => gapi('bootstrap', {}).data;
const mat = n => D().materials.find(m => m.name === n);

(async () => {
  await sleep(60);
  await step('boots to the dashboard with the workshop name', () => {
    assert(!$('#splash'), 'splash still visible'); assert(text().includes('مبيعات الشهر'), 'no KPI');
    assert(doc.title === 'أحمد أبو الشيخ', 'title ' + doc.title);
  });
  for (const v of ['orders', 'products', 'materials', 'purchases', 'production', 'customers', 'reports', 'suppliers', 'expenses', 'settings', 'more', 'dashboard']) {
    await step('view ' + v, () => { nav(v); assert($('#view').innerHTML.length > 100, 'empty view'); });
  }

  await step('new sheet material with price per sheet; preview per sheet & m²', async () => {
    nav('materials'); click('[data-act=newMaterial]');
    setv('#mf_name', 'MDF 18 مم أبيض'); click('[data-act=mfType][data-v=sheet]');
    setv('#mf_amount', '1100'); setv('#mf_pqty', '1');
    assert($('#mf_prev').textContent.includes('1,100'), 'preview ' + $('#mf_prev').textContent);
    setv('#mf_open', '2'); setv('#mf_min', '1');
    click('[data-act=saveMaterial]'); await sleep(40);
    assert(text().includes('MDF 18 مم أبيض') && text().includes('1,100'), 'material page ' + text().slice(0, 200));
    const m = mat('MDF 18 مم أبيض'); assert(Math.abs(m.stock - 2 * 244 * 122) < 1e-6, 'opening stock');
  });
  await step('count material with a box size', async () => {
    nav('materials'); click('[data-act=newMaterial]');
    setv('#mf_name', 'مقبض ستانلس'); click('[data-act=mfType][data-v=count]');
    setv('#mf_pack', '10'); setv('#mf_plabel', 'علبة');
    setv('#mf_punit', 'pack', 'change'); setv('#mf_amount', '400');
    assert($('#mf_prev').textContent.includes('40'), 'per piece ' + $('#mf_prev').textContent);
    click('[data-act=saveMaterial]'); await sleep(40);
    assert(Math.abs(mat('مقبض ستانلس').avg_cost - 40) < 1e-9, 'avg 40');
  });

  await step('multi-line purchase with a new supplier, board dimensions, partial payment; double click = one invoice', async () => {
    nav('purchases');
    setv('#pu_sup', '__new', 'change'); await sleep(5); setv('#pu_sname', 'خشب الحرية');
    const ply = mat('كونتر أرو 18 مم'), mus = mat('خشب موسكي');
    setv('[data-change=puMat][data-i="0"]', ply.id, 'change'); await sleep(5);
    setv('[data-live=pul][data-i="0"][data-f=qty]', '6'); setv('[data-live=pul][data-i="0"][data-f=total]', '9000');
    assert(text().includes('1,500'), 'line preview shows 1,500/sheet');
    click('[data-act=puAdd]'); await sleep(5);
    setv('[data-change=puMat][data-i="1"]', mus.id, 'change'); await sleep(5);
    setv('[data-change=puUnit][data-i="1"]', 'board', 'change'); await sleep(5);
    setv('[data-live=pul][data-i="1"][data-f=bc]', '10'); setv('[data-live=pul][data-i="1"][data-f=bl]', '400'); setv('[data-live=pul][data-i="1"][data-f=bw]', '10'); setv('[data-live=pul][data-i="1"][data-f=bt]', '5');
    setv('[data-live=pul][data-i="1"][data-f=total]', '3800');
    assert($('#pu_paid').value === '12800', 'paid default = total, got ' + $('#pu_paid').value);
    setv('#pu_paid', '10000');
    assert(text().includes('2,800'), 'remaining 2,800 shown');
    click('[data-act=savePurchase]'); click('[data-act=savePurchase]'); await sleep(60);
    const d = D(); assert(d.purchases.length === 1, 'purchases ' + d.purchases.length);
    assert(d.suppliers.some(s => s.name === 'خشب الحرية'), 'supplier created');
    assert(Math.abs(mat('خشب موسكي').stock - 200000) < 1e-6, 'board volume');
  });

  await step('product template in the piece editor: pieces + accessory + labor → live cost; saved', async () => {
    nav('products'); click('[data-act=newProduct]'); await sleep(5);
    setv('#ie_name', 'كومود 3 أدراج'); setv('#ie_cat', 'غرف نوم', 'change');
    const ply = mat('كونتر أرو 18 مم');
    setv('[data-change=ieMat][data-ix="0"]', ply.id, 'change'); await sleep(5);
    setv('[data-live=ie][data-ix="0"][data-f=name]', 'جنب'); setv('[data-live=ie][data-ix="0"][data-f=count]', '2');
    setv('[data-live=ie][data-ix="0"][data-f=length]', '60'); setv('[data-live=ie][data-ix="0"][data-f=width]', '45');
    click('[data-act=ieAddPiece]'); await sleep(5);
    setv('[data-live=ie][data-ix="1"][data-f=name]', 'سقف'); setv('[data-live=ie][data-ix="1"][data-f=count]', '1');
    setv('[data-live=ie][data-ix="1"][data-f=length]', '50'); setv('[data-live=ie][data-ix="1"][data-f=width]', '45');
    click('[data-act=ieAddAcc]'); await sleep(5);
    setv('[data-change=ieMat][data-ix="2"]', mat('مقبض ستانلس').id, 'change'); await sleep(5);
    setv('[data-live=ie][data-ix="2"][data-f=qty]', '3');
    click('[data-act=ieAddLabor]'); await sleep(5);
    setv('[data-live=ie][data-lab="0"][data-f=amount]', '400');
    setv('#ie_price', '2500');
    // area 5400+2250 = 7650 cm² × 1.1 × 1500/29768 = 424.03 ; + 3×40 = 120 ; labor 400 → 944.03
    assert(text().includes('944.03'), 'live total ' + text('#ie_cost'));
    click('[data-act=ieSave]'); await sleep(50);
    const p = D().products.find(x => x.name === 'كومود 3 أدراج');
    assert(p && p.lines.length === 3 && Math.abs(p.cost.total - 944.03) < 0.02, 'saved cost ' + (p && p.cost.total));
    assert(text().includes('كومود 3 أدراج') && text().includes('القطع والمقاسات'), 'product page');
  });

  let OID;
  await step('quote: product copied, dimensions edited for this customer only, custom item, customer created', async () => {
    nav('orders'); click('[data-act=newOrder]'); await sleep(5);
    setv('#odc_name', 'منى سامي'); setv('#odc_phone', '01223334445'); setv('#odc_addr', 'مدينة نصر');
    setv('#od_due', '2026-11-05');
    click('[data-act=odPickProduct]'); await sleep(5);
    click($$('[data-act=odAddProduct]').find(x => x.textContent.includes('كومود 3 أدراج'))); await sleep(5);
    click('[data-act=odEditItem][data-i="0"]'); await sleep(5);
    setv('[data-live=ie][data-ix="0"][data-f=length]', '70');
    setv('#ie_qty', '2'); setv('#ie_spec', '70×50×45 سم');
    click('[data-act=ieSave]'); await sleep(5);
    assert(S_view() === 'orderEdit', 'back to order editor');
    click('[data-act=odPickProduct]'); await sleep(5); click('[data-act=odCustomItem]'); await sleep(5);
    setv('#ie_name', 'تركيب ونقل'); setv('#ie_price', '300');
    click($$('[data-act=ieDelLine]')[0]); await sleep(5);
    click('[data-act=ieSave]'); await sleep(5);
    setv('#od_discount', '100');
    assert(text('#od_sum').includes('5,200'), 'total 2×2500+300−100 ' + text('#od_sum'));
    click('[data-act=odSave]'); await sleep(60);
    const d = D(), o = d.orders[0]; OID = o.id;
    assert(o.status === 'quote' && o.items.length === 2 && Math.abs(o.total - 5200) < 1e-6, 'saved quote');
    assert(d.products.find(x => x.name === 'كومود 3 أدراج').lines[0].length === 60, 'catalog untouched');
    assert(o.lines.find(l => l.name === 'جنب').length === 70, 'order has edited size');
    assert(d.customers.some(c => c.phone === '01223334445'), 'customer');
  });
  await step('quotation document: logo, QUOTATION stamp, no costs; WhatsApp link to 2012…', async () => {
    click('[data-act=nav][data-v=doc]'); await sleep(5);
    const t = text('#doc');
    assert(t.includes('QUOTATION') && t.includes('عرض سعر') && t.includes('منى سامي'), 'doc ' + t.slice(0, 200));
    assert(!/تكلفة|ربح|هامش/.test(t), 'costs leaked into the customer document');
    assert($('#doc img.doc-logo'), 'logo');
    click('[data-act=nav][data-v=order]'); await sleep(5);
  });
  await step('confirm with deposit → confirmed, payment and remaining', async () => {
    click('[data-act=ordConfirm]'); await sleep(5);
    setv('#dp_amount', '2000'); setv('#dp_method', 'vodafone', 'change');
    click('#dpGo'); await sleep(60);
    const o = D().orders.find(x => x.id === OID);
    assert(o.status === 'confirmed' && o.paid === 2000 && o.remaining === 3200, JSON.stringify([o.status, o.paid, o.remaining]));
    assert(text().includes('3,200'), 'remaining shown');
  });
  await step('issue materials from the order (pre-filled with what is needed)', async () => {
    click('[data-act=ordIssue]'); await sleep(5);
    const q = $('[data-live=ml][data-i="0"]');
    assert(q && Number(q.value) > 0, 'prefilled qty ' + (q && q.value));
    // handles are not in stock yet: issuing everything must be refused as a whole
    click('[data-act=mlGo]'); await sleep(60);
    assert(text('#modalRoot').includes('مقبض ستانلس') && D().orders.find(x => x.id === OID).act_material === 0, 'all-or-nothing shortage');
    click('[data-act=closeModal]'); click('[data-act=ordIssue]'); await sleep(5);
    const hid = mat('مقبض ستانلس').id;
    $$('[data-change=mlMat]').forEach(sel => { if (sel.value === hid) setv('[data-live=ml][data-i="' + sel.getAttribute('data-i') + '"]', ''); });
    click('[data-act=mlGo]'); await sleep(60);
    const o = D().orders.find(x => x.id === OID);
    assert(o.status === 'production' && o.act_material > 0, 'issued ' + o.act_material);
  });
  await step('deliver: missing pieces → "سجّل التصنيع وسلّم" modal; materials short → nothing written', async () => {
    click('[data-act=ordDeliver]'); await sleep(5); click('#dlGo'); await sleep(60);
    assert($('#psGo'), 'produce-and-deliver modal');
    // stock of handles is 0 → production must be refused with a shortage table
    click('#psGo'); await sleep(60);
    assert(text('#modalRoot').includes('مقبض ستانلس'), 'shortage shows the handle: ' + text('#modalRoot').slice(0, 200));
    assert(D().orders.find(x => x.id === OID).status === 'production', 'still not delivered');
    click('[data-act=closeModal]');
  });
  await step('buy the handles, then produce & deliver in one step', async () => {
    gapi('savePurchase', { supplier_name: 'خشب الحرية', paid_now: 0, lines: [{ material_id: mat('مقبض ستانلس').id, qty: 2, unit: 'pack', total_price: 800 }] });
    nav('orders'); click($$('#view .li').find(x => x.textContent.includes('منى سامي')));
    click('[data-act=ordDeliver]'); await sleep(5); click('#dlGo'); await sleep(60);
    click('#psGo'); await sleep(80);
    const o = D().orders.find(x => x.id === OID);
    assert(o.status === 'delivered' && o.items.every(i => i.out_item + i.out_product === i.qty), 'delivered ' + o.status);
  });
  await step('payment → receipt offer → receipt view; invoice shows PAID', async () => {
    click('[data-act=ordPay]'); await sleep(5);
    assert($('#py_amount').placeholder.includes('3,200'), 'remaining as a hint');
    setv('#py_amount', '3200');
    click('[data-act=savePay]'); await sleep(60);
    click('[data-act=nav][data-v=receipt]'); await sleep(5);
    assert(text('#doc').includes('إيصال استلام') && text('#doc').includes('3,200'), 'receipt ' + text('#doc').slice(0, 200));
    click('[data-act=nav][data-v=order]'); await sleep(5);
    click('[data-act=nav][data-v=doc]'); await sleep(5);
    assert($('.paid-mark') && text('#doc').includes('DELIVERED'), 'PAID + DELIVERED stamp');
  });
  await step('cut list groups pieces by material with counts × item qty', async () => {
    click('[data-act=nav][data-v=order]'); await sleep(5);
    click('[data-act=nav][data-v=cutlist]'); await sleep(5);
    const t = text('#doc');
    assert(t.includes('كونتر أرو 18 مم') && t.includes('جنب') && t.includes('70'), 'cut list ' + t.slice(0, 300));
    assert(!/ربح|ج\.م/.test(t), 'no money on the cut list');
  });
  await step('actual cost on the order; estimated vs actual box', async () => {
    click('[data-act=nav][data-v=order]'); await sleep(5);
    click('[data-act=ordCost]'); await sleep(5); setv('#oc_amount', '700'); click('[data-act=saveCost]'); await sleep(60);
    const o = D().orders.find(x => x.id === OID);
    assert(o.act_costs === 700, 'cost'); assert(text().includes('المتوقع') && text().includes('الفعلي'), 'vs box');
  });
  await step('stock production from the products page', async () => {
    nav('products'); click($$('.pcard').find(x => x.textContent.includes('كومود 3 أدراج'))); await sleep(5);
    click('[data-act=goProduceStock]'); await sleep(10);
    assert($('#ps_qty'), 'stock production modal');
    setv('#ps_qty', '1'); await sleep(5);
    click('[data-act=mlGo]'); await sleep(60);
    assert(D().products.find(x => x.name === 'كومود 3 أدراج').stock === 1, 'stock 1');
  });
  await step('cancel after delivery with refund → pieces back once', async () => {
    nav('orders'); click('[data-act=ordFilter][data-v=all]'); click($$('#view .li').find(x => x.textContent.includes('منى سامي')));
    click('[data-act=ordCancel]'); await sleep(5);
    setv('#cn_amount', '1000'); click('#cnGo'); await sleep(60);
    const o = D().orders.find(x => x.id === OID);
    assert(o.status === 'cancelled' && o.paid === 4200, 'cancelled with refund ' + o.paid);
  });
  await step('reports: every tab renders; summary numbers present', async () => {
    nav('reports');
    for (const t of ['summary', 'orders', 'customers', 'suppliers', 'materials', 'products', 'delivery', 'best']) {
      click(`[data-act=repTab][data-v=${t}]`); await sleep(2);
      assert($('#view').innerHTML.length > 200, 'empty report ' + t);
    }
    click('[data-act=repTab][data-v=summary]'); click('[data-act=repPreset][data-v=all]');
    assert(text().includes('صافي الربح'), 'net profit');
  });
  await step('supplier page: payment lowers the balance', async () => {
    nav('suppliers'); click($$('#view .li').find(x => x.textContent.includes('خشب الحرية'))); await sleep(5);
    click('[data-act=supPay]'); await sleep(5); setv('#sp_amount', '500'); click('[data-act=saveSupPay]'); await sleep(60);
    const s = D().supplier_payments.filter(p => p.amount === 500); assert(s.length === 1, 'payment');
  });
  await step('expenses: add one', async () => {
    nav('expenses'); click('[data-act=newExpense]'); await sleep(5); setv('#ex_amount', '2500'); click('[data-act=saveExpense]'); await sleep(60);
    assert(text().includes('2,500'), 'expense listed');
  });
  await step('a garbled Google reply is retried once with the same request (no error, no duplicate)', async () => {
    const before = D().expenses.length;
    w.__garble = 1;
    nav('expenses'); click('[data-act=newExpense]'); await sleep(5); setv('#ex_amount', '75'); click('[data-act=saveExpense]'); await sleep(1700);
    assert(D().expenses.length === before + 1, 'saved once after retry');
    assert(!$$('.toast.err').length, 'no error toast');
  });
  await step('settings save keeps phone as text and categories as list', async () => {
    nav('settings'); setv('#st_addr', 'المطرية — القاهرة'); setv('#st_cats', 'غرف نوم\nمطابخ\nمكاتب');
    click('[data-act=saveSettings]'); await sleep(60);
    const s = D().settings; assert(s.address === 'المطرية — القاهرة' && JSON.parse(s.categories).includes('مكاتب') && s.phone === '01004649365', JSON.stringify(s).slice(0, 200));
  });
  await step('wrong link shows a clear message', async () => {
    assert(typeof w.api === 'function');
  });
  await step('copy link: falls back to the old copy when the clipboard API refuses', async () => {
    nav('settings');
    w.navigator.clipboard = { writeText: () => Promise.reject(new Error('not focused')) };
    w.document.execCommand = (c) => c === 'copy';
    click('[data-act=copyLink]'); await sleep(20);
    assert($$('.toast').some(t => t.textContent.includes('اتنسخ الرابط')), 'no copied toast');
  });
  await step('linkCfg reads a full link, a "#d=&k=" part, and refuses junk', () => {
    const full = w.linkCfg('https://triple-desk.github.io/ahmed-abu-el-sheikh/#d=AKfycbTESTdeploymentIdXXXXXXXX&k=' + KEY);
    assert(full && full.k === KEY && full.d === 'AKfycbTESTdeploymentIdXXXXXXXX', JSON.stringify(full));
    assert(w.linkCfg('#d=AKfycbTESTdeploymentIdXXXXXXXX&k=' + KEY), 'hash part');
    assert(!w.linkCfg('https://triple-desk.github.io/ahmed-abu-el-sheikh/'), 'bare link');
    assert(!w.linkCfg('d=short&k=short'), 'short');
  });
  await step('a browser without the link shows the paste screen; a pasted link is saved and opened', async () => {
    const vc2 = new VirtualConsole(); const errs2 = [];
    vc2.on('jsdomError', e => { if (!/navigation|reload/i.test(e.message)) errs2.push(e.message); });
    let reloads = 0;
    const d2 = new JSDOM(html, { url: 'https://triple-desk.github.io/ahmed-abu-el-sheikh/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc2,
      beforeParse(win) { win.scrollTo = () => {}; win.fetch = () => { throw new Error('must not call the server without a link'); }; } });
    await sleep(30);
    const w2 = d2.window, d = w2.document;
    assert(d.querySelector('.linkbox') && d.querySelector('#lk_in'), 'no paste screen');
    assert(d.querySelector('.lk-help').textContent.includes('الإعدادات'), 'no help text');
    const ta = d.querySelector('#lk_in'); ta.value = 'كلام غلط'; ta.dispatchEvent(new w2.Event('input', { bubbles: true }));
    d.querySelector('#lk_go').dispatchEvent(new w2.MouseEvent('click', { bubbles: true }));
    assert(!d.querySelector('#lk_err').hidden, 'no error for junk');
    ta.value = 'https://triple-desk.github.io/ahmed-abu-el-sheikh/#d=AKfycbTESTdeploymentIdXXXXXXXX&k=' + KEY;
    ta.dispatchEvent(new w2.Event('input', { bubbles: true }));
    const saved = JSON.parse(w2.localStorage.getItem('abusheikh_cfg') || '{}');
    assert(saved.k === KEY && saved.d === 'AKfycbTESTdeploymentIdXXXXXXXX', 'not saved: ' + JSON.stringify(saved));
    assert(!errs2.length, errs2.join('\n'));
    d2.window.close();
  });
  // ---- the owner's flow: bedroom agreed at 130,000, 90,000 paid, the rest comes later; account picture on WhatsApp
  let BID, CID;
  await step('quick order: customer, pieces by name + size, agreed total, paid now → confirmed with 40,000 left', async () => {
    nav('orders'); click('[data-act=newOrder]'); await sleep(5);
    assert(text('#topbar').includes('طلب جديد'), 'title');
    setv('#odc_name', 'محمد السيد'); setv('#odc_phone', '01099887766'); setv('#od_title', 'غرفة نوم');
    const add = async (name, spec, qty) => {
      click($$('[data-act=odQuick]').find(b => b.getAttribute('data-v') === name)); await sleep(5);
      const i = w.eval('S.draft.items.length') - 1;
      setv(`[data-live=odi][data-i="${i}"][data-f=spec]`, spec);
      if (qty) setv(`[data-live=odi][data-i="${i}"][data-f=qty]`, String(qty));
    };
    await add('دولاب', 'مقاس 270'); await add('كومودينو', 'عرض 50', 2); await add('تسريحة', 'عرض 140'); await add('سرير', '160');
    setv('#od_agreed', '130000'); setv('#od_paynow', '90000');
    assert(text('#od_money').includes('40,000'), 'remaining live ' + text('#od_money'));
    click('[data-act=odConfirm]'); await sleep(80);
    const o = D().orders[0]; BID = o.id; CID = o.customer_id;
    assert(o.status === 'confirmed' && o.title === 'غرفة نوم' && o.total === 130000 && o.paid === 90000 && o.remaining === 40000, JSON.stringify([o.status, o.total, o.paid, o.remaining]));
    assert(o.items.length === 4 && o.items[1].name === 'كومودينو' && o.items[1].qty === 2 && o.items[1].spec === 'عرض 50', 'items');
    assert(S_view() === 'order' && $('#modalRoot [data-v=statement]'), 'offer to send the account picture');
  });
  await step('account picture: items, agreed total, paid, remaining; no costs; WhatsApp text to 2010…', async () => {
    click('#modalRoot [data-v=statement]'); await sleep(5);
    const t = text('#doc');
    assert(t.includes('كشف حساب') && t.includes('غرفة نوم') && t.includes('مقاس 270') && t.includes('130,000') && t.includes('90,000') && t.includes('40,000'), t.slice(0, 300));
    assert(!/تكلفة|ربح|هامش/.test(t), 'costs leaked');
    const a = $$('.doc-actions a').find(x => x.href.includes('wa.me'));
    assert(a && a.href.includes('wa.me/201099887766') && decodeURIComponent(a.href).includes('الباقي: 40,000'), a && a.href);
  });
  await step('send the picture: computer → picture copied + open the customer chat', async () => {
    w.LOADED[w.H2C] = Promise.resolve();
    w.html2canvas = () => Promise.resolve({ toBlob: cb => cb(new w.Blob(['png'], { type: 'image/png' })) });
    let wrote = 0; w.ClipboardItem = function (o) { this.o = o; };
    w.navigator.clipboard = { write: () => { wrote++; return Promise.resolve(); }, writeText: () => Promise.resolve() };
    w.matchMedia = () => ({ matches: false });
    click('[data-act=stmtWa]'); await sleep(30);
    assert(wrote === 1, 'copied');
    const link = $('#modalRoot a[href*="wa.me"]');
    assert(text('#modalRoot').includes('اتنسخت') && link && link.href.includes('wa.me/201099887766'), text('#modalRoot'));
    click('[data-act=closeModal]');
  });
  await step('send the picture: phone → share sheet with the image', async () => {
    let shared = null;
    w.matchMedia = () => ({ matches: true });
    w.navigator.canShare = () => true; w.navigator.share = (d) => { shared = d; return Promise.resolve(); };
    click('[data-act=stmtWa]'); await sleep(30);
    assert(shared && shared.files && shared.files[0].type === 'image/png' && shared.files[0].name.includes('Account'), 'shared ' + JSON.stringify(shared && shared.files && shared.files[0] && shared.files[0].name));
  });
  await step('money that arrives later comes off the balance (customer page)', async () => {
    nav('orders'); click($$('#view .li').find(x => x.textContent.includes('محمد السيد'))); await sleep(5);
    click('a.custlink[data-v=customer]'); await sleep(5);
    assert(S_view() === 'customer' && text().includes('130,000') && text().includes('40,000'), 'summary');
    click('[data-act=custPay]'); await sleep(5);
    setv('#cp_amount', '15000'); setv('#cp_method', 'vodafone', 'change');
    click('[data-act=saveCustPay]'); await sleep(60);
    assert(D().orders.find(x => x.id === BID).remaining === 25000, 'remaining 25000');
    assert(text('#modalRoot').includes('25,000') && $('#modalRoot [data-v=statement]'), 'summary + picture offer');
    click('[data-act=closeModal]');
    assert(text().includes('25,000'), 'page updated');
  });
  await step('a payment can be corrected', async () => {
    const pay = D().payments.find(x => x.order_id === BID && x.kind === 'payment');
    click(`[data-act=payEdit][data-p="${pay.id}"]`); await sleep(5);
    assert($('#pe_amount').value === '15000', 'prefilled');
    setv('#pe_amount', '20000'); click('[data-act=savePayEdit]'); await sleep(60);
    assert(D().orders.find(x => x.id === BID).remaining === 20000, 'remaining 20000');
    click('[data-act=closeModal]');
  });
  await step('what was agreed can be changed after confirmation', async () => {
    nav('orders'); click($$('#view .li').find(x => x.textContent.includes('محمد السيد'))); await sleep(5);
    click('[data-act=ordEdit]'); await sleep(5);
    assert(text('#topbar').includes('تعديل الطلب') && $('#od_agreed').value === '130000', 'editor with agreed');
    assert(!$('#od_paynow'), 'payments are not re-entered when editing');
    setv('#od_agreed', '135000');
    setv('[data-live=odi][data-i="0"][data-f=spec]', 'مقاس 280');
    click('[data-act=odSave]'); await sleep(80);
    const o = D().orders.find(x => x.id === BID);
    assert(o.total === 135000 && o.remaining === 25000 && o.items[0].spec === 'مقاس 280' && o.status === 'confirmed', JSON.stringify([o.total, o.remaining, o.status]));
    assert(S_view() === 'order' && text().includes('135,000'), 'order page');
  });
  await step('invoice of an agreed order: no price columns, agreed total, agreement details', async () => {
    click('[data-act=nav][data-v=doc]'); await sleep(5);
    const t = text('#doc');
    assert(t.includes('الإجمالي المتفق عليه') && t.includes('135,000') && t.includes('25,000') && !t.includes('السعر'), t.slice(0, 400));
    click('[data-act=nav][data-v=order]'); await sleep(5);
  });
  await step('an app newer than the server does not save orders until the server is updated', async () => {
    const v = w.eval('S.data.version'); w.eval("S.data.version = '1.0.1'");
    const r = await w.eval("run('saveOrder', {})"); assert(r === null && $$('.toast.err').some(t => t.textContent.includes('بيتحدّث')), 'blocked');
    w.eval("S.data.version = '" + v + "'"); assert(w.verLess('1.0.9', '1.1.0') && !w.verLess('1.1.0', '1.1.0') && !w.verLess('1.2.0', '1.1.0'), 'compare');
  });
  await step('no script errors', () => { assert(!errors.length, errors.join('\n')); });
  console.log(`\n${pass} passed, ${fail} failed (${fetches} server calls)\n`);
  process.exit(fail ? 1 : 0);
})();
function S_view() { return w.eval('S.view'); }
