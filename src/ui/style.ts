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
.vs-skill.empty{opacity:.35;cursor:default;font-size:12px}
.vs-skill.poor{border-color:#a04848;filter:saturate(.4)}
.vs-skill .cd{position:absolute;inset:0;background:rgba(0,0,0,.62);transform-origin:bottom;pointer-events:none}
.vs-skill .k{position:absolute;left:4px;top:2px;font-size:11px;font-weight:700;color:#cdd7f5;text-shadow:0 1px 2px #000}
.vs-skill .c{position:absolute;right:4px;bottom:2px;font-size:11px;font-weight:700;color:#8fc8ff;text-shadow:0 1px 2px #000}
.vs-btns{display:flex;gap:8px}
.vs-btn{pointer-events:auto;background:rgba(10,14,26,.82);border:2px solid #4c5b86;color:#dfe6ff;border-radius:10px;padding:6px 10px;font:inherit;font-size:13px;cursor:pointer}
.vs-btn:hover{border-color:#8fb0ff}
.vs-pill{position:absolute;top:70px;left:50%;transform:translateX(-50%);padding:7px 16px;border-radius:20px;background:linear-gradient(#ffd84a,#e8a317);color:#2a1a00;font-weight:700;font-size:14px;border:0;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.5);animation:vs-pulse 1.3s infinite}
@keyframes vs-pulse{50%{transform:translateX(-50%) scale(1.07)}}
.vs-panel{position:absolute;background:rgba(12,16,30,.94);border:2px solid #3a4a78;border-radius:14px;padding:14px;box-shadow:0 6px 28px rgba(0,0,0,.6)}
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
.vs-rune.sel{border-color:#ffd84a}
.vs-rune.bad{opacity:.35;cursor:not-allowed}
.vs-tip{min-height:38px;font-size:12.5px;color:#c9d1e6;margin-top:6px}
.vs-lock{background:#3a2222;border:1px solid #a04848;border-radius:8px;padding:6px 10px;font-size:12px;margin-bottom:8px}

.vs-x{position:absolute;right:10px;top:8px}
.vs-party{position:absolute;left:12px;top:214px;display:flex;flex-direction:column;gap:6px;width:178px}
@media(max-width:700px){.vs-party{top:auto;bottom:150px;width:150px}}
.vs-hero{position:relative;display:grid;grid-template-columns:34px 1fr;gap:6px;align-items:center;padding:5px 7px;border-radius:10px;background:rgba(10,14,26,.8);border:2px solid #34426c;color:inherit;font:inherit;cursor:pointer;text-align:left;overflow:hidden}
.vs-hero.act{border-color:var(--hc);box-shadow:0 0 12px var(--hc)}
.vs-hero.dead{filter:grayscale(1);opacity:.55;cursor:not-allowed}
.vs-hero .pi{font-size:24px;text-align:center}
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

`;
