/* Start: load everything in one call, then show the dashboard. */
function boot() {
  if (!CFG) return linkScreen();
  api('bootstrap').then(function () {
    var sp = document.getElementById('splash'); if (sp) sp.remove();
    document.title = appName();
    render();
  }).catch(function (e) {
    if (e.auth) return linkScreen('الرابط ده قديم أو ناقص. افتح الرابط الخاص الجديد.');
    document.getElementById('splash').innerHTML = '<div style="text-align:center;padding:24px"><img class="logo" src="logo-full.png" alt="" style="animation:none">' +
      '<div style="font-weight:700">تعذر تحميل البيانات</div><div class="faint">' + esc(e.message) + '</div><button class="btn btn-primary mt" onclick="location.reload()">جرّب تاني</button></div>';
  });
}
/** First time on a browser/phone: it needs the owner's private link once, then it remembers it. */
function linkScreen(msg) {
  var sp = document.getElementById('splash');
  sp.innerHTML = '<div class="linkbox"><img class="logo" src="logo-full.png" alt="" style="animation:none">' +
    '<div class="lk-title">افتح السيستم بالرابط الخاص بيك</div>' +
    (msg ? '<div class="lk-err">' + esc(msg) + '</div>' : '') +
    '<div class="muted">المتصفح ده لسه مفتحش عليه السيستم. افتح الرابط الخاص بيك مرة واحدة بس، وبعد كده هيفتح على طول.</div>' +
    '<div class="lk-help">الرابط الخاص موجود في السيستم على الجهاز اللي شغال عليه: <b>الإعدادات</b> ← «افتح السيستم على الموبايل أو جهاز تاني» ← صوّر الكود أو اضغط «نسخ الرابط».</div>' +
    '<textarea class="inp ltr" id="lk_in" rows="3" placeholder="الصق الرابط الخاص هنا" autocomplete="off" spellcheck="false"></textarea>' +
    '<div class="lk-err" id="lk_err" hidden>ده مش الرابط الخاص — انسخه تاني من الإعدادات.</div>' +
    '<button class="btn btn-primary btn-block mt" id="lk_go">افتح السيستم</button></div>';
  function go() {
    var c = linkCfg(document.getElementById('lk_in').value.trim());
    if (!c) { document.getElementById('lk_err').hidden = false; return; }
    saveCfg(c); location.replace(location.pathname + '#d=' + c.d + '&k=' + c.k); location.reload();
  }
  document.getElementById('lk_go').addEventListener('click', go);
  document.getElementById('lk_in').addEventListener('input', function () {
    document.getElementById('lk_err').hidden = true;
    if (linkCfg(this.value.trim())) go();
  });
}
boot();
