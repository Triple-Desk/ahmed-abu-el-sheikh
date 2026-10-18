/* Start: load everything in one call, then show the dashboard. */
function boot() {
  api('bootstrap').then(function () {
    var sp = document.getElementById('splash'); if (sp) sp.remove();
    document.title = appName();
    render();
  }).catch(function (e) {
    document.getElementById('splash').innerHTML = '<div style="text-align:center;padding:24px"><img class="logo" src="logo-full.png" alt="" style="animation:none">' +
      '<div style="font-weight:700">تعذر تحميل البيانات</div><div class="faint">' + esc(e.message) + '</div><button class="btn btn-primary mt" onclick="location.reload()">جرّب تاني</button></div>';
  });
}
boot();
