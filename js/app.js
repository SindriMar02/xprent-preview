/* Xprent prototype v4: behaviour + motion.
   Motion rules: every reveal is scrubbed to scroll position (never a fixed duration that a flick can outrun), transform/opacity/
   clip-path only, pinned sections only on desktop where something happens the whole time, Lenis only on fine pointers,
   nothing depends on hover, reduced motion gets a plain page. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = () => matchMedia('(hover: none) and (pointer: coarse)').matches;
  const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  const motion = hasGsap && !reduce;
  if (!motion) root.classList.add('no-motion');
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ---------- smooth wheel: desktop mouse only (lenis-mobile-damage) */
  const lenis = (motion && typeof Lenis !== 'undefined' && !isTouch()) ? new Lenis({ lerp: 0.1, wheelMultiplier: 1 }) : null;
  if (lenis) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    root.classList.add('lenis');
  }
  const barH = () => parseFloat(getComputedStyle(root).getPropertyValue('--bar')) || 72;
  const scrollToEl = (el, center) => {
    if (!el) return;
    if (innerWidth < 900 && el.id === 'smidi') el = $('h2', el) || el;
    center = center && el.offsetHeight < innerHeight - barH() - 24;
    if (lenis) lenis.scrollTo(el, { offset: center ? -(innerHeight - el.offsetHeight) / 2 : -(barH() + 12), duration: 1.1 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: center ? 'center' : 'start' });
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute('data-to-form') || a.closest('#drawer')) return;
    const id = a.getAttribute('href'); if (id === '#') { e.preventDefault(); scrollToEl(document.body); return; }
    const t = $(id); if (!t) return; e.preventDefault(); scrollToEl(t);
  });

  let lockY = 0;
  const lock = () => { if (document.body.classList.contains('is-locked')) return; lockY = scrollY; document.body.style.top = `-${lockY}px`; document.body.classList.add('is-locked'); if (lenis) lenis.stop(); };
  const unlock = () => { document.body.classList.remove('is-locked'); document.body.style.top = ''; scrollTo({ top: lockY, behavior: 'instant' }); if (lenis) lenis.start(); };

  /* ---------- drawer (phones) */
  const burger = $('.burger'), drawer = $('#drawer');
  let dOpen = false, dT;
  const setDrawer = (open, after) => {
    if (open === dOpen) { if (after) after(); return; }
    dOpen = open; clearTimeout(dT);
    burger.setAttribute('aria-expanded', String(open));
    $('.sr', burger).textContent = open ? 'Loka valmynd' : 'Opna valmynd';
    if (open) { lock(); drawer.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => { if (dOpen) drawer.classList.add('is-open'); })); }
    else { drawer.classList.remove('is-open'); dT = setTimeout(() => { drawer.hidden = true; unlock(); if (after) after(); }, 210); }
  };
  burger.addEventListener('click', () => setDrawer(!dOpen));
  drawer.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    e.preventDefault(); const id = a.getAttribute('href');
    setDrawer(false, () => { if (a.hasAttribute('data-to-form')) toForm(); else scrollToEl($(id)); });
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && dOpen) setDrawer(false); });
  matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches && dOpen) setDrawer(false); });

  /* ---------- quote form */
  const form = $('[data-qf]'), card = $('#tilbod');
  const radios = $$('input[name=tegund]', form);
  const toForm = (tegund) => {
    if (tegund) { const r = radios.find((x) => x.value === tegund); if (r) { r.checked = true; setErr('tegund', ''); } }
    scrollToEl(card, true);
    setTimeout(() => (tegund && !isTouch() ? $('#f-nafn') : radios.find((r) => r.checked) || radios[0]).focus({ preventScroll: true }), reduce ? 0 : 1000);
  };
  $$('[data-to-form]').forEach((a) => { if (a.closest('#drawer')) return; a.addEventListener('click', (e) => { e.preventDefault(); toForm(a.dataset.tegund); }); });
  const setErr = (name, msg) => {
    const f = form.querySelector(`[data-name="${name}"]`); if (!f) return null;
    f.classList.toggle('is-bad', !!msg);
    const e = $('.fld__err', f); if (e) e.textContent = msg || '';
    const c = $('input:not([type=radio]):not([type=file]), textarea', f); if (c) c.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return f;
  };
  form.addEventListener('input', (e) => { const f = e.target.closest('[data-name]'); if (f && f.classList.contains('is-bad')) setErr(f.dataset.name, ''); });
  /* Safari pans its visual viewport as the keyboard opens or changes layout. */
  if (isTouch() && window.visualViewport) {
    let focusFrame = 0, focusTimer;
    const keepFieldVisible = () => {
      cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        const el = document.activeElement, v = visualViewport;
        if (!form.contains(el) || !el.matches('input:not([type=radio]):not([type=file]), textarea') || v.height > innerHeight - 100) return;
        const r = el.getBoundingClientRect(), origin = v.pageTop - scrollY;
        const top = Math.max(origin, $('.bar').getBoundingClientRect().bottom) + 12, bottom = origin + v.height - 16;
        const delta = r.top < top ? r.top - top : r.bottom > bottom ? r.bottom - bottom : 0;
        if (Math.abs(delta) > 1) scrollBy({ top: delta, behavior: 'instant' });
      });
    };
    form.addEventListener('focusin', () => { clearTimeout(focusTimer); keepFieldVisible(); focusTimer = setTimeout(keepFieldVisible, 400); });
    visualViewport.addEventListener('resize', keepFieldVisible);
  }
  radios.forEach((r) => r.addEventListener('change', () => setErr('tegund', '')));
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  $('#f-netfang').addEventListener('blur', (e) => { const v = e.target.value.trim(); if (v && !EMAIL.test(v)) setErr('netfang', 'Netfang virðist rangt skrifað.'); });
  const fileIn = $('#f-skrar'), list = $('[data-files]', form);
  let files = [];
  const fmt = (b) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
  const drawFiles = () => list.replaceChildren(...files.map((f, i) => {
    const li = document.createElement('li'), name = document.createElement('span'); name.textContent = `${f.name} (${fmt(f.size)})`; li.append(name);
    const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Fjarlægja'; b.setAttribute('aria-label', `Fjarlægja ${f.name}`);
    b.addEventListener('click', () => { files.splice(i, 1); drawFiles(); fileIn.focus(); }); li.append(b); return li;
  }));
  fileIn.addEventListener('change', () => {
    let msg = '';
    [...fileIn.files].forEach((f) => { if (f.size > 25e6) msg = `${f.name} er stærri en 25 MB. Settu tengil í lýsinguna í staðinn.`; else if (files.length >= 10) msg = 'Hámark 10 skrár.'; else files.push(f); });
    setErr('skrar', msg); fileIn.value = ''; drawFiles();
  });
  const stateForm = $('[data-state="form"]', form), stateDone = $('[data-state="done"]', form);
  let sending = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); if (sending) return;
    const t = (radios.find((r) => r.checked) || {}).value;
    const nafn = $('#f-nafn').value.trim(), mail = $('#f-netfang').value.trim(), lys = $('#f-lysing').value.trim();
    const errs = [['tegund', t ? '' : 'Veldu hvað þig vantar.'], ['nafn', nafn ? '' : 'Skrifaðu nafnið þitt.'], ['netfang', EMAIL.test(mail) ? '' : 'Netfang vantar eða er rangt skrifað.'], ['lysing', lys ? '' : 'Segðu okkur í stuttu máli frá verkinu.']];
    let first = null;
    errs.forEach(([n, m]) => { const f = setErr(n, m); if (m && !first) first = f; });
    if (first) { ($('input:not([type=file]), textarea', first) || first).focus(); return; }
    sending = true; const btn = $('[data-submit]', form); btn.disabled = true; btn.textContent = 'Sendi…';
    await new Promise((r) => setTimeout(r, 800)); // prototype: nothing leaves the browser
    const fail = /fixture=fail/.test(location.search);
    const rows = [['Verk', t], ['Nafn', nafn], ['Netfang', mail]];
    if ($('#f-simi').value.trim()) rows.push(['Sími', $('#f-simi').value.trim()]);
    rows.push(['Lýsing', lys]); if (files.length) rows.push(['Skrár', files.map((f) => f.name).join(', ')]);
    $('[data-brief]', form).replaceChildren(...rows.map(([k, v]) => { const d = document.createElement('div'); const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; d.append(dt, dd); return d; }));
    const h = $('[data-done-h]', form), p = $('[data-done-p]', form), again = $('[data-again]', form);
    h.classList.toggle('is-err', fail);
    if (fail) { h.textContent = 'Ekki tókst að senda beiðnina'; p.textContent = 'Ekkert af því sem þú skrifaðir hefur glatast. Reyndu aftur eða hringdu í 555 6500.'; again.textContent = 'Reyna aftur'; }
    else { h.textContent = 'Takk, beiðnin er komin til skila'; p.textContent = 'Frumgerð: svona staðfesting birtist þegar beiðnin hefur verið vistuð hjá Xprent. Ekkert var sent.'; again.textContent = 'Senda aðra beiðni'; }
    form.dataset.failed = fail ? '1' : '';
    stateForm.hidden = true; stateDone.hidden = false; stateDone.focus({ preventScroll: true });
    btn.disabled = false; btn.textContent = 'Senda beiðni'; sending = false;
    if (hasGsap) ScrollTrigger.refresh();
    scrollToEl(card);
  });
  $('[data-again]', form).addEventListener('click', () => {
    if (!form.dataset.failed) { form.reset(); files = []; drawFiles(); }
    stateDone.hidden = true; stateForm.hidden = false; (radios.find((r) => r.checked) || radios[0]).focus({ preventScroll: true });
    if (hasGsap) ScrollTrigger.refresh();
    scrollToEl(card);
  });

  /* ---------- lightbox (work journey) */
  const lb = $('#lb'), img = $('.lb__img', lb), track = $('[data-work-track]');
  const works = $$('a', track);
  let idx = 0, back = null;
  const TEG = { 'Bílamerking': 'Bílamerking', 'Mattsvört filma': 'Bílamerking', 'Bakljósafilma': 'Bakljósafilma', 'Skilti': 'Skilti', 'Sandblástursfilma': 'Gluggafilma', 'Prentun': 'Prentun' };
  const show = () => { const a = works[idx]; img.src = a.href; img.alt = $('img', a).alt; $('.lb__t', lb).textContent = a.dataset.t; $('.lb__s', lb).textContent = a.dataset.s; $('[data-lb-cta]', lb).dataset.tegund = TEG[a.dataset.s] || 'Annað'; };
  let dragged = false;
  track.addEventListener('click', (e) => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); if (dragged) return; idx = works.indexOf(a); back = a; show(); lock(); lb.showModal(); });
  lb.addEventListener('close', () => { unlock(); back?.focus({ preventScroll: true }); });
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.closest('[data-lb-close]')) lb.close(); });
  $('[data-lb-prev]', lb).addEventListener('click', () => { idx = (idx - 1 + works.length) % works.length; show(); });
  $('[data-lb-next]', lb).addEventListener('click', () => { idx = (idx + 1) % works.length; show(); });
  lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') $('[data-lb-next]', lb).click(); if (e.key === 'ArrowLeft') $('[data-lb-prev]', lb).click(); });
  $('[data-lb-cta]', lb).addEventListener('click', (e) => { e.preventDefault(); const t = e.currentTarget.dataset.tegund; lb.close(); setTimeout(() => toForm(t), 30); });

  /* ---------- process steps (works with or without GSAP) */
  const steps = $$('[data-step]'), stepImgs = $$('[data-step-img]');
  const setStep = (i) => { steps.forEach((s) => s.classList.toggle('is-on', +s.dataset.step === i)); stepImgs.forEach((im) => im.classList.toggle('is-on', +im.dataset.stepImg === i)); };
  setStep(0);

  if (!motion) {
    steps.forEach((s) => s.classList.add('is-on'));
    $$('[data-layer]').forEach((l) => { const L = +l.dataset.layer; l.style.transform = `translateZ(${[150, 0, -150][L] - (+l.style.getPropertyValue('--e') || 0) * 3}px)`; });
    return;
  }

  /* ================= MOTION ================= */
  const band = (trigger, start = 'top 92%', end = 'top 62%') => ({ trigger, start, end, scrub: true });

  /* split section titles into masked words */
  $$('[data-split]').forEach((h) => {
    const text = h.textContent.trim(); h.setAttribute('aria-label', text); h.textContent = '';
    text.split(/\s+/).forEach((tok, i, a) => {
      const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
      const s = document.createElement('span'); s.textContent = tok; w.append(s); h.append(w);
      if (i < a.length - 1) h.append(' ');
    });
    gsap.fromTo($$('.w > span', h), { yPercent: 108 }, { yPercent: 0, ease: 'none', stagger: 0.12, scrollTrigger: band(h, 'top 94%', 'top 66%') });
  });
  $$('[data-up]').forEach((el) => gsap.fromTo(el, { opacity: 0, y: 32 }, { opacity: 1, y: 0, ease: 'none', scrollTrigger: band(el, 'top 96%', 'top 74%') }));
  $$('[data-stagger]').forEach((el) => gsap.fromTo([...el.children], { opacity: 0, y: 24 }, { opacity: 1, y: 0, ease: 'none', stagger: 0.06, scrollTrigger: band(el, 'top 94%', 'top 58%') }));
  $$('[data-curtain]').forEach((fr) => {
    const im = $('img', fr);
    gsap.fromTo(fr, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: band(fr, 'top 98%', 'top 64%') });
    if (im) gsap.fromTo(im, { yPercent: -7, scale: 1.08 }, { yPercent: 5, scale: 1, ease: 'none', scrollTrigger: { trigger: fr, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* hero: intro once, then the photo sinks and darkens as you leave */
  const hero = $('.hero');
  const intro = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.1 });
  intro.fromTo('.hero__bg', { scale: 1.12 }, { scale: 1, duration: 2.2 }, 0)
    .fromTo('.hero__kicker span', { yPercent: 105, y: 0 }, { yPercent: 0, y: 0, duration: 1 }, 0.15)
    .fromTo('.ln > span', { yPercent: 105, y: 0 }, { yPercent: 0, y: 0, duration: 1.1, stagger: 0.09 }, 0.22)
    .fromTo('[data-hero-fade]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08 }, 0.55)
    .fromTo('[data-hero-card]', { opacity: 0, y: 48 }, { opacity: 1, y: 0, duration: 1.1 }, 0.45);
  gsap.to('.hero__bg', { yPercent: 9, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__tint', { opacity: 1, backgroundColor: 'rgba(12,16,21,.88)', ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });

  /* facts: rules draw, numbers count (once, when the band arrives) */
  $$('[data-fact]').forEach((li, i) => {
    gsap.fromTo(li, { '--rule': 0 }, { '--rule': 1, ease: 'none', scrollTrigger: band(li, 'top 96%', 'top 78%') });
    gsap.fromTo(li, { opacity: 0, y: 20 }, { opacity: 1, y: 0, ease: 'none', scrollTrigger: band(li, 'top 98%', 'top 82%') });
  });
  $$('[data-count]').forEach((el) => {
    const to = +el.dataset.count, from = +el.dataset.from, o = { v: from };
    el.textContent = from;
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 1.4, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v); } }) });
  });

  /* kinetic band: two rows travel in opposite directions with the scroll */
  $$('[data-kin]').forEach((row) => {
    const dir = +row.dataset.kin;
    gsap.fromTo(row, { xPercent: dir < 0 ? 0 : -28 }, { xPercent: dir < 0 ? -28 : 0, ease: 'none', scrollTrigger: { trigger: '.kin', start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  const mm = gsap.matchMedia();

  /* signature: the X sign comes apart layer by layer (desktop pins, phones scrub in place) */
  const layers = $$('[data-layer]'), labels = $$('[data-layer-label]'), obj = $('[data-build-obj]');
  const OUT = [190, 0, -190];
  const zOf = (l, k) => OUT[+l.dataset.layer] * k - (+l.style.getPropertyValue('--e') || 0) * 3;
  layers.forEach((l) => gsap.set(l, { z: zOf(l, 0) }));
  gsap.set(obj, { rotateX: 52, rotateZ: -32, transformPerspective: 0 });
  const label = (p) => labels.forEach((li) => { const L = +li.dataset.layerLabel; li.classList.toggle('is-on', p > 0.2 + L * 0.08 && p < 0.86); });
  labels.forEach((li) => li.style.setProperty('--lo', '.35'));
  mm.add('(min-width: 900px)', () => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: '[data-build]', start: 'top top', end: '+=170%', pin: true, scrub: true, onUpdate: (st) => label(st.progress) } });
    tl.to({}, { duration: 0.12 })
      .to(layers, { z: (i, l) => zOf(l, 1), ease: 'power2.inOut', duration: 0.45 }, 0.12)
      .to(obj, { rotateZ: -18, rotateX: 58, ease: 'power1.inOut', duration: 0.88 }, 0.12)
      .to({}, { duration: 0.18 })
      .to(layers, { z: (i, l) => zOf(l, 0), ease: 'power2.inOut', duration: 0.25 }, 0.75);
  });
  mm.add('(max-width: 899px)', () => {
    gsap.to(layers, { z: (i, l) => zOf(l, 0.55), ease: 'none', scrollTrigger: { trigger: '.build__stage', start: 'top 85%', end: 'center 50%', scrub: true, onUpdate: (st) => label(Math.min(0.8, st.progress * 0.8)) } });
  });

  /* work: pinned horizontal journey on desktop */
  mm.add('(min-width: 900px)', () => {
    const pin = $('[data-work]'), bar = $('[data-work-bar]'), num = $('[data-work-i]');
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    const tw = gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: pin, start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: true, invalidateOnRefresh: true,
      onUpdate: (st) => { bar.style.transform = `scaleX(${0.1 + st.progress * 0.9})`; num.textContent = String(Math.min(works.length, 1 + Math.round(st.progress * (works.length - 1)))).padStart(2, '0'); } } });
    $$('.work__ph img', track).forEach((im) => gsap.fromTo(im, { xPercent: -5 }, { xPercent: 5, ease: 'none', scrollTrigger: { trigger: im.closest('li'), containerAnimation: tw, start: 'left right', end: 'right left', scrub: true } }));
    return () => gsap.set(track, { clearProps: 'transform' });
  });
  /* phones: native swipe, just a drag guard for the lightbox */
  let sx = 0; track.addEventListener('pointerdown', (e) => { sx = e.clientX; dragged = false; }); track.addEventListener('pointerup', (e) => { dragged = Math.abs(e.clientX - sx) > 8; });

  /* process: step under the reading line owns the image */
  const readStep = () => {
    const line = innerWidth < 900 ? Math.max(innerHeight * 0.55, barH() + 44 + $('.proc__frame').offsetHeight) : innerHeight * 0.55;
    let i = 0;
    steps.forEach((s) => { if (s.getBoundingClientRect().top <= line) i = +s.dataset.step; });
    setStep(i);
  };
  ScrollTrigger.create({ trigger: '.proc', start: 'top bottom', end: 'bottom top', onUpdate: readStep, onRefresh: readStep });

  /* contact: title slides in from the edge */
  const hs = $('#hs-h');
  if (hs) gsap.fromTo(hs, { xPercent: 12 }, { xPercent: 0, ease: 'none', scrollTrigger: band('.contact', 'top bottom', 'top 30%') });

  const refresh = () => ScrollTrigger.refresh();
  addEventListener('load', refresh);
  if (document.fonts) document.fonts.ready.then(refresh);
})();
