export const CSS = `
#ui-root{position:fixed;inset:0;pointer-events:none;font-family:'Trebuchet MS',Verdana,Arial,sans-serif;color:#e9eefc;z-index:10;user-select:none;-webkit-user-select:none}
#ui-root *{box-sizing:border-box}
#ui-root .hit{pointer-events:auto}
.vs-bar{position:absolute;right:16px;bottom:16px;display:flex;flex-direction:column;align-items:flex-end;gap:8px}
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
.vs-btn{pointer-events:auto;background:rgba(10,14,26,.82);border:2px solid #4c5b86;color:#dfe6ff;border-radius:10px;padding:6px 10px;font:inherit;font-size:13px;cursor:pointer}
.vs-btn:hover{border-color:#8fb0ff}
.vs-btn.vs-ico{font-size:18px;line-height:1;padding:6px 8px;min-width:38px}
.vs-pill{position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:2;padding:7px 16px;border-radius:20px;background:linear-gradient(#ffd84a,#e8a317);color:#2a1a00;font-weight:700;font-size:14px;border:0;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.5);animation:vs-pulse 1.3s infinite}
@keyframes vs-pulse{50%{transform:translateX(-50%) scale(1.07)}}
.vs-panel{position:absolute;z-index:5;background:rgba(12,16,30,.94);border:2px solid #3a4a78;border-radius:14px;padding:14px;box-shadow:0 6px 28px rgba(0,0,0,.6)}
.vs-panel h2{margin:0 0 4px;font-size:18px}
.vs-panel .sub{font-size:12px;color:#9aa6c8;margin-bottom:10px}
.vs-cards{right:16px;bottom:150px;width:min(320px,calc(100vw - 32px));max-height:calc(100vh - 290px);overflow:auto}
.vs-card{display:flex;gap:10px;width:100%;text-align:left;background:#151c33;border:2px solid var(--rc,#666);border-radius:12px;padding:10px;margin-bottom:8px;color:inherit;font:inherit;cursor:pointer}
.vs-card:hover,.vs-card:focus-visible{background:#1c2644;outline:0;transform:translateX(-3px)}
.vs-card .ic{font-size:32px;width:46px;text-align:center}
.vs-card .tg{font-size:10px;font-weight:700;letter-spacing:1px;color:var(--rc)}
.vs-card .nm{font-size:17px;font-weight:700}
.vs-card .ln{font-size:12.5px;color:#c9d1e6}
.vs-card .kb{margin-left:auto;font-size:11px;color:#77809a;align-self:flex-start}
.vs-check{font-size:12px;color:#9aa6c8;display:flex;gap:6px;align-items:center;margin-top:4px;cursor:pointer}
.vs-load{left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto}
.vs-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:640px){.vs-cols{grid-template-columns:1fr}}
.vs-sec{font-size:11px;letter-spacing:1px;color:#8e97b0;font-weight:700;margin:8px 0 6px}
.vs-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:#151c33;border:2px solid #2e3a62;border-radius:10px;padding:6px 8px;margin-bottom:6px;color:inherit;font:inherit;cursor:pointer}
.vs-item.sel{border-color:#ffd84a;background:#1d2646}
.vs-item.eq{box-shadow:inset 3px 0 0 #6ab8ff}
.vs-item .ic{font-size:24px;width:30px;text-align:center}
.vs-item small{display:block;color:#9aa6c8;font-size:11px}
.vs-socks{display:flex;gap:8px;margin:8px 0}
.vs-sock{width:54px;height:54px;border-radius:50%;border:2px dashed #5a6aa0;background:#0e1426;display:grid;place-items:center;font-size:24px;cursor:pointer;color:inherit;font-family:inherit;padding:0}
.vs-sock.full{border-style:solid;border-color:#b8a8ff}
.vs-sock.drop{border-color:#7be07b;box-shadow:0 0 10px #7be07b88}
.vs-rune{display:inline-flex;flex-direction:column;align-items:center;gap:2px;width:68px;margin:0 6px 6px 0;padding:6px 2px;background:#151c33;border:2px solid #2e3a62;border-radius:10px;font-size:11px;color:inherit;font-family:inherit;cursor:pointer;text-align:center}
.vs-rune .ic{font-size:22px}
.vs-rune{position:relative}
.vs-rl{position:absolute;right:4px;top:2px;font-style:normal;font-weight:700;font-size:9px}
.vs-rune.sel{border-color:#ffd84a}
.vs-rune.bad{opacity:.35;cursor:not-allowed}
.vs-tip{min-height:38px;font-size:12.5px;color:#c9d1e6;margin-top:6px}
.vs-lock{background:#3a2222;border:1px solid #a04848;border-radius:8px;padding:6px 10px;font-size:12px;margin-bottom:8px}

.vs-x{position:absolute;right:10px;top:8px}
.vs-build{left:50%;top:50%;transform:translate(-50%,-50%);width:min(600px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto}
.vs-good .cost{font-weight:700;color:#ff9a8a}
.vs-good .cost .ok{color:#9be09b}
.vs-tpanel{left:50%;top:50%;transform:translate(-50%,-50%);width:min(520px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto}
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
.vs-good{display:grid;grid-template-columns:38px 1fr auto;gap:10px;align-items:center;padding:7px 9px;border:2px solid var(--gc);border-radius:10px;background:#151c33}
.vs-good.sold{opacity:.4}
.vs-good .ic{font-size:26px;text-align:center}
.vs-good .tx{display:flex;flex-direction:column;gap:1px;min-width:0}
.vs-good small{font-size:11.5px;color:#9aa6c8;line-height:1.25}
.vs-inn{left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,calc(100vw - 24px))}
.vs-hrow-mini{display:flex;flex-direction:column;gap:4px;margin:8px 0 12px;font-size:13px}
.vs-hrow-mini .dead{color:#ff9a9a}
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
.vs-party{display:flex;flex-direction:column;gap:6px;width:178px}
.vs-hero{position:relative;display:grid;grid-template-columns:34px 1fr;gap:6px;align-items:center;padding:5px 7px;border-radius:10px;background:rgba(10,14,26,.8);border:2px solid #34426c;color:inherit;font:inherit;cursor:pointer;text-align:left;overflow:hidden}
.vs-hero.act{border-color:var(--hc);box-shadow:0 0 12px var(--hc)}
.vs-hero.dead{filter:grayscale(1);opacity:.55;cursor:not-allowed}
.vs-hero .pi{font-size:24px;text-align:center;position:relative}
.vs-hero .pi .lv{display:none}
.vs-hero .nm{font-size:12px;font-weight:700;display:flex;justify-content:space-between;gap:4px}
.vs-hero .nm i{font-style:normal;color:#9aa6c8;font-weight:400}
.vs-hero .b{display:block;height:6px;border-radius:3px;background:#0a0f1c;margin-top:3px;overflow:hidden}
.vs-hero .b>u{display:block;height:100%;text-decoration:none}
.vs-hero .hp{background:linear-gradient(#ff7a8a,#d6334f)}
.vs-hero .mp{background:linear-gradient(#6ab8ff,#2f77d6);height:4px}
.vs-hero .kb{position:absolute;right:5px;top:2px;font-size:10px;color:#77809a}
.vs-hero .pend{position:absolute;right:5px;bottom:3px;font-size:10px;font-weight:700;background:#ffd84a;color:#2a1a00;border-radius:8px;padding:0 5px}
.vs-hero .cdv{position:absolute;inset:0;background:rgba(0,0,0,.5);pointer-events:none;transform-origin:left}
.vs-heal{left:50%;top:50%;transform:translate(-50%,-50%);width:min(460px,calc(100vw - 24px))}
.vs-hrow{display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;padding:8px;border:2px solid #2e3a62;border-radius:10px;margin-bottom:8px;background:#151c33}
.vs-hrow .pi{font-size:26px;text-align:center}
.vs-hrow .st{font-size:12px;color:#9aa6c8}
.vs-hrow .st.dead{color:#ff9a9a}
.vs-btn:disabled{opacity:.4;cursor:not-allowed}
.vs-tag{font-size:10px;background:#34426c;border-radius:6px;padding:1px 5px;margin-left:4px;color:#cdd7f5}
.vs-wallet{display:flex;gap:10px;font-size:13px;font-weight:700;background:rgba(8,12,24,.7);border-radius:8px;padding:3px 9px;text-shadow:0 1px 2px #000}
.vs-tools{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px;font-size:12px;color:#9aa6c8}
.vs-in{background:#0e1426;color:#e9eefc;border:1px solid #3a4a78;border-radius:6px;padding:4px 6px;font:inherit;font-size:12px}
.vs-zone{border:2px dashed transparent;border-radius:10px;padding:3px;min-height:34px;transition:border-color .1s,background .1s}
.vs-zone.can,.vs-azone.can{border-color:#4fae6a;background:rgba(79,174,106,.08)}
.vs-zone.cant,.vs-azone.cant{border-color:#a04848;background:rgba(160,72,72,.07)}
.vs-zone.over.can,.vs-azone.over.can,.vs-sock.over.can{background:rgba(79,174,106,.25)}
.vs-zone.over.cant,.vs-azone.over.cant,.vs-sock.over.cant{background:rgba(160,72,72,.25)}
.vs-sock.can{border-color:#4fae6a}.vs-sock.cant{border-color:#a04848;opacity:.6}
.vs-azone{display:flex;align-items:center;gap:6px;border:2px dashed transparent;border-radius:10px;padding:3px;margin-bottom:4px}
.vs-azone .vs-item{margin:0;flex:1;min-width:0}
.vs-key{width:44px;text-align:center;font-size:11px;font-weight:700;color:#cdd7f5;background:#1d2646;border-radius:6px;padding:4px 0}
.vs-empty{color:#6c7798;font-size:12px;padding:6px 8px}
.vs-lockb{background:none;border:0;cursor:pointer;font-size:14px;padding:2px;color:inherit}
.vs-ghost{position:fixed;transform:translate(-50%,-120%);pointer-events:none;background:#243266;border:2px solid #ffd84a;border-radius:10px;padding:6px 10px;font-size:14px;font-weight:700;z-index:50;box-shadow:0 6px 18px rgba(0,0,0,.6)}
.vs-runes{min-height:56px}
.vs-fit{margin-left:10px;font-weight:400;letter-spacing:0;color:#9aa6c8}
.vs-salv{margin-top:10px;text-align:center;color:#9aa6c8;font-size:13px;padding:10px;border-color:#3a4a78}
.vs-small{font-size:11px}
.vs-foot{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:10px;font-size:13px;font-weight:700}
.vs-foot label{font-weight:400;font-size:12px;color:#9aa6c8;margin-left:auto}
.vs-item:focus-visible,.vs-rune:focus-visible{outline:2px solid #ffd84a}
.vs-item,.vs-rune{user-select:none;cursor:grab}


/* focus follows the device: a bright ring for keyboard and controller, none for mouse and touch */
#ui-root button:focus,#ui-root [tabindex]:focus,#ui-root select:focus,#ui-root input:focus{outline:none}
html[data-input="key"] #ui-root :focus,html[data-input="pad"] #ui-root :focus{outline:3px solid #ffd84a;outline-offset:2px;box-shadow:0 0 14px rgba(255,216,74,.65)}
html[data-input="key"] #ui-root :focus:not(.vs-x):not(.vs-tracker),html[data-input="pad"] #ui-root :focus:not(.vs-x):not(.vs-tracker){position:relative;z-index:1}
html[data-input="key"] #ui-root .vs-card:focus,html[data-input="pad"] #ui-root .vs-card:focus{background:#1c2644;transform:translateX(-3px)}
html[data-input="pad"] #ui-root input[type=range]:focus{outline-offset:6px}
.vs-pause{left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;z-index:20}
.vs-pause .vs-btn{display:block;margin:4px 0;width:100%;text-align:left}
.vs-pause .vs-btn.vs-x{width:auto;margin:0}
.vs-pause .vs-btn.big{font-size:16px;text-align:center;padding:10px;border-color:#6aa8ff;background:rgba(40,70,140,.55)}
.vs-row{display:flex;align-items:center;gap:12px;margin:8px 0;font-size:13px}
.vs-row>span{flex:0 0 140px;color:#c9d1e6}
.vs-row input[type=range]{flex:1;min-width:0;accent-color:#ffd84a;height:22px}
.vs-row .v{flex:0 0 60px;text-align:right;color:#ffd84a}
.vs-keys{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
.vs-keys th{text-align:left;color:#8e97b0;font-size:10px;letter-spacing:1px;padding:4px 6px;border-bottom:1px solid #2e3a62}
.vs-keys td{padding:4px 6px;border-bottom:1px solid #1b2340;color:#dfe6ff}
.vs-keys td:first-child{color:#c9d1e6}
.vs-acts{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.vs-acts .vs-btn{font-size:12px;padding:6px 9px}
.vs-hint-pad{display:none}
html[data-input="pad"] .vs-hint-pad{display:inline}
html[data-input="pad"] .vs-hint-key{display:none}

.vs-journal{left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto}
.vs-board{left:50%;top:50%;transform:translate(-50%,-50%);width:min(640px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto}
.vs-quest{background:#131a30;border:2px solid #2e3a62;border-radius:12px;padding:9px 11px;margin:6px 0}
.vs-quest.tracked{border-color:#5a8aff}
.vs-quest.ready{border-color:#7be07b}
.vs-quest .hd{display:flex;gap:8px;align-items:center;font-size:15px}
.vs-quest .sub{margin:3px 0 6px}
.vs-quest .rw{font-size:12px;color:#ffe9a8;margin-top:4px}
.vs-tag.ok{background:#2c5a34;color:#bff0c4}
.vs-obj{list-style:none;margin:4px 0;padding:0;font-size:13px}
.vs-obj li{display:flex;gap:8px;padding:2px 0;color:#dfe6ff}
.vs-obj li.done{color:#8e97b0;text-decoration:line-through}
.vs-obj .ck{width:16px}
.vs-obj .tx{flex:1;min-width:0}
.vs-obj .pr{color:#ffd84a;font-weight:700}
.vs-lords{display:flex;flex-direction:column;gap:3px;font-size:13px;margin:4px 0}
.vs-lord{color:#ffb0b0}
.vs-lord.dead{color:#7a8296;text-decoration:line-through}
.vs-lord.sov{color:#e6b8ff}
.vs-tracker{display:block;width:min(250px,calc(100vw - 32px));text-align:left;color:inherit;font:inherit;cursor:pointer;background:rgba(8,12,24,.72);border:1px solid #3a4a78;border-left:3px solid #7ad8ff;border-radius:8px;padding:6px 9px;font-size:12px;line-height:1.35;text-shadow:0 1px 2px #000}
.vs-tracker:hover{border-color:#7ad8ff}
.vs-tracker .more{color:#8e97b0}
.vs-tracker .t{font-weight:700;font-size:13px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vs-tracker .o.done{color:#8e97b0;text-decoration:line-through}
.vs-tracker .r{color:#9be09b;margin-top:2px}
.vs-coach{position:relative;display:flex;gap:8px;align-items:flex-start;width:min(250px,calc(100vw - 32px));background:rgba(20,16,6,.86);border:1px solid #7a6a3a;border-left:3px solid #ffd84a;border-radius:8px;padding:7px 26px 7px 9px;font-size:12px;line-height:1.4;text-shadow:0 1px 2px #000;animation:vs-coach-in .35s ease-out}
.vs-coach .ic{font-size:18px;line-height:1}
.vs-coach .tx{min-width:0}
.vs-howto p{margin:4px 0 8px;font-size:12.5px;line-height:1.45;color:#c9d1e6}
.vs-howto b{color:#ffd84a}
.vs-coach .vs-x{position:absolute;top:3px;right:3px;padding:1px 6px;font-size:11px;min-height:0}
@keyframes vs-coach-in{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:none}}
.vs-choices{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.vs-choices .vs-btn{text-align:left}
.vs-perf{position:absolute;right:56px;top:22px;font:11px/1.2 ui-monospace,Consolas,monospace;color:#bfffcf;background:rgba(0,0,0,.6);padding:3px 7px;border-radius:6px;pointer-events:none;z-index:30}
.vs-rebind{background:rgba(12,16,30,.99);left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;z-index:22}
.vs-binds{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:4px 14px}
.vs-bind{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;color:#c9d1e6}
.vs-bind .vs-btn{min-width:96px;text-align:center}
.vs-bind .vs-btn.wait{border-color:#ffd84a;color:#ffd84a;animation:vs-glow 1s infinite}

/* loadout: hero switcher, button hints, rune picker */
.vs-heroes{display:inline-flex;gap:4px;margin-left:10px;vertical-align:middle}
.vs-btn.vs-hb{padding:2px 6px;font-size:15px;opacity:.55}
.vs-btn.vs-hb.on{opacity:1;border-color:#ffd84a}
.vs-hintbar{position:sticky;bottom:-14px;margin:10px -14px -14px;padding:7px 14px;display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11.5px;color:#aab4cc;background:rgba(8,11,22,.97);border-top:1px solid #2e3a62;border-radius:0 0 12px 12px}
.vs-hintbar kbd{display:inline-block;min-width:18px;text-align:center;font:700 10.5px/1 inherit;color:#ffe9a8;background:#1d2646;border:1px solid #3a4a78;border-bottom-width:2px;border-radius:5px;padding:3px 5px;margin-right:4px}
.vs-hintbar kbd+kbd{margin-left:-1px}
.vs-picker{left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,calc(100vw - 24px));max-height:calc(100vh - 40px);overflow:auto;z-index:7;border-color:#b8a8ff}
.vs-pick{display:flex;gap:10px;align-items:flex-start;width:100%;text-align:left;background:#151c33;border:2px solid var(--rc,#2e3a62);border-radius:10px;padding:8px 10px;margin-bottom:7px;color:inherit;font:inherit;cursor:pointer}
.vs-pick:hover{background:#1c2644}
.vs-pick .ic{font-size:26px;width:32px;text-align:center}
.vs-pick .tx{display:flex;flex-direction:column;gap:2px;min-width:0}
.vs-pick i{font-style:normal;font-size:11px;color:var(--rc)}
.vs-pick small{font-size:12px;color:#c9d1e6}
.vs-pick small.pv{color:#9be09b}

/* left HUD column: sits under the canvas health panel and spell slots (ui.ts sets --hud-top) */
.vs-left{position:absolute;left:12px;top:var(--hud-top,190px);display:flex;flex-direction:column;align-items:flex-start;gap:8px;max-height:calc(100vh - var(--hud-top,190px) - 12px)}

/* small screens: phones and small windows */
@media (max-width:899px),(max-height:599px){
  html.vs-modal #ui-root .vs-hud{display:none}
  .vs-panel{padding:10px;border-radius:12px}
  .vs-load,.vs-build,.vs-tpanel,.vs-shop,.vs-journal,.vs-board,.vs-pause,.vs-heal,.vs-inn{width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto}
  .vs-dialog{bottom:8px;max-height:calc(100vh - 16px);overflow:auto}
  .vs-cards{top:8px;bottom:auto;right:8px;max-height:calc(100vh - 16px)}
  .vs-load .sub{display:none}
  .vs-hintbar{bottom:-10px;margin:8px -10px -10px;padding:6px 10px}
  .vs-hint-mouse{display:none}
  .vs-pill{position:static;transform:none;animation:vs-glow 1.3s infinite;font-size:12px;padding:5px 11px}
  .vs-pill .long{display:none}
  .vs-tracker{width:200px;padding:4px 8px;font-size:11px}
  .vs-tracker .t{font-size:12px}
  .vs-party{flex-direction:row;width:auto;gap:5px}
  .vs-hero{display:flex;flex-direction:column;align-items:stretch;gap:2px;width:50px;padding:3px 4px}
  .vs-hero .pi{font-size:20px;line-height:24px}
  .vs-hero .pi .lv{display:block;position:absolute;right:-2px;bottom:-2px;font-style:normal;font-size:9px;font-weight:700;background:#1d2646;border-radius:6px;padding:0 3px;line-height:12px}
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
@keyframes vs-glow{50%{box-shadow:0 0 16px #ffd84a}}
html.vs-reduced #ui-root *{animation:none!important;transition:none!important}
html.vs-reduced #ui-root .vs-card:hover,html.vs-reduced #ui-root .vs-card:focus{transform:none!important}
`;

/** Text sizes under 20px follow the player's text-size setting (--ts); icons and big numbers keep their size. */
export const scaledCss = (css: string) => css.replace(/font-size:(\d+(?:\.\d+)?)px/g, (m, n) => (Number(n) < 20 ? `font-size:calc(${n}px * var(--ts, 1))` : m));
