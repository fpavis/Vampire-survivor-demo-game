export const CSS = `
#ui-root{
  --font-ui:Nunito,'Trebuchet MS',Verdana,sans-serif;--font-display:Cinzel,Georgia,'Palatino Linotype',serif;
  --c-text:#e9eefc;--c-soft:#c9d1e6;--c-muted:#9aa6c8;--c-dim:#8e97b0;--c-gold:#ffd84a;--c-gold-deep:#d9a440;
  --c-panel:#151c33;--c-panel-2:#1d2646;--c-frame:rgba(12,16,30,.94);--c-line:#2e3a62;--c-line-2:#3a4a78;--c-line-3:#4c5b86;
  --c-good:#9be09b;--c-bad:#ff9a9a;--c-mana:#6ab8ff;--c-focus:#8fb0ff;
  --r-s:8px;--r-m:10px;--r-l:14px;--sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;
  position:fixed;inset:0;pointer-events:none;font-family:var(--font-ui);font-weight:600;color:var(--c-text);z-index:10;user-select:none;-webkit-user-select:none}
#ui-root b,#ui-root strong{font-weight:800}
.vs-icon{display:inline-block;width:1.15em;height:1.15em;vertical-align:-.2em;flex:none;overflow:visible}
.ic>.vs-icon,.pi>.vs-icon{width:1em;height:1em;vertical-align:middle}
#ui-root *{box-sizing:border-box}
#ui-root .hit{pointer-events:auto}
.vs-bar{position:absolute;right:16px;bottom:16px;display:flex;flex-direction:column;align-items:flex-end;gap:8px;transform:scale(var(--hs,1));transform-origin:bottom right}
.vs-mana{width:190px;height:16px;border-radius:8px;background:rgba(8,12,24,.78);border:2px solid #2d4a7a;overflow:hidden;position:relative}
.vs-mana>i{position:absolute;inset:0 auto 0 0;background:linear-gradient(#6ab8ff,#2f77d6);transition:width .12s}
.vs-mana>b{position:absolute;inset:0;text-align:center;font-size:11px;line-height:12px;text-shadow:0 1px 2px #000}
.vs-skills{display:flex;gap:8px}
.vs-skill{position:relative;width:58px;height:58px;border-radius:12px;background:rgba(10,14,26,.82);border:2px solid #4c5b86;display:grid;place-items:center;font-size:28px;cursor:pointer;overflow:hidden;padding:0;color:inherit;font-family:inherit}
.vs-skill.empty{opacity:.3;cursor:default;font-size:12px;border-style:dashed}
.vs-skill.poor{border-color:#a04848;filter:saturate(.4)}
.vs-skill .cd{position:absolute;inset:0;background:rgba(0,0,0,.62);transform-origin:bottom;pointer-events:none}
.vs-skill .k{position:absolute;left:4px;top:2px;font-size:11px;font-weight:700;color:#cdd7f5;text-shadow:0 1px 2px #000}
.vs-skill .c{position:absolute;right:4px;bottom:2px;font-size:11px;font-weight:700;color:#8fc8ff;text-shadow:0 1px 2px #000}
.vs-btns{display:flex;gap:8px}
.vs-btn{pointer-events:auto;display:inline-flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(rgba(22,28,48,.9),rgba(10,14,26,.9));border:2px solid var(--c-line-3);color:#dfe6ff;border-radius:var(--r-m);padding:6px 10px;font:inherit;font-size:13px;cursor:pointer;transition:border-color .12s,background .12s,transform .06s}
.vs-btn:hover{border-color:var(--c-focus);background:linear-gradient(rgba(32,40,68,.95),rgba(14,18,34,.95))}
.vs-btn:active:not(:disabled){transform:translateY(1px)}
.vs-btn.vs-ico{font-size:18px;line-height:1;padding:6px 8px;min-width:38px}
.vs-pillbar{position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:2;pointer-events:none}
.vs-pill{pointer-events:auto;padding:7px 16px;border-radius:20px;background:linear-gradient(var(--c-gold),#e8a317);color:#2a1a00;font-weight:700;font-size:14px;border:0;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.5);animation:vs-pulse 1.3s infinite}
@keyframes vs-pulse{50%{transform:scale(1.07)}}
.vs-panel{position:absolute;z-index:5;background:linear-gradient(rgba(18,24,44,.96),rgba(10,13,26,.96));border:2px solid var(--c-line-2);border-radius:var(--r-l);padding:14px;box-shadow:0 6px 28px rgba(0,0,0,.6),inset 0 0 0 1px rgba(217,164,64,.18)}
/* panels ease in (opacity and the independent scale/translate properties, so each panel keeps its own transform);
   reduced motion turns every animation off below */
@keyframes vs-panel-in{from{opacity:0;scale:.97;translate:0 6px}to{opacity:1;scale:1;translate:0 0}}
.vs-panel{animation:vs-panel-in .14s cubic-bezier(.2,.8,.3,1) both}
.vs-panel h2{margin:0 0 4px;font-family:var(--font-display);font-weight:700;font-size:19px;letter-spacing:.5px;color:#f3e6c4;display:flex;align-items:center;gap:8px}
.vs-panel .sub{font-size:12px;color:var(--c-muted);margin-bottom:10px}
.vs-cards{right:16px;bottom:150px;width:min(320px,calc(100vw - 32px));max-height:calc(100vh - 290px);overflow:auto}
.vs-card{display:flex;gap:10px;width:100%;text-align:left;background:var(--c-panel);border:2px solid var(--rc,#666);border-radius:12px;padding:10px;margin-bottom:8px;color:inherit;font:inherit;cursor:pointer}
.vs-card:hover,.vs-card:focus-visible{background:#1c2644;outline:0;transform:translateX(-3px)}
.vs-card .ic{font-size:32px;width:46px;text-align:center}
.vs-card .tg{font-size:10px;font-weight:700;letter-spacing:1px;color:var(--rc)}
.vs-card .nm{font-size:17px;font-weight:700}
.vs-card .ln{font-size:12.5px;color:var(--c-soft)}
.vs-card .kb{margin-left:auto;font-size:11px;color:#77809a;align-self:flex-start}
.vs-check{font-size:12px;color:var(--c-muted);display:flex;gap:6px;align-items:center;margin-top:4px;cursor:pointer}
.vs-load{left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto}
.vs-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:640px){.vs-cols{grid-template-columns:1fr}}
.vs-sec{font-size:11px;letter-spacing:1.2px;color:var(--c-dim);font-weight:800;margin:10px 0 6px;text-transform:uppercase}
.vs-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:var(--c-panel);border:2px solid var(--c-line);border-radius:10px;padding:6px 8px;margin-bottom:6px;color:inherit;font:inherit;cursor:pointer}
.vs-item.sel{border-color:var(--c-gold);background:var(--c-panel-2)}
.vs-item.eq{box-shadow:inset 3px 0 0 #6ab8ff}
.vs-item .ic{font-size:24px;width:30px;text-align:center}
.vs-item small{display:block;color:var(--c-muted);font-size:11px}
.vs-socks{display:flex;gap:8px;margin:8px 0}
.vs-sock{width:54px;height:54px;border-radius:50%;border:2px dashed #5a6aa0;background:#0e1426;display:grid;place-items:center;font-size:24px;cursor:pointer;color:inherit;font-family:inherit;padding:0}
.vs-sock.full{border-style:solid;border-color:#b8a8ff}
.vs-sock.drop{border-color:#7be07b;box-shadow:0 0 10px #7be07b88}
.vs-rune{display:inline-flex;flex-direction:column;align-items:center;gap:2px;width:68px;margin:0 6px 6px 0;padding:6px 2px;background:var(--c-panel);border:2px solid var(--c-line);border-radius:10px;font-size:11px;color:inherit;font-family:inherit;cursor:pointer;text-align:center}
.vs-rune .ic{font-size:22px}
.vs-rune{position:relative}
.vs-rl{position:absolute;right:4px;top:2px;font-style:normal;font-weight:700;font-size:9px}
.vs-rune.sel{border-color:var(--c-gold)}
.vs-rune.bad{opacity:.35;cursor:not-allowed}
.vs-tip{min-height:38px;font-size:12.5px;color:var(--c-soft);margin-top:6px}
.vs-lock{background:#3a2222;border:1px solid #a04848;border-radius:8px;padding:6px 10px;font-size:12px;margin-bottom:8px}

.vs-x{position:absolute;right:10px;top:8px}
.vs-build{left:50%;top:50%;transform:translate(-50%,-50%);width:min(600px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto}
.vs-good .cost{font-weight:700;color:#ff9a8a}
.vs-good .cost .ok{color:var(--c-good)}
.vs-tpanel{left:50%;top:50%;transform:translate(-50%,-50%);width:min(520px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto}
.vs-tlv{display:inline-flex;gap:3px;margin-left:8px}
.vs-tlv i{width:9px;height:9px;border-radius:50%;border:1px solid var(--c-gold-deep);background:transparent}
.vs-tlv i.on{background:var(--c-gold)}
.vs-tup{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:4px 0}
.vs-tup>div{display:flex;flex-direction:column;gap:2px;padding:6px 8px;border:1px solid var(--c-line);border-radius:8px;background:var(--c-panel);font-size:12px}
.vs-tup>div.nx{border-color:var(--c-gold-deep)}
.vs-tup small{color:var(--c-soft);font-size:11.5px}
.vs-tpanel .vs-acts{align-items:center}
.vs-tpanel .cost{display:inline-flex;gap:6px;font-size:12px;margin-right:auto}
.vs-tpanel .cost .ok{color:var(--c-good)}
.vs-tpanel .cost .no{color:var(--c-bad)}
.vs-sub2{font-size:12px;color:var(--c-muted);margin:10px 0 2px}
.vs-buildhud{position:absolute;top:104px;left:50%;transform:translateX(-50%);width:min(420px,calc(100vw - 32px));text-align:center;padding:8px 12px;border-radius:12px;background:rgba(10,14,26,.9);border:2px solid #5aff8a;text-shadow:0 1px 3px #000}
.vs-buildhud.bad{border-color:#ff5a4a}
.vs-buildhud .t{font-weight:700;font-size:15px}
.vs-buildhud .r{font-size:12.5px;margin:3px 0 6px;color:#cfe}
.vs-buildhud.bad .r{color:#ffb0a0}
.vs-buildhud .b{display:flex;gap:8px;justify-content:center;pointer-events:auto}
.vs-sailing{position:absolute;top:112px;left:50%;transform:translateX(-50%);font-size:13px;font-weight:700;background:rgba(10,30,50,.82);border:2px solid #6ab8d8;border-radius:10px;padding:5px 12px;text-shadow:0 1px 3px #000;white-space:nowrap}
@media(max-width:700px){.vs-sailing{white-space:normal;width:calc(100vw - 32px);text-align:center}}
.vs-shop{left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto}
.vs-goods{display:flex;flex-direction:column;gap:7px}
.vs-good{display:grid;grid-template-columns:38px 1fr auto;gap:10px;align-items:center;padding:7px 9px;border:2px solid var(--gc);border-radius:10px;background:var(--c-panel)}
.vs-good.sold{opacity:.4}
.vs-good .ic{font-size:26px;text-align:center}
.vs-good .tx{display:flex;flex-direction:column;gap:1px;min-width:0}
.vs-good small{font-size:11.5px;color:var(--c-muted);line-height:1.25}
.vs-inn{left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,calc(100vw - 24px))}
.vs-hrow-mini{display:flex;flex-direction:column;gap:4px;margin:8px 0 12px;font-size:13px}
.vs-hrow-mini .dead{color:var(--c-bad)}
.vs-btn.big{width:100%;padding:10px;font-size:15px}
.vs-dialog{left:50%;bottom:150px;transform:translateX(-50%);width:min(520px,calc(100vw - 24px))}
.vs-dialog .who{display:flex;align-items:center;gap:8px;font-size:15px;margin-bottom:6px}
.vs-dialog .who .ic{font-size:26px}
.vs-dialog .say{font-size:15px;line-height:1.45;margin-bottom:8px}
.vs-hold{position:absolute;top:112px;left:50%;transform:translateX(-50%);width:min(340px,calc(100vw - 32px));text-align:center;font-size:13px;font-weight:700;text-shadow:0 1px 3px #000}
.vs-hold .b{height:10px;border-radius:6px;background:rgba(8,12,24,.8);border:2px solid #d9a440;margin-top:4px;overflow:hidden}
.vs-hold .b>i{display:block;height:100%;background:linear-gradient(#ffe27a,#e8a317)}
.vs-surface{max-width:260px;font-size:12px;padding:3px 9px;border-radius:8px;background:rgba(8,12,24,.78);border-left:4px solid var(--sc);text-align:right;text-shadow:0 1px 2px #000}
.vs-surface.bad{background:rgba(60,14,10,.82)}
.vs-surface .vs-icon{width:13px;height:13px;vertical-align:-2px;color:var(--sc)}
.vs-party{display:flex;flex-direction:column;gap:6px;width:178px}
.vs-hero{position:relative;display:grid;grid-template-columns:34px 1fr;gap:6px;align-items:center;padding:5px 7px;border-radius:10px;background:rgba(10,14,26,.8);border:2px solid #34426c;color:inherit;font:inherit;cursor:pointer;text-align:left;overflow:hidden}
.vs-hero.act{border-color:var(--hc);box-shadow:0 0 12px var(--hc)}
.vs-hero.dead{filter:grayscale(1);opacity:.55;cursor:not-allowed}
.vs-hero .pi{font-size:24px;text-align:center;position:relative}
.vs-hero .pi .lv{display:none}
.vs-hero .nm{font-size:12px;font-weight:700;display:flex;justify-content:space-between;gap:4px}
.vs-hero .nm i{font-style:normal;color:var(--c-muted);font-weight:400}
.vs-hero .b{display:block;height:6px;border-radius:3px;background:#0a0f1c;margin-top:3px;overflow:hidden}
.vs-hero .b>u{display:block;height:100%;text-decoration:none}
.vs-hero .hp{background:linear-gradient(#ff7a8a,#d6334f)}
.vs-hero .mp{background:linear-gradient(#6ab8ff,#2f77d6);height:4px}
.vs-hero .kb{position:absolute;right:5px;top:2px;font-size:10px;color:#77809a}
.vs-hero .pend{position:absolute;right:5px;bottom:3px;font-size:10px;font-weight:700;background:var(--c-gold);color:#2a1a00;border-radius:8px;padding:0 5px}
.vs-hero .cdv{position:absolute;inset:0;background:rgba(0,0,0,.5);pointer-events:none;transform-origin:left}
.vs-heal{left:50%;top:50%;transform:translate(-50%,-50%);width:min(460px,calc(100vw - 24px))}
.vs-hrow{display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;padding:8px;border:2px solid var(--c-line);border-radius:10px;margin-bottom:8px;background:var(--c-panel)}
.vs-hrow .pi{font-size:26px;text-align:center}
.vs-hrow .st{font-size:12px;color:var(--c-muted)}
.vs-hrow .st.dead{color:var(--c-bad)}
.vs-btn:disabled{opacity:.4;cursor:not-allowed}
.vs-tag{font-size:10px;background:#34426c;border-radius:6px;padding:1px 5px;margin-left:4px;color:#cdd7f5}
.vs-wallet{display:flex;gap:10px;font-size:13px;font-weight:700;background:rgba(8,12,24,.7);border-radius:8px;padding:3px 9px;text-shadow:0 1px 2px #000}
.vs-tools{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px;font-size:12px;color:var(--c-muted)}
.vs-in{background:#0e1426;color:#e9eefc;border:1px solid var(--c-line-2);border-radius:6px;padding:4px 6px;font:inherit;font-size:12px}
.vs-zone{border:2px dashed transparent;border-radius:10px;padding:3px;min-height:34px;transition:border-color .1s,background .1s}
.vs-zone.can,.vs-azone.can{border-color:#4fae6a;background:rgba(79,174,106,.08)}
.vs-zone.cant,.vs-azone.cant{border-color:#a04848;background:rgba(160,72,72,.07)}
.vs-zone.over.can,.vs-azone.over.can,.vs-sock.over.can{background:rgba(79,174,106,.25)}
.vs-zone.over.cant,.vs-azone.over.cant,.vs-sock.over.cant{background:rgba(160,72,72,.25)}
.vs-sock.can{border-color:#4fae6a}.vs-sock.cant{border-color:#a04848;opacity:.6}
.vs-azone{display:flex;align-items:center;gap:6px;border:2px dashed transparent;border-radius:10px;padding:3px;margin-bottom:4px}
.vs-azone .vs-item{margin:0;flex:1;min-width:0}
.vs-key{width:44px;text-align:center;font-size:11px;font-weight:700;color:#cdd7f5;background:var(--c-panel-2);border-radius:6px;padding:4px 0}
.vs-empty{color:#6c7798;font-size:12px;padding:6px 8px}
.vs-lockb{background:none;border:0;cursor:pointer;font-size:14px;padding:2px;color:inherit}
.vs-ghost{position:fixed;transform:translate(-50%,-120%);pointer-events:none;background:#243266;border:2px solid var(--c-gold);border-radius:10px;padding:6px 10px;font-size:14px;font-weight:700;z-index:50;box-shadow:0 6px 18px rgba(0,0,0,.6)}
.vs-runes{min-height:56px}
.vs-fit{margin-left:10px;font-weight:400;letter-spacing:0;color:var(--c-muted)}
.vs-salv{margin-top:10px;text-align:center;color:var(--c-muted);font-size:13px;padding:10px;border-color:var(--c-line-2)}
.vs-small{font-size:11px}
.vs-foot{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:10px;font-size:13px;font-weight:700}
.vs-foot label{font-weight:400;font-size:12px;color:var(--c-muted);margin-left:auto}
.vs-item:focus-visible,.vs-rune:focus-visible{outline:2px solid var(--c-gold)}
.vs-item,.vs-rune{user-select:none;cursor:grab}


/* focus follows the device: a bright ring for keyboard and controller, none for mouse and touch */
#ui-root button:focus,#ui-root [tabindex]:focus,#ui-root select:focus,#ui-root input:focus{outline:none}
html[data-input="key"] #ui-root :focus,html[data-input="pad"] #ui-root :focus{outline:3px solid var(--c-gold);outline-offset:2px;box-shadow:0 0 14px rgba(255,216,74,.65)}
html[data-input="key"] #ui-root :focus:not(.vs-x):not(.vs-tracker),html[data-input="pad"] #ui-root :focus:not(.vs-x):not(.vs-tracker){position:relative;z-index:1}
html[data-input="key"] #ui-root .vs-card:focus,html[data-input="pad"] #ui-root .vs-card:focus{background:#1c2644;transform:translateX(-3px)}
html[data-input="pad"] #ui-root input[type=range]:focus{outline-offset:6px}
.vs-pause{left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;z-index:20}
.vs-pause .vs-btn{display:flex;justify-content:flex-start;margin:4px 0;width:100%;text-align:left}
.vs-pause .vs-pacts{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:6px 0 10px}
.vs-pause .vs-pacts .vs-btn{margin:0;justify-content:center;font-size:12px}
.vs-btn.warn{border-color:#ff8a6a;color:#ffd0c0;background:rgba(120,40,30,.55)}
.vs-tabs{display:flex;gap:4px;flex-wrap:wrap;margin:8px 0 6px;padding-bottom:6px;border-bottom:1px solid var(--c-line)}
.vs-pause .vs-tabs .vs-btn.vs-tab,.vs-tabs .vs-btn.vs-tab{width:auto;margin:0;padding:5px 9px;font-size:12px;border-radius:var(--r-s);opacity:.8;justify-content:center}
.vs-tabs .vs-btn.vs-tab.on{opacity:1;border-color:var(--c-gold);color:#fff3cc;background:rgba(90,70,20,.45)}
.vs-tabbody{min-height:120px}
.vs-btn.vs-toggle .lb{flex:1}
.vs-btn.vs-toggle .st{font-size:11px;font-weight:800;padding:1px 8px;border-radius:999px;background:#2a3150;color:var(--c-muted)}
.vs-btn.vs-toggle.on .st{background:rgba(255,216,74,.18);color:var(--c-gold)}
.vs-row select.vs-in{flex:1;min-width:0}
.vs-options{z-index:24}
.vs-slots{left:50%;top:50%;transform:translate(-50%,-50%);width:min(640px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;z-index:26}
.vs-slots.busy{opacity:.7;pointer-events:none}
.vs-slot{display:flex;gap:12px;padding:10px;margin-bottom:8px;border:1px solid var(--c-line);border-radius:var(--r-m);background:var(--c-panel)}
.vs-slot.empty{opacity:.85}
.vs-thumb{flex:0 0 120px;height:68px;border-radius:6px;overflow:hidden;background:#0b0f1c;display:grid;place-items:center;font-size:28px;color:var(--c-line-3);border:1px solid var(--c-line)}
.vs-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.vs-slotbody{flex:1;min-width:0}
.vs-slotbody .t{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.vs-slotbody .when{font-size:11px;color:var(--c-dim)}
.vs-slotbody .d{font-size:12px;color:var(--c-soft);margin-top:2px}
.vs-slotbody .d.bad,.vs-import .d{color:var(--c-bad)}
.vs-backups{border-left:2px solid var(--c-line);padding-left:8px}
.vs-backups .vs-acts{align-items:center;margin:4px 0}
.vs-export textarea,.vs-import textarea{width:100%;font-family:ui-monospace,Consolas,monospace;font-size:11px;resize:vertical}
.vs-import .vs-row{margin:0}
.vs-import .vs-row>span{flex:0 0 auto}
.vs-file{position:relative;overflow:hidden}
.vs-file input{position:absolute;inset:0;opacity:0;cursor:pointer}
.vs-version{position:absolute;right:12px;bottom:8px;font-size:11px;color:rgba(220,228,255,.55);text-shadow:0 1px 2px #000}
.vs-seed{position:absolute;left:50%;bottom:40px;transform:translateX(-50%);display:flex;gap:8px;align-items:center;font-size:12px;color:var(--c-soft)}
.vs-seed .vs-in{width:150px}
.vs-btn.vs-link{background:none;border-color:transparent;color:var(--c-soft);font-size:12px}
.vs-btn.vs-link:hover{border-color:var(--c-line-2)}
.vs-news{position:absolute;left:16px;bottom:16px;width:min(340px,calc(100vw - 32px));padding:12px 30px 10px 14px;border-radius:var(--r-m);background:rgba(18,24,44,.92);border:1px solid rgba(217,164,64,.5);font-size:12px;color:var(--c-soft)}
.vs-news .h{font-family:var(--font-display);font-weight:700;color:#f3e6c4;font-size:13px;margin-bottom:4px}
.vs-news ul{margin:4px 0 0;padding-left:18px}
.vs-news .vs-x{position:absolute;right:4px;top:4px;padding:1px 6px}
.vs-credits{left:50%;top:50%;transform:translate(-50%,-50%);width:min(480px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;z-index:25}
.vs-credits p{margin:2px 0 4px;font-size:13px;color:var(--c-soft)}
.vs-credits .vs-btn.big{width:100%;margin-top:12px}
.vs-stats .vs-stat{display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid rgba(46,58,98,.5);font-size:13px}
.vs-stats .vs-stat span{flex:1;color:var(--c-soft)}
.vs-stats .vs-stat b{color:var(--c-gold)}
.vs-kinds{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--c-soft)}
.vs-kinds b{color:var(--c-text)}
.vs-subtabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.vs-subtabs small{color:var(--c-muted);font-variant-numeric:tabular-nums}
.vs-cx{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(46,58,98,.45)}
.vs-cx .pic{flex:0 0 52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:26px;background:var(--c-panel);border-radius:var(--r-s);overflow:hidden}
.vs-cx .pic img{max-width:48px;max-height:48px;image-rendering:auto}
.vs-cx .tx{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.vs-cx small{font-size:12px;color:var(--c-soft)}
.vs-cx small.num{color:var(--c-muted);font-variant-numeric:tabular-nums}
.vs-cx.unknown{opacity:.5}
.vs-cx.unknown .pic{font-family:var(--font-display);color:var(--c-muted)}
.vs-log{list-style:none;margin:0;padding:0;font-size:12px}
.vs-log li{display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid rgba(46,58,98,.45);color:var(--c-soft)}
.vs-log li.big{color:#f3e6c4;font-weight:800}
.vs-log .t{flex:0 0 54px;color:var(--c-dim);font-size:11px}
.vs-log .x{flex:1;min-width:0}
.vs-log .dot{display:inline-block;width:1.15em}
.vs-pause .vs-btn.vs-x{width:auto;margin:0}
.vs-pause .vs-btn.big{font-size:16px;text-align:center;padding:10px;border-color:#6aa8ff;background:rgba(40,70,140,.55)}
.vs-row{display:flex;align-items:center;gap:12px;margin:8px 0;font-size:13px}
.vs-row>span{flex:0 0 140px;color:var(--c-soft)}
.vs-row input[type=range]{flex:1;min-width:0;accent-color:var(--c-gold);height:22px}
.vs-row .v{flex:0 0 60px;text-align:right;color:var(--c-gold)}
.vs-keys{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
.vs-keys th{text-align:left;color:var(--c-dim);font-size:10px;letter-spacing:1px;padding:4px 6px;border-bottom:1px solid var(--c-line)}
.vs-keys td{padding:4px 6px;border-bottom:1px solid #1b2340;color:#dfe6ff}
.vs-keys td:first-child{color:var(--c-soft)}
.vs-acts{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.vs-acts .vs-btn{font-size:12px;padding:6px 9px}
.vs-hint-pad{display:none}
html[data-input="pad"] .vs-hint-pad{display:inline}
html[data-input="pad"] .vs-hint-key{display:none}

.vs-journal{left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto}
.vs-board{left:50%;top:50%;transform:translate(-50%,-50%);width:min(640px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto}
.vs-padsetup{left:50%;top:50%;transform:translate(-50%,-50%);width:min(460px,calc(100vw - 24px));z-index:60;text-align:center}
.vs-padsetup .ask{font-family:var(--font-display);font-size:20px;color:var(--c-gold);margin:12px 0}
.vs-padsetup .vs-bar{height:6px;border-radius:3px;background:#0a0f1c;overflow:hidden;margin:6px 0 12px}
.vs-padsetup .vs-bar>u{display:block;height:100%;background:var(--c-gold);text-decoration:none}
.vs-padsetup .vs-acts{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.vs-padrow .vs-acts{display:flex;gap:6px;flex-wrap:wrap}
.vs-standing{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline;margin:6px 0;color:#ffd98a}
.vs-standing small{color:var(--c-muted)}
.vs-strow{display:flex;justify-content:space-between;gap:10px;align-items:baseline;border-bottom:1px solid var(--c-line);padding:2px 0}
.vs-strow .vs-standing{margin:0}
.vs-rumour .vs-acts{display:flex;flex-direction:column;gap:4px}
.vs-inn{max-height:calc(100vh - 24px);overflow:auto}
.vs-quest{background:#131a30;border:2px solid var(--c-line);border-radius:12px;padding:9px 11px;margin:6px 0}
.vs-quest.tracked{border-color:#5a8aff}
.vs-quest.ready{border-color:#7be07b}
.vs-quest .hd{display:flex;gap:8px;align-items:center;font-size:15px}
.vs-quest .sub{margin:3px 0 6px}
.vs-quest .rw{font-size:12px;color:#ffe9a8;margin-top:4px}
.vs-tag.ok{background:#2c5a34;color:#bff0c4}
.vs-obj{list-style:none;margin:4px 0;padding:0;font-size:13px}
.vs-obj li{display:flex;gap:8px;padding:2px 0;color:#dfe6ff}
.vs-obj li.done{color:var(--c-dim);text-decoration:line-through}
.vs-obj .ck{width:16px}
.vs-obj .tx{flex:1;min-width:0}
.vs-obj .pr{color:var(--c-gold);font-weight:700}
.vs-lords{display:flex;flex-direction:column;gap:3px;font-size:13px;margin:4px 0}
.vs-lord{color:#ffb0b0}
.vs-lord.dead{color:#7a8296;text-decoration:line-through}
.vs-lord.sov{color:#e6b8ff}
.vs-tracker{display:block;width:min(250px,calc(100vw - 32px));text-align:left;color:inherit;font:inherit;cursor:pointer;background:rgba(8,12,24,.72);border:1px solid var(--c-line-2);border-left:3px solid #7ad8ff;border-radius:8px;padding:6px 9px;font-size:12px;line-height:1.35;text-shadow:0 1px 2px #000}
.vs-tracker:hover{border-color:#7ad8ff}
.vs-tracker .more{color:var(--c-dim)}
.vs-tracker .t{font-weight:700;font-size:13px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vs-tracker .o.done{color:var(--c-dim);text-decoration:line-through}
.vs-tracker .r{color:var(--c-good);margin-top:2px}
.vs-coach{position:relative;display:flex;gap:8px;align-items:flex-start;width:min(250px,calc(100vw - 32px));background:rgba(20,16,6,.86);border:1px solid #7a6a3a;border-left:3px solid var(--c-gold);border-radius:8px;padding:7px 5px 7px 9px;font-size:12px;line-height:1.4;text-shadow:0 1px 2px #000;animation:vs-coach-in .35s ease-out}
.vs-coach .ic{flex:none;font-size:18px;line-height:1}
.vs-coach .tx{flex:1;min-width:0}
.vs-howto p{margin:4px 0 8px;font-size:12.5px;line-height:1.45;color:var(--c-soft)}
.vs-howto b{color:var(--c-gold)}
.vs-coach .vs-x{position:static;flex:none;padding:1px 6px;font-size:11px;min-height:0}
@keyframes vs-coach-in{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:none}}
.vs-choices{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.vs-choices .vs-btn{text-align:left}
.vs-perf{position:absolute;right:56px;top:22px;font:11px/1.2 ui-monospace,Consolas,monospace;color:#bfffcf;background:rgba(0,0,0,.6);padding:3px 7px;border-radius:6px;pointer-events:none;z-index:30}
.vs-rebind{background:rgba(12,16,30,.99);left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;z-index:22}
.vs-binds{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:4px 14px}
.vs-bind{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;color:var(--c-soft)}
.vs-bind .vs-btn{min-width:96px;text-align:center}
.vs-bind .vs-btn.wait{border-color:var(--c-gold);color:var(--c-gold);animation:vs-glow 1s infinite}

/* loadout: hero switcher, button hints, rune picker */
.vs-heroes{display:inline-flex;gap:4px;margin-left:10px;vertical-align:middle}
.vs-btn.vs-hb{padding:2px 6px;font-size:15px;opacity:.55}
.vs-btn.vs-hb.on{opacity:1;border-color:var(--c-gold)}
.vs-btn.vs-hb.act{box-shadow:inset 0 -2px 0 var(--c-good)}
.vs-btn.vs-hb.down{filter:grayscale(1)}
.vs-viewing{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:2px 0 8px;padding:6px 10px;border-radius:var(--r-s, 8px);background:color-mix(in srgb, var(--c-gold) 12%, transparent);border:1px solid color-mix(in srgb, var(--c-gold) 40%, transparent);font-size:12.5px}
.vs-viewing span{flex:1;min-width:180px}
.vs-sets{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0 0}
.vs-sets .vs-sec{margin:0 4px 0 0}
.vs-set{display:inline-flex;gap:2px}
.vs-btn.vs-mini{padding:2px 6px}
.vs-favb{background:none;border:0;cursor:pointer;font-size:14px;padding:2px;color:inherit;opacity:.45}
.vs-favb.on{opacity:1;color:var(--c-gold)}
.vs-tag.vs-new{background:var(--c-gold);color:#1b1408;font-weight:700}
.vs-rnew{position:absolute;left:2px;top:-6px;margin:0;font-style:normal}
.vs-dps{font-size:12.5px;color:var(--c-good);margin-top:4px;font-variant-numeric:tabular-nums}
.vs-btn[data-act="assist"].on{border-color:var(--c-good)}
.vs-subtabs .vs-btn.on{border-color:var(--c-gold);color:#fff3cc}
.vs-says{font-style:italic;color:var(--c-soft)}
/* story moments: boss and victory cards in a letterbox, the ending roll, the death screen */
.vs-story-card{position:fixed;left:0;right:0;top:0;bottom:0;z-index:30;pointer-events:none;display:flex;align-items:center;justify-content:center}
.vs-story-card .bar{position:fixed;left:0;right:0;height:10vh;background:#000;animation:vs-bar-in .45s ease-out both}
.vs-story-card .bar.top{top:0}
.vs-story-card .bar.bottom{bottom:0}
@keyframes vs-bar-in{from{height:0}to{height:10vh}}
.vs-story-card .in{text-align:center;padding:18px 32px;width:min(760px,94vw);background:linear-gradient(90deg,transparent,rgba(6,8,16,.84) 18%,rgba(6,8,16,.84) 82%,transparent);animation:vs-card-in .6s cubic-bezier(.2,.8,.3,1) both}
@keyframes vs-card-in{from{opacity:0;letter-spacing:6px}to{opacity:1}}
.vs-story-card .k{font-size:12px;letter-spacing:5px;text-transform:uppercase;color:var(--c-muted)}
.vs-story-card .n{font-family:var(--font-display);font-weight:700;font-size:clamp(28px,5.2vw,50px);letter-spacing:2px;color:#f3e6c4;text-shadow:0 2px 14px rgba(0,0,0,.8)}
.vs-story-card.boss .n{color:#ff9a86}
.vs-story-card.victory .n{color:var(--c-gold)}
.vs-story-card .t{font-family:var(--font-display);font-size:clamp(15px,2.2vw,20px);color:#e8cf8a;margin-top:2px}
.vs-story-card .x{font-size:14px;font-style:italic;color:var(--c-soft);margin-top:8px;text-wrap:balance}
.vs-story-card.wake{align-items:flex-end;padding-bottom:20vh}
/* a story scene: the bars close in, the speaker's card sits low between them, the line types out */
.vs-scene{position:fixed;inset:0;z-index:31;display:flex;align-items:flex-end;justify-content:center;padding-bottom:calc(14vh + 10px);cursor:pointer}
.vs-scene .bar{position:fixed;left:0;right:0;height:13vh;background:#000;animation:vs-bar-in .45s ease-out both}
.vs-scene .bar.top{top:0}
.vs-scene .bar.bottom{bottom:0}
.vs-scene-box{display:flex;gap:14px;align-items:flex-start;width:min(760px,calc(100vw - 32px));padding:14px 18px;background:rgba(8,10,20,.9);border:2px solid #5a3a3a;border-radius:12px;animation:vs-card-in .5s cubic-bezier(.2,.8,.3,1) both}
.vs-scene .pic{flex:0 0 auto;width:84px;height:84px;display:flex;align-items:center;justify-content:center;background:#1a1222;border:2px solid #8a5a4a;border-radius:10px;overflow:hidden;font-size:44px;color:#f3e6c4}
.vs-scene .pic img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated}
.vs-scene .tx{flex:1;min-width:0}
.vs-scene .who{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}
.vs-scene .who b{font-family:var(--font-display);font-size:22px;letter-spacing:1px;color:#ff9a86}
.vs-scene .who small{font-family:var(--font-display);font-size:14px;color:#e8cf8a}
.vs-scene p{margin:6px 0 4px;font-size:17px;line-height:1.45;color:var(--c-text);min-height:2.9em}
.vs-scene p .rest{visibility:hidden}
.vs-scene .hint{font-size:12px;color:var(--c-muted);text-align:right}
.vs-scene .hint small{margin-left:8px}
.vs-scene.narrator .vs-scene-box{border-color:#6a5a2a;justify-content:center;text-align:center}
.vs-scene.narrator p{font-style:italic;color:#f3e6c4}
.vs-story-card.wake .n{font-size:clamp(22px,3.6vw,32px)}
.vs-panel.vs-ending{position:fixed;inset:0;border:0;border-radius:0;z-index:40;display:flex;flex-direction:column;align-items:center;padding:16px;background:radial-gradient(ellipse at 50% 40%,rgba(30,26,48,.94),rgba(4,4,10,.98))}
.vs-ending .vs-x{position:absolute;top:12px;right:16px}
.vs-roll-view{flex:1;width:min(640px,100%);overflow:hidden;position:relative;-webkit-mask-image:linear-gradient(transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(transparent,#000 12%,#000 88%,transparent)}
.vs-roll{text-align:center;padding:60vh 0 20vh;animation:vs-roll 58s linear both}
@keyframes vs-roll{from{transform:translateY(0)}to{transform:translateY(-100%)}}
html.vs-reduced .vs-roll-view{overflow-y:auto}
html.vs-reduced .vs-roll{padding:24px 0}
.vs-roll h1{font-family:var(--font-display);font-size:clamp(30px,5vw,46px);color:#f3e6c4;margin:0 0 18px}
.vs-roll h2{font-family:var(--font-display);font-size:20px;color:var(--c-gold);margin:42px 0 10px;letter-spacing:1px}
.vs-roll p{font-size:16px;line-height:1.7;color:var(--c-soft);margin:6px auto;max-width:56ch}
.vs-roll dl{margin:0 auto;max-width:380px}
.vs-roll dl div{display:flex;justify-content:space-between;gap:16px;padding:4px 0;border-bottom:1px solid rgba(46,58,98,.45)}
.vs-roll dt{color:var(--c-muted)}
.vs-roll dd{margin:0;color:var(--c-text);font-variant-numeric:tabular-nums;font-weight:700}
.vs-roll .fin{font-family:var(--font-display);font-size:22px;color:#f3e6c4;margin-top:56px}
.vs-panel.vs-death{position:fixed;inset:0;border:0;border-radius:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:16px;background:radial-gradient(ellipse at 50% 45%,rgba(60,8,14,.55),rgba(10,0,4,.94));animation:vs-death-in .9s ease-out both}
@keyframes vs-death-in{from{opacity:0}to{opacity:1}}
.vs-panel.vs-worldmap{position:fixed;inset:12px;z-index:30;display:flex;flex-direction:column;gap:8px;padding:10px 12px}
.vs-worldmap .top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.vs-worldmap .top h2{margin:0;font-size:18px}
.vs-worldmap .tools{display:flex;align-items:center;gap:6px}
.vs-worldmap .tools .z{min-width:30px;text-align:center;font-variant-numeric:tabular-nums;color:var(--c-muted);font-size:12px}
.vs-worldmap .view{position:relative;flex:1;min-height:0;border-radius:10px;overflow:hidden;border:1px solid var(--c-line-2);background:#05070c}
.vs-worldmap canvas{position:absolute;inset:0;width:100%;height:100%;cursor:grab;touch-action:none;image-rendering:pixelated}
.vs-worldmap canvas:active{cursor:grabbing}
.vs-worldmap .tip{position:absolute;pointer-events:none;background:rgba(8,12,22,.92);border:1px solid var(--c-line-2);border-radius:8px;padding:5px 9px;font-size:12px;display:flex;flex-direction:column;max-width:240px}
.vs-worldmap .tip small{color:var(--c-muted)}
.vs-worldmap .foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 16px;font-size:12px;color:var(--c-muted)}
.vs-worldmap .legend{display:flex;flex-wrap:wrap;gap:4px 14px}
.vs-worldmap .legend span{display:inline-flex;align-items:center;gap:5px}
.vs-worldmap .legend .vs-icon{width:16px;height:16px}
.vs-worldmap.travel .dests{position:absolute;top:8px;right:8px;bottom:8px;width:min(270px,45%);overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:6px;border-radius:10px;background:rgba(8,12,22,.86);border:1px solid var(--c-line-2)}
.vs-worldmap .dest{display:flex;align-items:center;gap:8px;text-align:left;justify-content:flex-start;padding:6px 8px}
.vs-worldmap .dest .tx{display:flex;flex-direction:column;min-width:0}
.vs-worldmap .dest .tx b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vs-worldmap .dest small{color:var(--c-muted);font-size:11px}
.vs-worldmap .dest.town .vs-icon{color:#ffd070}
.vs-worldmap .dest.waypoint .vs-icon{color:#c48af5}
.vs-worldmap .dest.on{outline:2px solid currentColor;outline-offset:-2px}
.vs-worldmap .dest.town.on{color:#ffe7a8}
.vs-worldmap .dest.waypoint.on{color:#e2c8ff}
.vs-worldmap .confirm{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:10px;border:1px solid var(--c-line-2);background:rgba(20,26,40,.9)}
.vs-worldmap .confirm em{color:#ff9a8a;font-style:normal}
.vs-worldmap .confirm .vs-icon{width:16px;height:16px;vertical-align:-3px}
@media (max-width:620px){.vs-worldmap.travel .dests{top:auto;left:8px;width:auto;max-height:40%}}
.vs-death .box{width:min(440px,100%);text-align:center}
.vs-death h1{font-family:var(--font-display);font-weight:700;font-size:clamp(40px,8vw,64px);letter-spacing:3px;color:#ff7a6a;margin:0;text-shadow:0 3px 18px rgba(160,10,10,.6)}
.vs-death .sub{font-size:14px;color:var(--c-soft);margin:4px 0 16px}
.vs-death .rows{background:var(--c-frame);border:1px solid var(--c-line);border-radius:var(--r-m);padding:6px 14px;text-align:left}
.vs-death .row{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(46,58,98,.45);font-size:14px}
.vs-death .row:last-child{border-bottom:0}
.vs-death .row span{flex:1;color:var(--c-muted)}
.vs-death .row b{font-variant-numeric:tabular-nums;color:var(--c-text);font-size:16px}
.vs-acts.col{flex-direction:column;align-items:stretch;margin-top:14px}
.vs-death .vs-btn.go{border-color:#5fd88a;background:rgba(30,90,50,.6);color:#d8ffe4}
.vs-death .hint{font-size:12px;color:var(--c-muted);margin-top:10px}
.vs-meter{display:flex;flex-direction:column;gap:2px;width:min(270px,calc(100vw - 32px));padding:8px 12px;background:var(--c-panel);border:1px solid var(--c-line);border-radius:var(--r-m);font-size:13px;pointer-events:auto}
.vs-meter .hd{display:flex;align-items:center;gap:8px}
.vs-meter .hd .vs-icon{font-size:22px}
.vs-meter .hd .vs-btn{margin-left:auto;font-size:11px;padding:2px 8px}
.vs-meter .n{font-variant-numeric:tabular-nums;color:var(--c-gold);font-size:15px}
.vs-meter small{color:var(--c-muted);font-variant-numeric:tabular-nums}
.vs-meter .n small{font-size:11px;margin-left:4px}
.vs-mrows{display:flex;flex-direction:column;gap:3px;margin:5px 0 3px}
.vs-mrow{position:relative;display:grid;grid-template-columns:18px minmax(0,1fr) auto 34px;align-items:center;gap:6px;font-size:12px;padding:2px 4px;border-radius:5px;overflow:hidden}
.vs-mrow::before{content:'';position:absolute;inset:0 auto 0 0;width:var(--sh);background:rgba(255,216,74,.14);pointer-events:none}
.vs-mrow .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vs-mrow b{font-variant-numeric:tabular-nums;color:var(--c-text)}
.vs-mrow .sh{font-size:11px;color:var(--c-muted);text-align:right;font-variant-numeric:tabular-nums}
.vs-kind{font-style:normal;font-size:9.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;background:#34426c;color:#cdd7f5;border-radius:4px;padding:0 4px;margin-left:5px}
.vs-meter .note{font-size:10.5px;line-height:1.25}
.vs-hintbar{position:sticky;bottom:-14px;margin:10px -14px -14px;padding:7px 14px;display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11.5px;color:#aab4cc;background:rgba(8,11,22,.97);border-top:1px solid var(--c-line);border-radius:0 0 12px 12px}
.vs-hintbar kbd{display:inline-block;min-width:18px;text-align:center;font:700 10.5px/1 inherit;color:#ffe9a8;background:var(--c-panel-2);border:1px solid var(--c-line-2);border-bottom-width:2px;border-radius:5px;padding:3px 5px;margin-right:4px}
.vs-hintbar kbd+kbd{margin-left:-1px}
.vs-picker{left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,calc(100vw - 24px));max-height:calc(100vh - 40px);overflow:auto;z-index:7;border-color:#b8a8ff}
.vs-pick{display:flex;gap:10px;align-items:flex-start;width:100%;text-align:left;background:var(--c-panel);border:2px solid var(--rc,var(--c-line));border-radius:10px;padding:8px 10px;margin-bottom:7px;color:inherit;font:inherit;cursor:pointer}
.vs-pick:hover{background:#1c2644}
.vs-pick .ic{font-size:26px;width:32px;text-align:center}
.vs-pick .tx{display:flex;flex-direction:column;gap:2px;min-width:0}
.vs-pick i{font-style:normal;font-size:11px;color:var(--rc)}
.vs-pick small{font-size:12px;color:var(--c-soft)}
.vs-pick small.pv{color:var(--c-good)}

/* the game menu (Esc / Start): the page list on the left, the page on the right, over the paused game */
.vs-panel.vs-menu{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(1060px,calc(100vw - 24px));height:min(720px,calc(100vh - 24px));display:grid;grid-template-columns:186px minmax(0,1fr);gap:14px;padding:12px;z-index:20}
.vs-menu>.vs-x{position:absolute;right:10px;top:10px;z-index:3}
.vs-mnav{display:flex;flex-direction:column;gap:4px;min-height:0;overflow:auto;padding-right:10px;border-right:1px solid var(--c-line)}
.vs-mtitle{font-family:var(--font-display);font-size:18px;font-weight:700;color:#f3e6c4;display:flex;align-items:center;gap:8px;margin:2px 0 8px}
.vs-btn.vs-mp{justify-content:flex-start;width:100%;flex:none;font-size:14px;padding:8px 10px}
.vs-btn.vs-mp .ml{flex:1;text-align:left}
.vs-btn.vs-mp kbd{font:inherit;font-size:10px;color:var(--c-muted);border:1px solid var(--c-line-2);border-radius:4px;padding:0 5px}
.vs-btn.vs-mp.on{border-color:var(--c-gold-deep);background:linear-gradient(rgba(74,58,22,.65),rgba(32,26,12,.65));color:#fff3cf}
.vs-btn.vs-mp.warn{border-color:var(--c-bad);color:var(--c-bad)}
.vs-badge{font-style:normal;font-size:11px;font-weight:800;background:var(--c-gold);color:#241a00;border-radius:999px;padding:0 6px}
.vs-mhint{margin-top:auto;font-size:11px;color:var(--c-muted);padding-top:8px}
.vs-mbody{min-width:0;min-height:0;overflow:auto;padding:2px 4px 0 0}
.vs-menu .vs-page{position:static;left:auto;top:auto;right:auto;bottom:auto;transform:none;width:auto;max-height:none;overflow:visible;z-index:auto;animation:none}
.vs-menu .vs-page>h2{margin:0 76px 6px 0;flex-wrap:wrap}
.vs-menu .vs-hintbar{bottom:0;margin:10px 0 0;border-radius:10px}
.vs-menu .vs-cards{width:auto;max-height:none;overflow:visible;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin:6px 0}
.vs-menu .vs-card{margin:0}
.vs-note{font-size:12px;color:var(--c-soft);background:rgba(60,48,20,.35);border:1px solid #6a5420;border-radius:8px;padding:6px 8px;margin:6px 0;display:flex;gap:6px;align-items:center}
.vs-savep .vs-acts .vs-btn.big{font-size:15px;padding:10px 16px}
/* the Party page: who the hero is, every stat with the party's auras, and every passive */
.vs-phead{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px;border:2px solid var(--hc);border-radius:12px;background:var(--c-panel);margin:6px 0 4px}
.vs-phead .pi{font-size:46px;text-align:center;color:var(--hc)}
.vs-phead .nm{font-family:var(--font-display);font-size:20px;font-weight:700;color:#f3e6c4}
.vs-phead .lv{font-size:12px;color:var(--c-muted);margin-bottom:4px}
.vs-phead .acts{display:flex;flex-direction:column;gap:6px}
.vs-pbar{position:relative;height:15px;border-radius:7px;background:rgba(8,12,24,.8);border:1px solid var(--c-line-2);overflow:hidden;margin-top:3px;max-width:420px}
.vs-pbar>i{position:absolute;inset:0 auto 0 0}
.vs-pbar.xp>i{background:linear-gradient(#ffe27a,#c99a1e)}
.vs-pbar.hp>i{background:linear-gradient(#ff7a8a,#b8323f)}
.vs-pbar.mp>i{background:linear-gradient(#6ab8ff,#2f77d6)}
.vs-pbar>b{position:absolute;inset:0;text-align:center;font-size:10.5px;line-height:13px;text-shadow:0 1px 2px #000}
.vs-pcols{display:grid;grid-template-columns:minmax(250px,.9fr) minmax(0,1.2fr);gap:16px}
@media(max-width:780px){.vs-pcols{grid-template-columns:1fr}}
.vs-stats{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}
.vs-stats th{text-align:right;color:var(--c-dim);font-size:10px;letter-spacing:1px;padding:3px 6px;border-bottom:1px solid var(--c-line)}
.vs-stats th:first-child,.vs-stats td:first-child{text-align:left}
.vs-stats td{text-align:right;padding:3px 6px;border-bottom:1px solid rgba(46,58,98,.5)}
.vs-stats td.au{color:var(--c-good)}
.vs-stats tr.grp td{color:var(--c-dim);font-size:10px;letter-spacing:1px;text-transform:uppercase;padding-top:9px;border-bottom:0}
.vs-pspells{display:flex;flex-wrap:wrap;gap:6px}
.vs-pspell{display:inline-flex;align-items:center;gap:5px;background:var(--c-panel);border:1px solid var(--c-line-2);border-radius:8px;padding:3px 8px;font-size:12px}
.vs-pspell small{color:var(--c-muted)}
.vs-passives{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:2px 16px}
.vs-ppath .vs-sec{color:var(--pc);display:flex;align-items:center;gap:6px}
.vs-ppath .vs-sec small{margin-left:auto;color:var(--c-muted);font-weight:600;letter-spacing:0}
.vs-sec small{font-weight:600;letter-spacing:0;color:var(--c-muted)}
.vs-pcard{display:grid;grid-template-columns:22px 86px auto minmax(0,1fr);align-items:center;gap:6px;font-size:12px;padding:2px 0}
.vs-pcard .ic{font-size:18px;text-align:center}
.vs-pcard.none{opacity:.5}
.vs-pcard .pips{display:inline-flex;gap:2px}
.vs-pcard .pips i{width:6px;height:11px;border-radius:2px;background:#2a3150;border:1px solid var(--c-line-2)}
.vs-pcard .pips i.on{background:var(--pc);border-color:var(--pc)}
.vs-pcard .pips b{color:var(--c-gold);font-size:12px}
.vs-pcard.max .nm{color:var(--c-gold)}
.vs-pcard .v{color:var(--c-soft);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* left HUD column: sits under the canvas health panel and spell slots (ui.ts sets --hud-top) */
.vs-left{position:absolute;left:12px;top:var(--hud-top,190px);display:flex;flex-direction:column;align-items:flex-start;gap:8px;max-height:calc((100vh - var(--hud-top,190px) - 12px) / var(--hs,1));transform:scale(var(--hs,1));transform-origin:top left}

/* small screens: phones and small windows */
@media (max-width:899px),(max-height:599px){
  html.vs-modal #ui-root .vs-hud{display:none}
  .vs-panel.vs-menu{width:calc(100vw - 8px);height:calc(100vh - 8px);grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto minmax(0,1fr);gap:8px;padding:8px}
  .vs-menu>.vs-x{position:static;grid-column:2;grid-row:1;align-self:start}
  .vs-mnav{grid-column:1;grid-row:1;flex-direction:row;overflow-x:auto;overflow-y:hidden;border-right:0;border-bottom:1px solid var(--c-line);padding:0 0 6px}
  .vs-mbody{grid-column:1 / -1;grid-row:2}
  .vs-menu .vs-page>h2{margin-right:0}
  .vs-mtitle,.vs-mhint{display:none}
  .vs-btn.vs-mp{width:auto;padding:6px 8px;font-size:12px}
  .vs-btn.vs-mp kbd{display:none}
  .vs-panel{padding:10px;border-radius:12px}
  .vs-load,.vs-build,.vs-tpanel,.vs-shop,.vs-journal,.vs-board,.vs-pause,.vs-heal,.vs-inn,.vs-slots,.vs-credits{width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto}
  .vs-dialog{bottom:8px;max-height:calc(100vh - 16px);overflow:auto}
  .vs-cards{top:8px;bottom:auto;right:8px;max-height:calc(100vh - 16px)}
  .vs-load .sub{display:none}
  .vs-hintbar{bottom:-10px;margin:8px -10px -10px;padding:6px 10px}
  .vs-hint-mouse{display:none}
  .vs-pillbar{top:46px}
  .vs-pill{animation:vs-glow 1.3s infinite;font-size:12px;padding:5px 11px}
  .vs-pill .long{display:none}
  .vs-tracker{width:200px;padding:4px 8px;font-size:11px}
  .vs-tracker .t{font-size:12px}
  .vs-party{flex-direction:row;width:auto;gap:5px}
  .vs-hero{display:flex;flex-direction:column;align-items:stretch;gap:2px;width:50px;padding:3px 4px}
  .vs-hero .pi{font-size:20px;line-height:24px}
  .vs-hero .pi .lv{display:block;position:absolute;right:-2px;bottom:-2px;font-style:normal;font-size:9px;font-weight:700;background:var(--c-panel-2);border-radius:6px;padding:0 3px;line-height:12px}
  .vs-hero .nm,.vs-hero .kb{display:none}
  .vs-hero .pend{top:1px;right:1px;bottom:auto;font-size:9px;padding:0 3px}
  .vs-bar{right:10px;bottom:10px;gap:6px}
  .vs-skill{width:48px;height:48px;font-size:23px;border-radius:10px}
  .vs-mana{width:160px;height:14px}
  .vs-mana>b{font-size:10px;line-height:10px}
  .vs-btn.vs-ico{font-size:16px;padding:4px 7px;min-width:34px}
  .vs-wallet{font-size:12px;gap:8px}
  .vs-surface{max-width:200px;font-size:11px}
}
/* narrow (portrait): centred banners go below the minimap */
@media (max-width:599px){
  .vs-hold,.vs-buildhud,.vs-sailing{top:300px}
}
/* short (landscape phone): centred banners fit between the health panel and the minimap */
@media (max-height:599px) and (min-width:600px){
  .vs-hold,.vs-buildhud,.vs-sailing{top:26px;width:min(340px,calc(100vw - 500px));white-space:normal}
}
@keyframes vs-glow{50%{box-shadow:0 0 16px var(--c-gold)}}
html.vs-reduced #ui-root *{animation:none!important;transition:none!important}
html.vs-reduced #ui-root .vs-card:hover,html.vs-reduced #ui-root .vs-card:focus{transform:none!important}
`;

/** Text sizes under 20px follow the player's text-size setting (--ts); icons and big numbers keep their size. */
export const scaledCss = (css: string) => css.replace(/font-size:(\d+(?:\.\d+)?)px/g, (m, n) => (Number(n) < 20 ? `font-size:calc(${n}px * var(--ts, 1))` : m));
