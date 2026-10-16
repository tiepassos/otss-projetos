/*!
 * Projetos OTSS — <otss-projetos>
 * Web Component que lê o CMS do site OTSS (Wix) em tempo real.
 * Coleções: ProjetosPagina (+ BibliotecaTemas, BibliotecaAcervo, BibliotecaMidia para os relacionados).
 * Uso no Wix Studio: Elemento personalizado → URL do servidor → tag "otss-projetos".
 */
(() => {
  const DEFAULTS = {
    clientId: "cbb20194-95fa-4ccf-a02b-fce35da284af",
    siteId: "eef6fc1a-2e9b-47d7-b175-68ea9b7828ab",
    videoHero: "8d49b9_4daae7d2cc3d4ca3b0b224a5528dd2b5",
    bibliotecaUrl: "https://tiepassos.github.io/otss-biblioteca/",
  };
  const API = "https://www.wixapis.com";
  const TOKEN_KEY = "otss-projetos-token";
  const BOTANICOS = {
    rama: "https://static.wixstatic.com/shapes/8d49b9_2ce49263bf9f4c859ae1fafdc1d52bbe.svg",
    capim: "https://static.wixstatic.com/shapes/8d49b9_958ce953bdd44f2788baf4efe3a09649.svg",
  };

  /* ---------- utilidades ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const safeStore = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } },
  };
  function wixImage(uri, w = 1600, h = 0) {
    if (!uri) return "";
    if (/^https?:/.test(uri)) return uri;
    const m = String(uri).match(/^wix:image:\/\/v1\/([^/]+)\/([^#]*)/);
    if (!m) return "";
    const name = encodeURIComponent(decodeURIComponent(m[2] || "img.jpg")).replace(/%2F/g, "");
    return h ? `https://static.wixstatic.com/media/${m[1]}/v1/fill/w_${w},h_${h},al_c,q_82,enc_auto/${name}`
      : `https://static.wixstatic.com/media/${m[1]}/v1/fit/w_${w},h_${w * 2},q_82,enc_auto/${name}`;
  }
  const imgRatio = (uri) => { const w = +(String(uri).match(/originWidth=(\d+)/) || [])[1], h = +(String(uri).match(/originHeight=(\d+)/) || [])[1]; return w && h ? w / h : 1.5; };
  function wixVideo(uri) {
    const id = (String(uri || "").match(/^wix:video:\/\/v1\/([^/]+)/) || [])[1] || (/^[a-z0-9]+_[a-f0-9]{32}$/.test(uri) ? uri : "");
    return id ? { src: `https://video.wixstatic.com/video/${id}/1080p/mp4/file.mp4`, poster: `https://static.wixstatic.com/media/${id}f000.jpg` } : null;
  }
  // texto escuro ou claro sobre a cor do projeto
  function contraste(hex) {
    const m = String(hex || "").replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return "claro";
    const [r, g, b] = m.slice(1).map((x) => { const c = parseInt(x, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? "escuro" : "claro";
  }
  const parseNumero = (s) => { const [v, ...r] = String(s).split("|"); return { valor: (v || "").trim(), rotulo: r.join("|").trim() }; };

  /* ---------- cliente Wix (token anônimo) ---------- */
  class WixClient {
    constructor(clientId) { this.clientId = clientId; this.tok = null; }
    async token() {
      const now = Date.now();
      if (this.tok && this.tok.exp > now) return this.tok.access;
      const saved = safeStore.get(TOKEN_KEY);
      if (saved && saved.clientId === this.clientId && saved.exp > now + 60000) { this.tok = saved; return saved.access; }
      const post = (body) => fetch(`${API}/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      let r = saved && saved.refresh && saved.clientId === this.clientId ? await post({ clientId: this.clientId, grantType: "refresh_token", refreshToken: saved.refresh }) : null;
      if (!r || !r.ok) r = await post({ clientId: this.clientId, grantType: "anonymous" });
      if (!r.ok) throw new Error("Falha ao autenticar com o CMS");
      const j = await r.json();
      this.tok = { clientId: this.clientId, access: j.access_token, refresh: j.refresh_token, exp: now + (j.expires_in - 120) * 1000 };
      safeStore.set(TOKEN_KEY, this.tok);
      return this.tok.access;
    }
    async query(collection, query = {}, refs = []) {
      const r = await fetch(API + "/wix-data/v2/items/query", { method: "POST", headers: { "Content-Type": "application/json", Authorization: await this.token() }, body: JSON.stringify({ dataCollectionId: collection, query: { paging: { limit: 1000 }, ...query }, includeReferencedItems: refs }) });
      if (!r.ok) throw new Error(`Erro ${r.status} em ${collection}`);
      return ((await r.json()).dataItems || []).map((i) => i.data);
    }
  }

  /* ---------- estilos ---------- */
  const CSS = String.raw`
:host{
  --ink:#16283b;--ink-2:#3b4d61;--ink-3:#66778a;--paper:#fbf7ec;--paper-2:#f3ecd8;--card:#fffdf7;--line:#e4dcc6;
  --noite:#0b1a2b;--noite-2:#132b45;--azul:#276cb2;--sol:#f2b705;
  --ease:cubic-bezier(.2,.8,.2,1);--ease-out:cubic-bezier(.16,1,.3,1);--ease-io:cubic-bezier(.65,0,.35,1);
  --f-900:var(--f-900-custom,"OTSS Museo 900"),"OTSS Museo 900","Museo 900","Museo900","museo-w01-900","Bitter",Georgia,serif;
  --f-500:"OTSS Museo 500","wfont_6f9e71_807cc1ad0a5347b68f3464a7d59f4bbb","wf_807cc1ad0a5347b68f3464a7d","orig_museo_500","Museo 500","Bitter",Georgia,serif;
  --f-body:"Nunito Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
  --sticky-top:0px;
  display:block;position:relative;color:var(--ink);background:var(--paper);font-family:var(--f-body);font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased;container-type:inline-size;overflow-x:clip;
}
*,*::before,*::after{box-sizing:border-box}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
a{color:inherit}
img{display:block;max-width:100%}
:focus-visible{outline:3px solid var(--sol);outline-offset:3px;border-radius:6px}
.wrap{max-width:1280px;margin:0 auto;padding-left:clamp(18px,4vw,48px);padding-right:clamp(18px,4vw,48px)}
.t900{font-family:var(--f-900);font-weight:900;font-synthesis:none;letter-spacing:-.02em;line-height:.95}
.t500{font-family:var(--f-500);font-weight:500;font-synthesis:none}
.eyebrow{display:inline-flex;align-items:center;gap:12px;font-family:var(--f-500);font-size:13px;letter-spacing:.18em;text-transform:uppercase}
.eyebrow::before{content:"";width:34px;height:2px;background:currentColor;opacity:.8}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
[hidden]{display:none!important}

/* revelação ao rolar */
.rv{opacity:0;transform:translateY(40px);transition:opacity 1s var(--ease-out),transform 1.1s var(--ease-out);transition-delay:var(--d,0s)}
.rv.in{opacity:1;transform:none}
.rv-mask{clip-path:inset(0 0 100% 0);transition:clip-path 1.3s var(--ease-io);transition-delay:var(--d,0s)}
.rv-mask.in{clip-path:inset(0 0 0 0)}
.words .w{display:inline-block;overflow:hidden;vertical-align:bottom;padding-bottom:.08em;margin-bottom:-.08em}
.words .w>span{display:inline-block;transform:translateY(105%);transition:transform 1.1s var(--ease-out);transition-delay:calc(var(--i) * 70ms + var(--d,0s))}
.words.in .w>span{transform:none}
[data-speed]{will-change:transform}

/* ===== HERO ===== */
.hero{position:relative;min-height:max(100svh,720px);color:#fff;background:var(--noite);overflow:hidden;isolation:isolate;display:flex;flex-direction:column}
.hero .media{position:absolute;inset:-12% 0 -12% 0;z-index:-2}
.hero video,.hero .poster{width:100%;height:100%;object-fit:cover}
.hero .veil{position:absolute;inset:0;z-index:-1;background:radial-gradient(90% 70% at 20% 30%,rgba(11,26,43,.25),rgba(11,26,43,.78) 70%),linear-gradient(180deg,rgba(11,26,43,.15) 40%,rgba(11,26,43,.96))}
.hero .wrap{position:relative;flex:1;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:clamp(24px,5vw,72px);align-items:center;padding-top:clamp(90px,12vh,140px);padding-bottom:clamp(90px,12vh,130px)}
@container (max-width:980px){.hero .wrap{grid-template-columns:1fr}}
.hero .eyebrow{color:#ffe68a}
.hero h1{font-size:clamp(46px,6.4vw,104px);margin:20px 0 20px;max-width:9.5ch}
.hero h1 em{font-style:normal;color:var(--sol)}
.hero .sub{font-size:clamp(18px,1.6vw,23px);line-height:1.4;color:#e3eef7;max-width:34ch;margin:0 0 30px}
.hero .cta-row{display:flex;flex-wrap:wrap;gap:12px}
.btn{display:inline-flex;align-items:center;gap:12px;height:54px;padding:0 26px;border-radius:999px;font-family:var(--f-500);font-size:16px;text-decoration:none;transition:transform .35s var(--ease-out),background .25s,color .25s,box-shadow .35s}
.btn:hover{transform:translateY(-3px)}
.btn.sol{background:var(--sol);color:var(--noite);box-shadow:0 14px 40px -14px rgba(242,183,5,.7)}
.btn.ghost{border:1.5px solid rgba(255,255,255,.45);color:#fff}
.btn.ghost:hover{background:rgba(255,255,255,.1)}
.btn.dark{background:var(--ink);color:#fff}
.btn svg{width:18px;height:18px}
/* mosaico de logos */
.mosaic{position:relative;display:grid;grid-template-columns:repeat(6,1fr);grid-auto-rows:clamp(64px,7.4vw,104px);gap:clamp(8px,1vw,14px)}
.tile{position:relative;border-radius:22px;background:var(--c);display:grid;place-items:center;padding:14px 18px;box-shadow:0 22px 50px -26px rgba(0,0,0,.7);transform:translateY(40px) scale(.92);opacity:0;transition:transform 1.1s var(--ease-out),opacity .9s var(--ease-out),box-shadow .4s;transition-delay:calc(var(--i) * 90ms + .35s)}
.mosaic.in .tile{transform:none;opacity:1}
.tile img{max-height:72%;max-width:86%;object-fit:contain;transition:transform .6s var(--ease-out)}
.tile:hover{box-shadow:0 30px 60px -24px rgba(0,0,0,.85)}
.tile:hover img{transform:scale(1.07)}
.tile .lbl{position:absolute;left:14px;bottom:10px;font-family:var(--f-500);font-size:12px;letter-spacing:.06em;color:var(--tc);opacity:0;transform:translateY(6px);transition:opacity .3s,transform .3s}
.tile:hover .lbl,.tile:focus-visible .lbl{opacity:.85;transform:none}
.mosaic{grid-auto-flow:dense}.tile{grid-column:span 2}.tile.big{grid-row:span 2}a.tile{text-decoration:none}.tile.extra{background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.22);backdrop-filter:blur(6px)}.tile.extra .t500{color:#fff;font-size:16px;display:flex;align-items:center;gap:10px}.tile.extra svg{width:18px;height:18px}
.hero .bot{position:absolute;pointer-events:none;z-index:0;opacity:.9;filter:drop-shadow(0 20px 30px rgba(0,0,0,.45))}
.hero .bot.b1{width:min(420px,40vw);left:-130px;bottom:-60px;transform-origin:50% 100%;rotate:16deg}
.hero .bot.b2{width:min(260px,26vw);right:-60px;top:12%;rotate:-28deg}
.scroll-cue{position:absolute;left:50%;bottom:22px;translate:-50% 0;display:flex;flex-direction:column;align-items:center;gap:8px;font-family:var(--f-500);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#cfe0ee}
.scroll-cue i{width:1.5px;height:46px;background:linear-gradient(#fff,transparent);transform-origin:top;animation:cue 2.2s var(--ease-io) infinite}
@keyframes cue{0%{transform:scaleY(0)}50%{transform:scaleY(1)}100%{transform:scaleY(1);opacity:0}}

/* ===== BARRA (índice + filtros) ===== */
.bar{position:sticky;top:var(--sticky-top);z-index:30;background:rgba(251,247,236,.9);backdrop-filter:blur(14px) saturate(1.3);-webkit-backdrop-filter:blur(14px) saturate(1.3);border-bottom:1px solid var(--line);transition:background .5s}
.bar .wrap{display:flex;align-items:center;gap:14px;min-height:68px}
.idx{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0;padding:10px 0;position:relative}
.idx::-webkit-scrollbar{display:none}
.idx button{flex:none;display:inline-flex;align-items:center;gap:9px;height:40px;padding:0 15px;border-radius:999px;font-family:var(--f-500);font-size:15px;color:var(--ink-2);transition:background .35s,color .35s}
.idx button i{width:10px;height:10px;border-radius:50%;background:var(--c);box-shadow:0 0 0 2px rgba(0,0,0,.06)}
.idx button[aria-current="true"]{background:var(--c);color:var(--tc)}
.idx button[aria-current="true"] i{background:var(--tc)}
.idx button.off{opacity:.35}
.fbtn{flex:none;display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 16px;border-radius:999px;border:1.5px solid var(--line);background:var(--card);font-family:var(--f-500);font-size:14px}
.fbtn[aria-expanded="true"]{background:var(--ink);color:#fff;border-color:var(--ink)}
.fbtn .n{background:var(--sol);color:var(--ink);border-radius:999px;font-size:11px;padding:1px 7px}
.seg{flex:none;display:inline-flex;border:1.5px solid var(--line);border-radius:999px;padding:3px;background:var(--card)}
.seg button{height:34px;padding:0 14px;border-radius:999px;font-family:var(--f-500);font-size:14px;color:var(--ink-3);transition:background .3s,color .3s}
.seg button[aria-pressed="true"]{background:var(--ink);color:#fff}
@container (max-width:760px){.seg button span{display:none}.fbtn span{display:none}}
.fpanel{display:grid;grid-template-rows:0fr;transition:grid-template-rows .5s var(--ease-out)}
.fpanel.open{grid-template-rows:1fr}
.fpanel>div{min-height:0;overflow:hidden}
.fgroups{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;padding:6px 0 20px}
.fgroups h4{margin:0 0 10px;font-family:var(--f-500);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:4px 13px;border-radius:999px;font-size:13.5px;font-weight:700;border:1.5px solid color-mix(in srgb,var(--c,#888) 30%,transparent);background:color-mix(in srgb,var(--c,#888) 10%,#fff);color:color-mix(in srgb,var(--c,#888) 75%,#000);transition:background .25s,color .25s,transform .25s var(--ease)}
.chip:hover{transform:translateY(-1px)}
.chip[aria-pressed="true"]{background:var(--c);color:#fff;border-color:var(--c)}
.active{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding-bottom:12px}
.active:empty{display:none}
.linkbtn{font-size:13px;font-weight:800;text-decoration:underline;text-underline-offset:3px;color:var(--ink-2)}

/* ===== NARRATIVA (capítulos) ===== */
.chapters{position:relative}
.chap{position:relative;color:var(--tc);isolation:isolate}
.chap .bg{position:sticky;top:0;height:100vh;overflow:hidden;z-index:-1}
.chap .bg .ph{position:absolute;inset:-14% -4%;background-size:cover;background-position:center}
.chap .bg .tint{position:absolute;inset:0;background:linear-gradient(100deg,color-mix(in srgb,var(--c) 94%,transparent) 0%,color-mix(in srgb,var(--c) 82%,transparent) 38%,color-mix(in srgb,var(--c) 10%,transparent) 72%,transparent)}
@container (max-width:900px){.chap .bg .tint{background:linear-gradient(180deg,color-mix(in srgb,var(--c) 55%,transparent),color-mix(in srgb,var(--c) 96%,transparent) 60%)}}
.chap .content{position:relative;margin-top:-100vh;min-height:130vh;display:flex;align-items:center}
.chap .panel{position:relative;max-width:620px;padding:22vh 0 26vh}
@container (max-width:900px){.chap .panel{padding-top:38vh}}
.chap .num{font-family:var(--f-900);font-weight:900;font-size:clamp(70px,10vw,150px);line-height:.8;opacity:.18;margin:0 0 -.15em -.04em}
.chap .logo{width:min(240px,48vw);height:96px;border-radius:20px;background:var(--c);display:grid;place-items:center;padding:16px;margin-bottom:22px;box-shadow:0 18px 40px -18px rgba(0,0,0,.45);outline:1.5px solid color-mix(in srgb,var(--tc) 22%,transparent)}
.chap .logo img{width:100%;height:100%;object-fit:contain}
.chap h2{font-size:clamp(40px,6vw,84px);margin:0 0 14px}
.chap .chamada{font-size:clamp(20px,2vw,27px);line-height:1.25;margin:0 0 18px;opacity:.92}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px}
.pill{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:800;background:color-mix(in srgb,var(--tc) 14%,transparent);color:var(--tc)}
.chap p.lead{font-size:clamp(16px,1.25vw,18.5px);line-height:1.62;margin:0 0 26px;max-width:58ch;opacity:.95;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:18px 26px;margin:6px 0 30px}
.stat b{display:block;font-family:var(--f-900);font-weight:900;font-size:clamp(34px,4vw,54px);line-height:1;font-variant-numeric:tabular-nums}
.stat span{display:block;font-family:var(--f-500);font-size:14px;line-height:1.3;margin-top:6px;opacity:.85}
.chap .btn{background:var(--tc);color:var(--c)}
.chap .btn:hover{box-shadow:0 18px 40px -16px rgba(0,0,0,.5)}
.chap.escuro{--tc:#16283b}.chap.claro{--tc:#fff}

/* ===== MOSAICO (grade) ===== */
.grid-view{padding:clamp(40px,6vw,80px) 0}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:22px}
.card{position:relative;display:flex;flex-direction:column;border-radius:26px;overflow:hidden;background:var(--c);color:var(--tc);text-align:left;min-height:440px;isolation:isolate;box-shadow:0 18px 50px -30px rgba(0,0,0,.6);transition:transform .6s var(--ease-out),box-shadow .6s var(--ease-out)}
.card:hover{transform:translateY(-8px);box-shadow:0 34px 70px -34px rgba(0,0,0,.7)}
.card .photo{position:absolute;inset:0;z-index:-2;background-size:cover;background-position:center;opacity:0;transform:scale(1.12);transition:opacity .7s var(--ease),transform 1.4s var(--ease-out)}
.card::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,transparent 20%,color-mix(in srgb,var(--c) 92%,#000) 92%);opacity:0;transition:opacity .7s}
.card:hover .photo,.card:focus-visible .photo{opacity:1;transform:scale(1)}
.card:hover::after,.card:focus-visible::after{opacity:1}
.card .top{flex:1;display:grid;place-items:center;padding:34px}
.card .top img{max-height:120px;max-width:78%;object-fit:contain;transition:transform .8s var(--ease-out)}
.card:hover .top img{transform:translateY(-12px) scale(.92)}
.card .bottom{padding:22px 26px 26px}
.card h3{font-size:clamp(28px,2.4vw,34px);margin:0 0 8px}
.card .chamada{font-size:16px;margin:0;opacity:.88}
.card .go{position:absolute;right:20px;top:20px;width:46px;height:46px;border-radius:50%;background:color-mix(in srgb,var(--tc) 16%,transparent);display:grid;place-items:center;transition:transform .5s var(--ease-out),background .3s}
.card:hover .go{transform:rotate(-45deg);background:color-mix(in srgb,var(--tc) 28%,transparent)}
.card.escuro{--tc:#16283b}.card.claro{--tc:#fff}

/* ===== PÁGINA DO PROJETO ===== */
.page{position:fixed;inset:0;z-index:1000;background:var(--paper);overflow-y:auto;overscroll-behavior:contain;clip-path:circle(0 at var(--ox,50%) var(--oy,50%));visibility:hidden;transition:clip-path .9s var(--ease-io),visibility 0s .9s}
.page.on{clip-path:circle(150% at var(--ox,50%) var(--oy,50%));visibility:visible;transition:clip-path .9s var(--ease-io),visibility 0s}
.page .close{position:fixed;z-index:20;top:18px;right:18px;width:54px;height:54px;border-radius:50%;background:rgba(11,26,43,.75);backdrop-filter:blur(8px);color:#fff;display:grid;place-items:center;transition:transform .4s var(--ease-out),background .3s}
.page .close:hover{transform:rotate(90deg);background:var(--noite)}
.phero{position:relative;min-height:92vh;display:flex;align-items:flex-end;color:var(--tc);overflow:hidden;isolation:isolate;background:var(--c)}
.phero .ph{position:absolute;inset:-10% 0;background-size:cover;background-position:center;z-index:-2}
.phero .tint{position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,transparent 20%,color-mix(in srgb,var(--c) 70%,transparent) 55%,var(--c) 96%)}
.phero .wrap{padding-top:120px;padding-bottom:clamp(40px,7vh,80px);width:100%}
.phero .logo{display:grid;place-items:center;height:118px;width:min(340px,72vw);border-radius:22px;background:var(--c);padding:18px 24px;margin-bottom:26px;box-shadow:0 22px 50px -20px rgba(0,0,0,.5)}
.phero .logo img{width:100%;height:100%;object-fit:contain}
.phero h1{font-size:clamp(46px,8vw,120px);margin:0 0 16px;max-width:16ch}
.phero .chamada{font-size:clamp(20px,2.2vw,30px);margin:0 0 22px;max-width:40ch}
.phero.escuro{--tc:#16283b}.phero.claro{--tc:#fff}
.psec{padding:clamp(56px,9vw,120px) 0;position:relative}
.psec h2{font-size:clamp(34px,4.6vw,64px);margin:0 0 26px}
.psec .kick{font-family:var(--f-500);font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:var(--cc);margin:0 0 14px;display:flex;align-items:center;gap:12px}
.psec .kick::before{content:"";width:34px;height:3px;border-radius:2px;background:var(--cc)}
.two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:clamp(28px,6vw,96px);align-items:start}
@container (max-width:900px){.two{grid-template-columns:1fr}}
.big{font-family:var(--f-500);font-size:clamp(22px,2.4vw,32px);line-height:1.38;margin:0;color:var(--ink)}
.prose p{margin:0 0 1em;color:var(--ink-2);font-size:18px;white-space:pre-line}
.nums{background:var(--c);color:var(--tc)}
.nums.escuro{--tc:#16283b}.nums.claro{--tc:#fff}
.nums .stats{grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:40px 50px}
.nums .stat b{font-size:clamp(46px,6vw,92px)}
.nums .stat span{font-size:17px}
ol.obj{list-style:none;margin:0;padding:0;counter-reset:o;display:grid;gap:4px}
ol.obj li{counter-increment:o;display:grid;grid-template-columns:72px minmax(0,1fr);gap:18px;align-items:baseline;padding:22px 0;border-top:1px solid var(--line);font-size:clamp(17px,1.4vw,20px);line-height:1.5}
ol.obj li::before{content:counter(o,decimal-leading-zero);font-family:var(--f-900);font-weight:900;font-size:34px;color:var(--cc);line-height:1}
ol.obj li b{font-family:var(--f-500);font-weight:500}
.places{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 28px}
.places span{display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 18px;border-radius:999px;background:var(--card);border:1.5px solid var(--line);font-family:var(--f-500);font-size:16px}
.places span::before{content:"";width:9px;height:9px;border-radius:50%;background:var(--cc)}
.mapbox{border-radius:24px;overflow:hidden;box-shadow:0 30px 60px -36px rgba(0,0,0,.5);background:#fff}
.mapbox img{width:100%;height:auto;transform:scale(1.06);transition:transform 1.6s var(--ease-out)}
.mapbox.in img{transform:none}
.marquee{overflow:hidden;mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);padding:10px 0}
.marquee .track{display:flex;gap:14px;width:max-content;animation:mq var(--mqd,40s) linear infinite}
.marquee:hover .track{animation-play-state:paused}
.marquee span{flex:none;height:56px;display:grid;place-items:center;padding:0 26px;border-radius:16px;background:var(--card);border:1.5px solid var(--line);font-family:var(--f-500);font-size:18px;white-space:nowrap}
@keyframes mq{to{transform:translateX(-50%)}}
.gal{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x proximity;padding:4px clamp(18px,4vw,48px) 22px;scrollbar-width:thin}
.gal button{flex:none;scroll-snap-align:center;height:clamp(260px,46vh,460px);aspect-ratio:var(--r,1.5);border-radius:20px;overflow:hidden;position:relative}
.gal img{height:100%;width:100%;object-fit:cover;transition:transform 1s var(--ease-out),filter .5s}
.gal button:hover img{transform:scale(1.05)}
.gal-ctrl{display:flex;gap:10px}
.round{width:52px;height:52px;border-radius:50%;border:1.5px solid var(--line);display:grid;place-items:center;background:var(--card);transition:transform .3s var(--ease-out)}
.round:hover{transform:translateY(-2px)}
.vid{position:relative;border-radius:26px;overflow:hidden;aspect-ratio:16/9;background:#000;box-shadow:0 30px 70px -40px rgba(0,0,0,.6)}
.vid video{width:100%;height:100%;object-fit:cover}
.vid .play{position:absolute;inset:0;display:grid;place-items:center;background:linear-gradient(180deg,transparent,rgba(0,0,0,.35))}
.vid .play i{width:96px;height:96px;border-radius:50%;background:var(--c);color:var(--tc);display:grid;place-items:center;box-shadow:0 20px 50px -14px rgba(0,0,0,.6);transition:transform .45s var(--ease-out)}
.vid .play:hover i{transform:scale(1.1)}
.rel{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:16px}
.rel a{display:flex;flex-direction:column;gap:8px;padding:20px 22px;border-radius:18px;background:var(--card);border:1px solid var(--line);border-left:6px solid var(--k);text-decoration:none;transition:transform .4s var(--ease-out),box-shadow .4s}
.rel a:hover{transform:translateY(-4px);box-shadow:0 20px 40px -26px rgba(0,0,0,.5)}
.rel small{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--k)}
.rel b{font-family:var(--f-500);font-weight:500;font-size:17px;line-height:1.3}
.rel span{font-size:13.5px;color:var(--ink-3)}
.links{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}
.next{display:block;width:100%;text-align:left;background:var(--c);color:var(--tc);padding:clamp(60px,10vw,130px) 0;position:relative;overflow:hidden;isolation:isolate}
.next .ph{position:absolute;inset:-20% 0;background-size:cover;background-position:center;z-index:-2;opacity:.35;transition:opacity .6s,transform 1.4s var(--ease-out)}
.next:hover .ph{opacity:.55;transform:scale(1.04)}
.next small{font-family:var(--f-500);font-size:14px;letter-spacing:.2em;text-transform:uppercase;opacity:.8}
.next strong{display:flex;align-items:center;gap:20px;font-size:clamp(46px,8vw,120px);margin-top:12px}
.next strong svg{width:clamp(36px,5vw,70px);height:auto;transition:transform .6s var(--ease-out)}
.next:hover strong svg{transform:translateX(14px)}
.next.escuro{--tc:#16283b}.next.claro{--tc:#fff}
.lightbox{position:fixed;inset:0;z-index:1100;background:rgba(6,14,24,.94);display:grid;place-items:center;opacity:0;pointer-events:none;transition:opacity .4s}
.lightbox.on{opacity:1;pointer-events:auto}
.lightbox img{max-width:92vw;max-height:84vh;border-radius:12px;box-shadow:0 30px 80px rgba(0,0,0,.6)}
.lightbox .lb-btn{position:absolute;top:50%;translate:0 -50%;width:58px;height:58px;border-radius:50%;background:rgba(255,255,255,.12);color:#fff;display:grid;place-items:center}
.lightbox .prev{left:18px}.lightbox .nxt{right:18px}
.lightbox .x{position:absolute;top:18px;right:18px;width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.12);color:#fff;display:grid;place-items:center}
.lightbox .cnt{position:absolute;bottom:20px;left:50%;translate:-50% 0;color:#cbd6e2;font-family:var(--f-500);font-size:14px}

/* ===== RODAPÉ ===== */
.outro{background:var(--noite);color:#fff;padding:clamp(70px,10vw,140px) 0;position:relative;overflow:hidden;isolation:isolate}
.outro h2{font-size:clamp(40px,6vw,86px);margin:16px 0 18px;max-width:16ch}
.outro p{font-family:var(--f-500);font-size:clamp(18px,1.6vw,22px);color:#cfe0ee;max-width:46ch;margin:0 0 30px}
.outro .bot{position:absolute;right:-60px;bottom:-40px;width:min(360px,40vw);opacity:.85;z-index:-1}
.err{background:#fff1f0;border:1px solid #f3c2bd;color:#8a2c22;border-radius:12px;padding:16px 18px;margin:40px 0}
.sk{height:60vh;border-radius:26px;background:linear-gradient(100deg,var(--paper-2) 30%,#fff7e0 50%,var(--paper-2) 70%);background-size:300% 100%;animation:shim 1.4s linear infinite;margin:40px 0}
@keyframes shim{to{background-position:-100% 0}}

@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;transition-delay:0s!important}
  .rv,.words .w>span,.tile{opacity:1;transform:none}
  .rv-mask{clip-path:none}
}
`;

  const I = {
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    arrowL: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    arrowR: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
    filter: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 12v6M9 15l3 3 3-3"/></svg>',
  };
  const GRANDES = new Set([0, 4]); // 1º e 5º projetos ocupam dois andares

  class OtssProjetos extends HTMLElement {
    static get observedAttributes() { return ["sticky-offset"]; }
    constructor() {
      super();
      this.root = this.attachShadow({ mode: "open" });
      this.cfg = { ...DEFAULTS };
      this.state = { view: "narrativa", temas: new Set(), lugares: new Set(), filtersOpen: false };
      this.par = [];
    }
    connectedCallback() {
      if (this._booted) return;
      this._booted = true;
      ["client-id", "site-id", "video-hero", "biblioteca-url"].forEach((a) => { const v = this.getAttribute(a); if (v) this.cfg[a.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v; });
      const v = safeStore.get("otss-projetos-view"); if (v === "mosaico" || v === "narrativa") this.state.view = v;
      this.client = new WixClient(this.cfg.clientId);
      this.injectFonts();
      this.renderShell();
      this.load();
    }
    disconnectedCallback() {
      cancelAnimationFrame(this._raf);
      removeEventListener("scroll", this._onScroll); removeEventListener("resize", this._onScroll);
      document.removeEventListener("keydown", this._onKey);
      this._io && this._io.disconnect();
    }
    attributeChangedCallback(n, _o, v) { if (n === "sticky-offset") this.style.setProperty("--sticky-top", (parseInt(v, 10) || 0) + "px"); }
    $(s) { return this.root.querySelector(s); }
    $$(s) { return [...this.root.querySelectorAll(s)]; }

    injectFonts() {
      const fam = this.getAttribute("fonte-titulo-familia");
      if (fam) this.style.setProperty("--f-900-custom", `"${fam.replace(/"/g, "")}"`);
      const url = this.getAttribute("fonte-titulo");
      if (url && "FontFace" in window && !OtssProjetos._f900) {
        OtssProjetos._f900 = new FontFace("OTSS Museo 900", `url("${url.replace(/"/g, "")}")`, { weight: "900" });
        OtssProjetos._f900.load().then((f) => document.fonts.add(f)).catch(() => {});
      }
      const url5 = this.getAttribute("fonte-subtitulo");
      if (url5 && "FontFace" in window && !OtssProjetos._f500) {
        OtssProjetos._f500 = new FontFace("OTSS Museo 500", `url("${url5.replace(/"/g, "")}")`, { weight: "500" });
        OtssProjetos._f500.load().then((f) => document.fonts.add(f)).catch(() => {});
      }
      if (document.getElementById("otss-proj-fonts")) return;
      const st = document.createElement("style");
      st.id = "otss-proj-fonts";
      st.textContent = `@font-face{font-family:"OTSS Museo 900";src:local("Museo900-Regular"),local("Museo 900");font-weight:900;font-display:swap}
@font-face{font-family:"OTSS Museo 500";src:local("Museo500-Regular"),local("Museo 500");font-weight:500;font-display:swap}`;
      document.head.appendChild(st);
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Bitter:wght@500;900&family=Nunito+Sans:opsz,wght@6..12,400;6..12,700;6..12,800&display=swap";
      document.head.appendChild(l);
    }

    /* ----- dados ----- */
    async load() {
      try {
        const projs = await this.client.query("ProjetosPagina", {}, ["temas"]);
        this.projetos = projs.filter((p) => p.visivel !== false).sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99)).map((p) => ({
          ...p, slug: p.slug || norm(p.titulo).replace(/[^a-z0-9]+/g, "-"), cor: p.cor || "#276cb2", tom: contraste(p.cor),
          temas: (p.temas || []).filter((t) => t && t._id), numeros: (p.numeros || []).map(parseNumero).filter((n) => n.valor),
        }));
        this.bySlug = new Map(this.projetos.map((p) => [p.slug, p]));
        this.renderMain();
        this.readHash();
        this.loadRelated();
      } catch (e) {
        console.error("[otss-projetos]", e);
        this.$(".main").innerHTML = `<div class="wrap"><div class="err"><b>Não foi possível carregar os projetos agora.</b> Tente recarregar a página.</div></div>`;
      }
    }
    async loadRelated() {
      // publicações, vídeos e episódios da Biblioteca marcados com o projeto (campo Projetos)
      const nomes = this.projetos.map((p) => p.nomeCurto).filter(Boolean);
      if (!nomes.length) return;
      try {
        const [acervo, midia] = await Promise.all([
          this.client.query("BibliotecaAcervo", { filter: { projetos: { $hasSome: nomes } } }, ["tipo"]),
          this.client.query("BibliotecaMidia", { filter: { projetos: { $hasSome: nomes } } }),
        ]);
        this.related = { acervo: acervo.filter((d) => d.visivel !== false), midia: midia.filter((d) => d.visivel !== false) };
        if (this.openSlug) { const box = this.$('[data-slot="rel"]'); if (box) box.outerHTML = this.relatedHTML(this.bySlug.get(this.openSlug)); }
      } catch (e) { console.warn("[otss-projetos] relacionados indisponíveis", e); }
    }

    /* ----- casca ----- */
    renderShell() {
      const vid = wixVideo(this.cfg.videoHero);
      this.root.innerHTML = `<style>${CSS}</style>
<section class="hero" aria-label="Projetos do OTSS">
  <div class="media" data-speed="0.35" data-scale="0.12">${vid ? `<video class="poster" autoplay muted loop playsinline preload="metadata" poster="${vid.poster}" src="${vid.src}"></video>` : ""}</div>
  <div class="veil" data-veil></div>
  <img class="bot b1" src="${BOTANICOS.capim}" alt="" data-speed="-0.25" aria-hidden="true">
  <img class="bot b2" src="${BOTANICOS.rama}" alt="" data-speed="0.18" aria-hidden="true">
  <div class="wrap">
    <div data-speed="-0.12">
      <span class="eyebrow rv in">OTSS · Projetos</span>
      <h1 class="t900 words" data-words>Projetos que tecem <em>território</em></h1>
      <p class="sub t500 rv" style="--d:.5s">Iniciativas construídas com comunidades caiçaras, indígenas e quilombolas da Bocaina — da cartografia social à saúde, da justiça à cultura.</p>
      <div class="cta-row rv" style="--d:.65s"><button class="btn sol" data-act="explore">Explorar projetos ${I.arrow}</button><a class="btn ghost" href="${esc(this.cfg.bibliotecaUrl)}" target="_blank" rel="noopener">Biblioteca</a></div>
    </div>
    <div class="mosaic" data-mosaic data-speed="0.08" role="list"></div>
  </div>
  <div class="scroll-cue" aria-hidden="true">Role<i></i></div>
</section>
<nav class="bar" aria-label="Projetos"><div class="wrap">
  <div class="idx" role="list"></div>
  <button class="fbtn" data-act="filters" aria-expanded="false">${I.filter}<span>Filtrar</span> <b class="n" hidden></b></button>
  <div class="seg" role="group" aria-label="Visualização"><button data-act="view" data-v="narrativa" aria-pressed="false">▤<span> Narrativa</span></button><button data-act="view" data-v="mosaico" aria-pressed="false">▦<span> Mosaico</span></button></div>
</div><div class="wrap"><div class="fpanel"><div><div class="fgroups"></div></div></div><div class="active"></div></div></nav>
<main class="main"><div class="wrap"><div class="sk"></div></div></main>
<section class="outro">
  <img class="bot" src="${BOTANICOS.rama}" alt="" aria-hidden="true" data-speed="-0.15">
  <div class="wrap">
    <span class="eyebrow rv" style="color:#ffe68a">Conhecimento do território</span>
    <h2 class="t900 words" data-words>Tudo o que os projetos produzem está na Biblioteca</h2>
    <p class="rv">Publicações, cartilhas, mapas, vídeos e podcast — com busca no texto completo.</p>
    <a class="btn sol rv" href="${esc(this.cfg.bibliotecaUrl)}" target="_blank" rel="noopener">Abrir a Biblioteca ${I.arrow}</a>
  </div>
</section>
<div class="page" role="dialog" aria-modal="true" aria-label="Projeto" tabindex="-1"></div>
<div class="lightbox" role="dialog" aria-modal="true" aria-label="Galeria"><button class="x" data-act="lb-close" aria-label="Fechar">${I.x}</button><button class="lb-btn prev" data-act="lb-prev" aria-label="Anterior">${I.arrowL}</button><img alt=""><button class="lb-btn nxt" data-act="lb-next" aria-label="Próxima">${I.arrowR}</button><span class="cnt"></span></div>`;
      this.splitWords();
      this.bind();
      this.observe();
      this.startMotion();
    }

    splitWords(scope = this.root) {
      scope.querySelectorAll("[data-words]").forEach((el) => {
        if (el.dataset.split) return;
        el.dataset.split = "1";
        let i = 0;
        const walk = (node) => {
          [...node.childNodes].forEach((n) => {
            if (n.nodeType === 3) {
              const frag = document.createDocumentFragment();
              n.textContent.split(/(\s+)/).forEach((part) => {
                if (!part) return;
                if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
                const w = document.createElement("span"); w.className = "w";
                const s = document.createElement("span"); s.textContent = part; s.style.setProperty("--i", i++);
                w.appendChild(s); frag.appendChild(w);
              });
              n.replaceWith(frag);
            } else if (n.nodeType === 1) walk(n);
          });
        };
        walk(el);
      });
    }

    /* ----- filtros ----- */
    passa(p) {
      const s = this.state;
      if (s.temas.size && !p.temas.some((t) => s.temas.has(t.slug))) return false;
      if (s.lugares.size && !(p.abrangencia || []).some((l) => s.lugares.has(l))) return false;
      return true;
    }
    lista() { return this.projetos.filter((p) => this.passa(p)); }

    renderMain() {
      const ps = this.projetos;
      // mosaico do hero
      this.$("[data-mosaic]").innerHTML = ps.map((p, i) => `<button class="tile ${GRANDES.has(i) ? "big" : ""}" role="listitem" style="--c:${p.cor};--tc:${p.tom === "escuro" ? "#16283b" : "#fff"};--i:${i}" data-open="${esc(p.slug)}" aria-label="${esc(p.titulo)}">${p.logo ? `<img src="${esc(wixImage(p.logo, 480))}" alt="" loading="eager">` : `<span class="t900" style="color:var(--tc);font-size:22px">${esc(p.nomeCurto || p.titulo)}</span>`}<span class="lbl">${esc(p.nomeCurto || p.titulo)}</span></button>`).join("");
      const usados = ps.reduce((n, _p, i) => n + (GRANDES.has(i) ? 4 : 2), 0), sobra = (6 - (usados % 6)) % 6;
      const extras = [`<button class="tile extra" style="--i:${ps.length}" data-act="explore"><span class="t500">Todos os projetos ${I.arrow}</span></button>`, `<a class="tile extra" style="--i:${ps.length + 1}" href="${esc(this.cfg.bibliotecaUrl)}" target="_blank" rel="noopener"><span class="t500">Biblioteca ${I.arrow}</span></a>`, `<span class="tile extra" style="--i:${ps.length + 2}" aria-hidden="true"></span>`];
      this.$("[data-mosaic]").insertAdjacentHTML("beforeend", extras.slice(0, sobra / 2).join(""));
      requestAnimationFrame(() => this.$("[data-mosaic]").classList.add("in"));
      // índice
      this.$(".idx").innerHTML = ps.map((p) => `<button role="listitem" data-act="goto" data-slug="${esc(p.slug)}" style="--c:${p.cor};--tc:${p.tom === "escuro" ? "#16283b" : "#fff"}" aria-current="false"><i></i>${esc(p.nomeCurto || p.titulo)}</button>`).join("");
      // filtros
      const temas = new Map(), lugares = new Map();
      ps.forEach((p) => { p.temas.forEach((t) => temas.set(t.slug, t)); (p.abrangencia || []).forEach((l) => lugares.set(l, (lugares.get(l) || 0) + 1)); });
      this.$(".fgroups").innerHTML = `<div><h4>Temas e eixos</h4><div class="chips">${[...temas.values()].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((t) => `<button class="chip" style="--c:${t.cor}" data-act="tema" data-k="${esc(t.slug)}" aria-pressed="false">${esc(t.nome)}</button>`).join("")}</div></div>
        <div><h4>Onde atuam</h4><div class="chips">${[...lugares.entries()].sort((a, b) => b[1] - a[1]).map(([l, n]) => `<button class="chip" style="--c:#276cb2" data-act="lugar" data-k="${esc(l)}" aria-pressed="false">${esc(l)} <small>${n}</small></button>`).join("")}</div></div>`;
      this.update();
    }

    update() {
      const s = this.state, vis = this.lista();
      const main = this.$(".main");
      main.innerHTML = s.view === "mosaico" ? this.mosaicoHTML(vis) : this.narrativaHTML(vis);
      if (!vis.length) main.innerHTML = `<div class="wrap" style="padding:80px 0;text-align:center"><h2 class="t900" style="font-size:40px">Nenhum projeto com esses filtros</h2><button class="btn dark" data-act="clear">Limpar filtros</button></div>`;
      this.$$('[data-act="view"]').forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === s.view)));
      this.$$('[data-act="tema"]').forEach((b) => b.setAttribute("aria-pressed", String(s.temas.has(b.dataset.k))));
      this.$$('[data-act="lugar"]').forEach((b) => b.setAttribute("aria-pressed", String(s.lugares.has(b.dataset.k))));
      const vset = new Set(vis.map((p) => p.slug));
      this.$$(".idx button").forEach((b) => b.classList.toggle("off", !vset.has(b.dataset.slug)));
      const n = s.temas.size + s.lugares.size, badge = this.$(".fbtn .n");
      badge.hidden = !n; badge.textContent = n;
      const temaNome = (k) => (this.projetos.flatMap((p) => p.temas).find((t) => t.slug === k) || {}).nome || k;
      this.$(".active").innerHTML = n ? [...s.temas].map((k) => `<button class="chip" style="--c:#16283b" aria-pressed="true" data-act="tema" data-k="${esc(k)}">${esc(temaNome(k))} ✕</button>`).join("") + [...s.lugares].map((k) => `<button class="chip" style="--c:#16283b" aria-pressed="true" data-act="lugar" data-k="${esc(k)}">${esc(k)} ✕</button>`).join("") + `<button class="linkbtn" data-act="clear">Limpar</button>` : "";
      this.splitWords(main);
      this.observe();
      this.collectParallax();
      this.onScroll();
    }

    narrativaHTML(ps) {
      return `<div class="chapters">${ps.map((p, i) => {
        const ph = wixImage(p.capa, 2000);
        const stats = p.numeros.slice(0, 4);
        return `<section class="chap ${p.tom}" id="p-${esc(p.slug)}" data-chap="${esc(p.slug)}" style="--c:${p.cor}">
  <div class="bg">${ph ? `<div class="ph" style="background-image:url('${esc(ph)}')" data-speed="0.22" data-scope="chap"></div>` : ""}<div class="tint"></div></div>
  <div class="content"><div class="wrap" style="width:100%"><div class="panel">
    <div class="num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</div>
    ${p.logo ? `<div class="logo rv"><img src="${esc(wixImage(p.logo, 520))}" alt="${esc(p.titulo)}" loading="lazy"></div>` : ""}
    <h2 class="t900 words" data-words>${esc(p.nomeCurto || p.titulo)}</h2>
    ${p.chamada ? `<p class="chamada t500 rv" style="--d:.15s">${esc(p.chamada)}</p>` : ""}
    <div class="meta rv" style="--d:.22s">${[p.formato, p.periodo, p.status].filter(Boolean).map((m) => `<span class="pill">${esc(m)}</span>`).join("")}</div>
    ${p.oQue ? `<p class="lead rv" style="--d:.3s">${esc(p.oQue)}</p>` : ""}
    ${stats.length ? `<div class="stats">${stats.map((n, k) => `<div class="stat rv" style="--d:${0.35 + k * 0.08}s"><b data-count="${esc(n.valor)}">${esc(n.valor)}</b><span>${esc(n.rotulo)}</span></div>`).join("")}</div>` : ""}
    <button class="btn rv" style="--d:.45s" data-open="${esc(p.slug)}">Conhecer o projeto ${I.arrow}</button>
  </div></div></div>
</section>`;
      }).join("")}</div>`;
    }
    mosaicoHTML(ps) {
      return `<section class="grid-view"><div class="wrap"><div class="cards">${ps.map((p, i) => `<button class="card ${p.tom} rv" style="--c:${p.cor};--d:${(i % 3) * 0.08}s" data-open="${esc(p.slug)}">
  ${p.capa ? `<div class="photo" style="background-image:url('${esc(wixImage(p.capa, 900, 1100))}')"></div>` : ""}
  <span class="go">${I.arrowR}</span>
  <div class="top">${p.logo ? `<img src="${esc(wixImage(p.logo, 520))}" alt="" loading="lazy">` : ""}</div>
  <div class="bottom"><h3 class="t900">${esc(p.nomeCurto || p.titulo)}</h3>${p.chamada ? `<p class="chamada t500">${esc(p.chamada)}</p>` : ""}</div>
</button>`).join("")}</div></div></section>`;
    }

    /* ----- página do projeto ----- */
    openProject(slug, origin) {
      const p = this.bySlug.get(slug);
      if (!p) return;
      this.openSlug = slug;
      const pg = this.$(".page");
      if (origin) { const r = origin.getBoundingClientRect(); pg.style.setProperty("--ox", `${r.left + r.width / 2}px`); pg.style.setProperty("--oy", `${r.top + r.height / 2}px`); }
      pg.style.setProperty("--c", p.cor);
      pg.style.setProperty("--cc", p.tom === "escuro" ? "color-mix(in srgb," + p.cor + " 45%,#16283b)" : p.cor);
      pg.innerHTML = this.pageHTML(p);
      pg.scrollTop = 0;
      this.splitWords(pg);
      pg.classList.add("on");
      document.documentElement.style.overflow = "hidden";
      this.lastFocus = this.root.activeElement;
      setTimeout(() => pg.focus({ preventScroll: true }), 50);
      pg.onscroll = () => this.onScroll();
      this.observe(pg);
      this.collectParallax();
      this.onScroll();
      try { history.replaceState(null, "", "#projeto=" + slug); } catch { /* sandbox */ }
    }
    closeProject() {
      const pg = this.$(".page");
      if (!pg.classList.contains("on")) return;
      pg.classList.remove("on");
      document.documentElement.style.overflow = "";
      this.openSlug = "";
      pg.querySelectorAll("video").forEach((v) => v.pause());
      setTimeout(() => { if (!pg.classList.contains("on")) { pg.innerHTML = ""; this.collectParallax(); } }, 900);
      try { history.replaceState(null, "", location.pathname + location.search); } catch { /* sandbox */ }
      if (this.lastFocus && this.lastFocus.focus) this.lastFocus.focus({ preventScroll: true });
    }
    readHash() {
      const m = location.hash.match(/projeto=([\w-]+)/);
      if (m && this.bySlug.has(m[1])) this.openProject(m[1]);
    }

    pageHTML(p) {
      const idx = this.projetos.indexOf(p), next = this.projetos[(idx + 1) % this.projetos.length];
      const ph = wixImage(p.capa, 2200);
      const vid = wixVideo(p.video);
      const gal = (p.galeria || []).filter((g) => g && g.src && (g.type || "image") === "image");
      this.gal = gal.map((g) => wixImage(g.src, 1800));
      const parag = (t) => String(t || "").split(/\n+/).filter(Boolean).map((x) => `<p>${esc(x)}</p>`).join("");
      const obj = (p.objetivos || []).map((o) => { const m = o.match(/^([^:]{3,80}):\s*(.+)$/); return m ? `<b>${esc(m[1])}:</b> ${esc(m[2])}` : esc(o); });
      const parceiros = p.parceiros || [];
      return `<button class="close" data-act="close" aria-label="Fechar projeto">${I.x}</button>
<header class="phero ${p.tom}">
  ${ph ? `<div class="ph" style="background-image:url('${esc(ph)}')" data-speed="0.3" data-scope="page"></div>` : ""}<div class="tint"></div>
  <div class="wrap">
    ${p.logo ? `<div class="logo rv in"><img src="${esc(wixImage(p.logo, 720))}" alt="${esc(p.titulo)}"></div>` : ""}
    <h1 class="t900 words" data-words>${esc(p.titulo)}</h1>
    ${p.chamada ? `<p class="chamada t500 rv" style="--d:.3s">${esc(p.chamada)}</p>` : ""}
    <div class="meta rv" style="--d:.4s">${[p.formato, p.periodo, p.status].filter(Boolean).map((m) => `<span class="pill">${esc(m)}</span>`).join("")}${p.temas.map((t) => `<span class="pill">${esc(t.nome)}</span>`).join("")}</div>
  </div>
</header>
${p.oQue ? `<section class="psec"><div class="wrap two"><div><p class="kick rv">O que é</p><h2 class="t900 words" data-words>Sobre o projeto</h2></div><div class="rv"><p class="big">${esc(p.oQue.split(/\n+/)[0])}</p><div class="prose" style="margin-top:22px">${parag(p.oQue.split(/\n+/).slice(1).join("\n"))}</div></div></div></section>` : ""}
${p.numeros.length ? `<section class="psec nums ${p.tom}"><div class="wrap"><p class="kick rv" style="color:var(--tc)">Em números</p><div class="stats">${p.numeros.map((n, k) => `<div class="stat rv" style="--d:${k * 0.08}s"><b data-count="${esc(n.valor)}">${esc(n.valor)}</b><span>${esc(n.rotulo)}</span></div>`).join("")}</div></div></section>` : ""}
${obj.length ? `<section class="psec"><div class="wrap two"><div><p class="kick rv">Objetivos</p><h2 class="t900 words" data-words>${obj.length > 1 ? "O que buscamos" : "Para quê"}</h2></div><ol class="obj">${obj.map((o, k) => `<li class="rv" style="--d:${Math.min(k, 6) * 0.06}s">${o}</li>`).join("")}</ol></div></section>` : ""}
${p.onde || (p.abrangencia || []).length || p.mapa ? `<section class="psec" style="background:var(--paper-2)"><div class="wrap two"><div><p class="kick rv">Onde atua</p><h2 class="t900 words" data-words>Território</h2>${(p.abrangencia || []).length ? `<div class="places rv">${p.abrangencia.map((l) => `<span>${esc(l)}</span>`).join("")}</div>` : ""}<div class="prose rv">${parag(p.onde)}</div></div>${p.mapa ? `<div class="mapbox rv-mask" data-reveal-img><img src="${esc(wixImage(p.mapa, 1600))}" alt="Mapa de atuação" loading="lazy"></div>` : ""}</div></section>` : ""}
${p.quemExecuta || parceiros.length ? `<section class="psec"><div class="wrap two"><div><p class="kick rv">Quem executa</p><h2 class="t900 words" data-words>Feito em rede</h2></div><div class="prose rv">${parag(p.quemExecuta)}</div></div>${parceiros.length ? `<div class="marquee rv" style="margin-top:40px;--mqd:${Math.max(24, parceiros.length * 4)}s"><div class="track">${[...parceiros, ...parceiros].map((x) => `<span>${esc(x)}</span>`).join("")}</div></div>` : ""}</section>` : ""}
${gal.length ? `<section class="psec" style="padding-bottom:40px"><div class="wrap" style="display:flex;align-items:end;justify-content:space-between;gap:20px;flex-wrap:wrap"><div><p class="kick rv">Galeria</p><h2 class="t900 words" data-words>Nos territórios</h2></div><div class="gal-ctrl rv"><button class="round" data-act="gal" data-dir="-1" aria-label="Anterior">${I.arrowL}</button><button class="round" data-act="gal" data-dir="1" aria-label="Próximo">${I.arrowR}</button></div></div>
  <div class="gal rv">${gal.map((g, k) => { const r = imgRatio(g.src); const w = Math.round(460 * r); return `<button data-act="lb" data-i="${k}" style="--r:${r.toFixed(3)}" aria-label="Ampliar foto ${k + 1}"><img src="${esc(wixImage(g.src, Math.min(1400, w * 2), 920))}" alt="${esc(g.title || g.alt || "")}" loading="lazy"></button>`; }).join("")}</div></section>` : ""}
${vid ? `<section class="psec"><div class="wrap"><p class="kick rv">Vídeo</p><div class="vid rv"><video preload="none" poster="${esc(vid.poster)}" playsinline controls hidden src="${esc(vid.src)}"></video><button class="play" data-act="play" aria-label="Assistir ao vídeo"><i>${I.play}</i></button><img src="${esc(vid.poster)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1"></div></div></section>` : ""}
${this.relatedHTML(p)}
${p.linkExterno || p.documento ? `<section class="psec" style="padding-top:0"><div class="wrap"><div class="links">${p.linkExterno ? `<a class="btn dark" href="${esc(p.linkExterno)}" target="_blank" rel="noopener">Mais informações ${I.ext}</a>` : ""}${p.documento ? `<a class="btn dark" href="${esc(p.documento)}" target="_blank" rel="noopener">Baixar documento ${I.pdf}</a>` : ""}</div></div></section>` : ""}
${next && next !== p ? `<button class="next ${next.tom}" style="--c:${next.cor}" data-open="${esc(next.slug)}">${next.capa ? `<div class="ph" style="background-image:url('${esc(wixImage(next.capa, 1800))}')" data-speed="0.25" data-scope="page"></div>` : ""}<div class="wrap"><small>Próximo projeto</small><strong class="t900">${esc(next.nomeCurto || next.titulo)} ${I.arrowR}</strong></div></button>` : ""}`;
    }

    relatedHTML(p) {
      if (!p) return "";
      const k = norm(p.nomeCurto);
      if (!this.related) return `<div data-slot="rel"></div>`;
      const ac = this.related.acervo.filter((d) => (d.projetos || []).some((x) => norm(x) === k)).sort((a, b) => (b.ano || 0) - (a.ano || 0));
      const md = this.related.midia.filter((d) => (d.projetos || []).some((x) => norm(x) === k));
      if (!ac.length && !md.length) return `<div data-slot="rel"></div>`;
      const base = this.cfg.bibliotecaUrl;
      const card = (href, tipo, cor, titulo, sub) => `<a href="${esc(href)}" target="_blank" rel="noopener" style="--k:${cor}"><small>${esc(tipo)}</small><b>${esc(titulo)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</a>`;
      const itens = [
        ...ac.slice(0, 9).map((d) => card(`${base}#item=${d._id}`, (d.tipo && d.tipo.nome) || d.formatoOriginal || "Publicação", (d.tipo && d.tipo.cor) || "#276cb2", d.titulo, [d.autores, d.ano].filter(Boolean).join(" · "))),
        ...md.slice(0, 6).map((d) => card(`${base}#item=${d._id}`, d.tipo === "podcast" ? "Podcast" : "Vídeo", d.tipo === "podcast" ? "#15803d" : "#c4302b", d.titulo, d.duracao || "")),
      ];
      const total = ac.length + md.length;
      return `<section class="psec" data-slot="rel" style="background:var(--paper-2)"><div class="wrap"><div style="display:flex;align-items:end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:26px"><div><p class="kick rv">Na Biblioteca</p><h2 class="t900 words in" data-words style="margin:0">Produção do projeto</h2></div><a class="btn dark rv in" href="${esc(base)}#projeto=${encodeURIComponent(p.nomeCurto)}" target="_blank" rel="noopener">Ver todos os ${total} ${I.arrow}</a></div><div class="rel">${itens.join("")}</div></div></section>`;
    }

    /* ----- movimento ----- */
    observe(scope = this.root) {
      if (!("IntersectionObserver" in window) || reduceMotion()) { scope.querySelectorAll(".rv,.rv-mask,[data-words]").forEach((e) => e.classList.add("in")); scope.querySelectorAll("[data-count]").forEach((e) => this.countUp(e, true)); return; }
      if (!this._io) {
        this._io = new IntersectionObserver((ents) => ents.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.classList.add("in");
          en.target.querySelectorAll && en.target.querySelectorAll("[data-count]").forEach((c) => this.countUp(c));
          if (en.target.matches("[data-count]")) this.countUp(en.target);
          this._io.unobserve(en.target);
        }), { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
      }
      scope.querySelectorAll(".rv:not(.in),.rv-mask:not(.in),[data-words]:not(.in)").forEach((e) => this._io.observe(e));
      // hero: palavras entram já
      const h1 = this.$(".hero [data-words]"); if (h1) requestAnimationFrame(() => h1.classList.add("in"));
    }
    countUp(el, instant) {
      if (el.dataset.done) return;
      el.dataset.done = "1";
      const raw = el.dataset.count;
      const m = raw.match(/^([^\d]*)([\d.]+)(.*)$/);
      if (!m || /–|-/.test(raw) || instant) { el.textContent = raw; return; }
      const target = parseFloat(m[2].replace(/\./g, "")), pre = m[1], suf = m[3];
      if (target >= 1900 && target <= 2100 && !m[2].includes(".")) { el.textContent = raw; return; }
      const t0 = performance.now(), dur = 1600;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
        el.textContent = pre + Math.round(target * e).toLocaleString("pt-BR") + suf;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    collectParallax() {
      this.par = this.$$("[data-speed]").map((el) => ({ el, speed: parseFloat(el.dataset.speed) || 0, scale: parseFloat(el.dataset.scale) || 0, scope: el.dataset.scope || "" }));
      this.veil = this.$("[data-veil]");
    }
    startMotion() {
      this._onScroll = () => this.onScroll();
      addEventListener("scroll", this._onScroll, { passive: true });
      addEventListener("resize", this._onScroll);
    }
    onScroll() {
      if (this._ticking) return;
      this._ticking = true;
      this._raf = requestAnimationFrame(() => {
        this._ticking = false;
        const vh = innerHeight;
        if (!reduceMotion()) {
          const pageOn = this.$(".page.on");
          for (const p of this.par) {
            if (p.scope === "page" && !pageOn) continue;
            const host = p.scope === "chap" ? p.el.closest(".chap") : p.el.parentElement;
            const r = (host || p.el).getBoundingClientRect();
            if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) continue;
            const center = r.top + r.height / 2 - vh / 2;
            let y = -center * p.speed;
            if (p.scope === "chap") y = clamp(-(r.top) * p.speed, -vh * 0.4, vh * 0.4);
            const sc = p.scale ? 1 + clamp(-r.top / vh, 0, 1) * p.scale : 1;
            p.el.style.transform = `translate3d(0,${y.toFixed(1)}px,0)${sc !== 1 ? ` scale(${sc.toFixed(3)})` : ""}`;
          }
          if (this.veil) { const hr = this.$(".hero").getBoundingClientRect(); this.veil.style.opacity = String(1 + clamp(-hr.top / hr.height, 0, 1) * 0.4); }
        }
        this.spy();
      });
    }
    spy() {
      const chaps = this.$$(".chap");
      let cur = "";
      if (this.state.view === "narrativa") for (const c of chaps) { const r = c.getBoundingClientRect(); if (r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.5) { cur = c.dataset.chap; break; } }
      if (cur === this._cur) return;
      this._cur = cur;
      const p = cur && this.bySlug.get(cur);
      this.$$(".idx button").forEach((b) => b.setAttribute("aria-current", String(b.dataset.slug === cur)));
      const act = this.$(`.idx button[data-slug="${cur}"]`);
      if (act) { const idx = this.$(".idx"); idx.scrollTo({ left: act.offsetLeft - idx.clientWidth / 2 + act.offsetWidth / 2, behavior: "smooth" }); }
      this.$(".bar").style.background = p ? `color-mix(in srgb, ${p.cor} 16%, rgba(251,247,236,.92))` : "";
    }

    /* ----- eventos ----- */
    bind() {
      this.root.addEventListener("click", (e) => {
        const a = e.target.closest("[data-act]");
        const act = a && a.dataset.act, s = this.state;
        if (act) {
          switch (act) {
            case "explore": this.scrollToMain(); return;
            case "goto": {
              if (s.view !== "narrativa") { s.view = "narrativa"; this.update(); }
              const el = this.$(`#p-${a.dataset.slug}`); if (!el) return;
              const off = (parseInt(this.getAttribute("sticky-offset"), 10) || 0);
              scrollTo({ top: el.getBoundingClientRect().top + scrollY - off + 2, behavior: reduceMotion() ? "auto" : "smooth" });
              return;
            }
            case "view": s.view = a.dataset.v; safeStore.set("otss-projetos-view", s.view); this.update(); this.scrollToMain(); return;
            case "filters": s.filtersOpen = !s.filtersOpen; this.$(".fpanel").classList.toggle("open", s.filtersOpen); a.setAttribute("aria-expanded", String(s.filtersOpen)); return;
            case "tema": s.temas.has(a.dataset.k) ? s.temas.delete(a.dataset.k) : s.temas.add(a.dataset.k); this.update(); return;
            case "lugar": s.lugares.has(a.dataset.k) ? s.lugares.delete(a.dataset.k) : s.lugares.add(a.dataset.k); this.update(); return;
            case "clear": s.temas.clear(); s.lugares.clear(); this.update(); return;
            case "close": this.closeProject(); return;
            case "gal": { const g = this.$(".page .gal"); g && g.scrollBy({ left: +a.dataset.dir * g.clientWidth * 0.8, behavior: "smooth" }); return; }
            case "lb": this.openLb(+a.dataset.i); return;
            case "lb-close": this.closeLb(); return;
            case "lb-prev": this.openLb(this.lbI - 1); return;
            case "lb-next": this.openLb(this.lbI + 1); return;
            case "play": { const box = a.closest(".vid"); const v = box.querySelector("video"); v.hidden = false; a.remove(); box.querySelector("img") && box.querySelector("img").remove(); v.play().catch(() => {}); return; }
          }
        }
        const op = e.target.closest("[data-open]");
        if (op) {
          const inPage = op.closest(".page");
          if (inPage) { this.$(".page").scrollTo({ top: 0 }); this.openProject(op.dataset.open, op); }
          else this.openProject(op.dataset.open, op);
        }
      });
      this._onKey = (e) => {
        if (this.$(".lightbox.on")) { if (e.key === "Escape") this.closeLb(); if (e.key === "ArrowLeft") this.openLb(this.lbI - 1); if (e.key === "ArrowRight") this.openLb(this.lbI + 1); return; }
        if (e.key === "Escape" && this.openSlug) this.closeProject();
      };
      document.addEventListener("keydown", this._onKey);
      // mosaico do hero: leve inclinação com o mouse
      const hero = this.$(".hero");
      hero.addEventListener("pointermove", (e) => {
        if (reduceMotion() || e.pointerType !== "mouse") return;
        const r = hero.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        this.$$(".tile").forEach((t, i) => { const d = ((i % 3) + 1) * 4; t.style.translate = `${(-x * d).toFixed(1)}px ${(-y * d).toFixed(1)}px`; });
      });
      hero.addEventListener("pointerleave", () => this.$$(".tile").forEach((t) => (t.style.translate = "")));
    }
    scrollToMain() {
      const off = parseInt(this.getAttribute("sticky-offset"), 10) || 0;
      scrollTo({ top: this.$(".bar").getBoundingClientRect().top + scrollY - off, behavior: reduceMotion() ? "auto" : "smooth" });
    }
    openLb(i) {
      if (!this.gal || !this.gal.length) return;
      this.lbI = (i + this.gal.length) % this.gal.length;
      const lb = this.$(".lightbox");
      lb.querySelector("img").src = this.gal[this.lbI];
      lb.querySelector(".cnt").textContent = `${this.lbI + 1} / ${this.gal.length}`;
      lb.classList.add("on");
    }
    closeLb() { this.$(".lightbox").classList.remove("on"); }
  }

  if (!customElements.get("otss-projetos")) customElements.define("otss-projetos", OtssProjetos);
})();
