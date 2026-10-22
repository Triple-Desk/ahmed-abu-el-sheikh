# Ahmed Abu El-Sheikh Woodworks — ورشة أحمد أبو الشيخ

Single-owner business system for a carpentry workshop: materials by type (sheets, solid wood, linear, count, liquid),
product templates made of pieces with dimensions, custom orders/quotations with accurate wood costing (waste, sheets to buy,
full-sheet option, frozen estimate at confirmation, estimated vs. actual profit), purchases with weighted average cost,
materials & finished-products stores, production, delivery, customer payments & receipts, suppliers, workshop expenses, reports.
Orders can carry one agreed price for the whole order (item prices optional) and stay editable after confirmation; money received
later comes off the oldest balances automatically; each customer has an account statement that is sent to WhatsApp as a picture.

- `index.html` + `app.css` + `js/` — the app (Arabic, RTL, PWA), hosted on GitHub Pages. It talks to the Google Apps Script API.
  Connection details are **not** stored here; they come from the owner's private link (`#d=<deployment id>&k=<key>`) and are remembered on the device.
- `apps-script/` — server (Google Apps Script, JSON API only). Data lives in the owner's Google Sheet. `Engine.gs` is the costing
  engine; the identical file `js/engine.js` runs in the browser so on-screen numbers equal saved numbers.
- `test/` — `cd test && npm i && npm test` (engine math, server scenarios on mocked Google services, interface flows in jsdom).
- Server upgrades: after new Apps Script code is deployed as a new version, the first API call backs up the database and adds any
  new columns/settings by itself (`autoUpgrade_`, once per `APP.VERSION`). Deploy the server **before** pushing an app that needs it.
