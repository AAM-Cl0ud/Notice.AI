// ============================================================
//  AERO — Scroll-Driven Drone Experience
// ============================================================

const FRAME_COUNT  = 145;
const FRAME_SPEED  = 2.0;   // 1.8-2.2: higher = animation finishes earlier
const IMAGE_SCALE  = 0.85;  // 0.82-0.90: padded cover mode

// ── STATE ────────────────────────────────────────────────────
const frames = new Array(FRAME_COUNT).fill(null);
let currentFrame = 0;
let bgColor = '#05050a';

// ── DOM REFS ─────────────────────────────────────────────────
const loader        = document.getElementById('loader');
const loaderFill    = document.getElementById('loader-bar-fill');
const loaderPct     = document.getElementById('loader-percent');
const canvas        = document.getElementById('canvas');
const ctx           = canvas.getContext('2d');
const canvasWrap    = document.getElementById('canvas-wrap');
const scrollCont    = document.getElementById('scroll-container');
const heroSection   = document.querySelector('.hero-standalone');
const darkOverlay   = document.getElementById('dark-overlay');
const marqueeWrap   = document.getElementById('marquee-1');

// ── CANVAS SETUP ─────────────────────────────────────────────
function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w   = window.innerWidth;
  const h   = window.innerHeight;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);
}
setupCanvas();
window.addEventListener('resize', () => { setupCanvas(); drawFrame(currentFrame); });

// ── BACKGROUND SAMPLING ───────────────────────────────────────
function sampleBg(img) {
  const tmp = document.createElement('canvas');
  const iw = img.naturalWidth, ih = img.naturalHeight;
  tmp.width = iw; tmp.height = ih;
  const tc = tmp.getContext('2d');
  tc.drawImage(img, 0, 0);
  const pts = [
    tc.getImageData(0,0,1,1).data,
    tc.getImageData(iw-1,0,1,1).data,
    tc.getImageData(0,ih-1,1,1).data,
    tc.getImageData(iw-1,ih-1,1,1).data,
  ];
  let r=0, g=0, b=0;
  pts.forEach(p => { r+=p[0]; g+=p[1]; b+=p[2]; });
  return `rgb(${Math.round(r/4)},${Math.round(g/4)},${Math.round(b/4)})`;
}

// ── DRAW FRAME ────────────────────────────────────────────────
function drawFrame(index) {
  const img = frames[index];
  if (!img) return;
  const cw = window.innerWidth, ch = window.innerHeight;
  const iw = img.naturalWidth,  ih = img.naturalHeight;
  const scale = Math.max(cw / iw, ch / ih) * IMAGE_SCALE;
  const dw = iw * scale, dh = ih * scale;
  const dx = (cw - dw) / 2, dy = (ch - dh) / 2;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, dx, dy, dw, dh);
  if (index % 20 === 0) {
    try { bgColor = sampleBg(img); } catch(e) { /* tainted canvas skip */ }
  }
}

// ── FRAME LOADER ──────────────────────────────────────────────
function loadFrame(i) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { frames[i] = img; resolve(); };
    img.onerror = resolve;
    img.src = `frames/frame_${String(i + 1).padStart(4, '0')}.jpg`;
  });
}

async function preloadFrames() {
  // Phase 1 — first 10 frames for fast first paint
  const first = Array.from({ length: Math.min(10, FRAME_COUNT) }, (_, i) => loadFrame(i));
  await Promise.all(first);
  drawFrame(0);
  loaderFill.style.width = '10%';
  loaderPct.textContent  = '10%';

  // Phase 2 — remaining frames
  let loaded = 10;
  const rest = Array.from({ length: FRAME_COUNT - 10 }, (_, i) =>
    loadFrame(i + 10).then(() => {
      loaded++;
      const p = Math.round((loaded / FRAME_COUNT) * 100);
      loaderFill.style.width = p + '%';
      loaderPct.textContent  = p + '%';
    })
  );
  await Promise.all(rest);

  setTimeout(() => {
    loader.classList.add('hidden');
    initAnimations();
  }, 350);
}

// ── SMOOTH SCROLL (LENIS) ─────────────────────────────────────
function initLenis() {
  const lenis = new Lenis({
    duration: 1.2,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// ── HERO ENTRANCE ─────────────────────────────────────────────
function initHeroEntrance() {
  const words    = document.querySelectorAll('.hero-heading .word');
  const tagline  = document.querySelector('.hero-tagline');
  const scrollInd = document.querySelector('.scroll-indicator');

  gsap.timeline({ delay: 0.15 })
    .to(words,    { y: '0%', opacity: 1, stagger: 0.13, duration: 1.1, ease: 'power3.out' })
    .to(tagline,  { y: 0,    opacity: 1,                 duration: 0.8, ease: 'power2.out' }, '-=0.55')
    .to(scrollInd,{ opacity: 1,                          duration: 0.6                     }, '-=0.4');
}

// ── CIRCLE-WIPE HERO → CANVAS TRANSITION ─────────────────────
function initHeroTransition() {
  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate(self) {
      const p = self.progress;
      // Hero fades as scroll begins
      heroSection.style.opacity = Math.max(0, 1 - p * 18).toString();
      // Canvas expands via circle clip-path
      const wp = Math.min(1, Math.max(0, (p - 0.01) / 0.07));
      canvasWrap.style.clipPath = `circle(${wp * 80}% at 50% 50%)`;
    }
  });
}

// ── FRAME → SCROLL BINDING ────────────────────────────────────
function initFrameScroll() {
  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate(self) {
      const idx = Math.min(
        Math.floor(Math.min(self.progress * FRAME_SPEED, 1) * FRAME_COUNT),
        FRAME_COUNT - 1
      );
      if (idx !== currentFrame) {
        currentFrame = idx;
        requestAnimationFrame(() => drawFrame(currentFrame));
      }
    }
  });
}

// ── DARK OVERLAY ─────────────────────────────────────────────
function initDarkOverlay() {
  const enter = 0.56, leave = 0.73, fade = 0.035;
  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate(self) {
      const p = self.progress;
      let o = 0;
      if      (p >= enter - fade && p < enter)  o = (p - (enter - fade)) / fade;
      else if (p >= enter && p <= leave)         o = 0.91;
      else if (p > leave && p <= leave + fade)   o = 0.91 * (1 - (p - leave) / fade);
      darkOverlay.style.opacity = o.toString();
    }
  });
}

// ── HORIZONTAL MARQUEE ────────────────────────────────────────
function initMarquee() {
  const text  = marqueeWrap.querySelector('.marquee-text');
  const speed = parseFloat(marqueeWrap.dataset.scrollSpeed) || -22;

  gsap.to(text, {
    xPercent: speed,
    ease: 'none',
    scrollTrigger: { trigger: scrollCont, start: 'top top', end: 'bottom bottom', scrub: true }
  });

  // Fade marquee in range 20%–56%
  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate(self) {
      const p = self.progress;
      let o = 0;
      if      (p > 0.18 && p < 0.22) o = (p - 0.18) / 0.04;
      else if (p >= 0.22 && p <= 0.54) o = 1;
      else if (p > 0.54 && p < 0.58) o = 1 - (p - 0.54) / 0.04;
      marqueeWrap.style.opacity = o.toString();
    }
  });
}

// ── SECTION POSITIONING ───────────────────────────────────────
function positionSection(section) {
  const enter  = parseFloat(section.dataset.enter)  / 100;
  const leave  = parseFloat(section.dataset.leave)  / 100;
  const mid    = (enter + leave) / 2;
  const top    = mid * scrollCont.offsetHeight;
  section.style.top       = top + 'px';
  section.style.transform = 'translateY(-50%)';
}

// ── SECTION ANIMATION SYSTEM ──────────────────────────────────
function setupSectionAnimation(section) {
  const type    = section.dataset.animation;
  const persist = section.dataset.persist === 'true';
  const enter   = parseFloat(section.dataset.enter) / 100;
  const leave   = parseFloat(section.dataset.leave) / 100;

  const children = section.querySelectorAll(
    '.section-label, .section-heading, .section-body, .cta-button, .stat'
  );

  const tl = gsap.timeline({ paused: true });

  switch (type) {
    case 'slide-left':
      tl.from(children, { x: -80, opacity: 0, stagger: 0.14, duration: 0.9, ease: 'power3.out' });
      break;
    case 'slide-right':
      tl.from(children, { x: 80, opacity: 0, stagger: 0.14, duration: 0.9, ease: 'power3.out' });
      break;
    case 'scale-up':
      tl.from(children, { scale: 0.88, opacity: 0, stagger: 0.12, duration: 1.0, ease: 'power2.out' });
      break;
    case 'rotate-in':
      tl.from(children, { y: 40, rotation: 3, opacity: 0, stagger: 0.10, duration: 0.9, ease: 'power3.out' });
      break;
    case 'stagger-up':
      tl.from(children, { y: 60, opacity: 0, stagger: 0.15, duration: 0.8, ease: 'power3.out' });
      break;
    default:
      tl.from(children, { y: 40, opacity: 0, stagger: 0.12, duration: 0.9, ease: 'power3.out' });
  }

  let played = false;

  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: false,
    onUpdate(self) {
      const p = self.progress;
      const inRange = p >= enter && p <= leave;

      if (inRange) {
        section.style.opacity = '1';
        if (!played) { tl.play(); played = true; }
      } else if (persist && played) {
        section.style.opacity = '1';
      } else {
        section.style.opacity = '0';
        if (!persist) { tl.pause(0); played = false; }
      }
    }
  });
}

// ── COUNTER ANIMATIONS ────────────────────────────────────────
function initCounters() {
  document.querySelectorAll('.stat-number').forEach(el => {
    const target   = parseFloat(el.dataset.value);
    const decimals = parseInt(el.dataset.decimals || '0');
    const section  = el.closest('.scroll-section');
    const enter    = parseFloat(section.dataset.enter) / 100;
    let animated   = false;

    ScrollTrigger.create({
      trigger: scrollCont,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate(self) {
        if (self.progress >= enter && !animated) {
          animated = true;
          gsap.fromTo(el,
            { textContent: 0 },
            {
              textContent: target,
              duration: 2,
              ease: 'power1.out',
              snap: { textContent: decimals === 0 ? 1 : 0.01 },
              onUpdate() {
                const v = parseFloat(el.textContent);
                el.textContent = decimals === 0 ? Math.round(v).toString() : v.toFixed(decimals);
              },
            }
          );
        }
      }
    });
  });
}

// ── INIT ALL ─────────────────────────────────────────────────
function initAnimations() {
  gsap.registerPlugin(ScrollTrigger);

  initLenis();
  initHeroEntrance();
  initHeroTransition();
  initFrameScroll();
  initDarkOverlay();
  initMarquee();

  document.querySelectorAll('.scroll-section').forEach(section => {
    positionSection(section);
    setupSectionAnimation(section);
  });

  initCounters();
}

// ── BOOT ─────────────────────────────────────────────────────
preloadFrames();
