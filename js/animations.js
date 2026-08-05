(function () {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animateCounter(el) {
    const target = parseFloat(el.dataset.counter);
    const suffix = el.dataset.suffix || '';
    const isDecimal = String(target).indexOf('.') !== -1;
    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration: 1.6,
      ease: 'power2.out',
      onUpdate: function () {
        const formatted = isDecimal ? obj.val.toFixed(1) : Math.floor(obj.val).toLocaleString('en-IN');
        el.textContent = formatted + suffix;
      },
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof gsap === 'undefined') return;

    if (prefersReducedMotion) {
      gsap.set('.hero-content, .hero-visual, [data-animate], [data-animate-stagger] > *', { opacity: 1, y: 0, scale: 1 });
      document.querySelectorAll('[data-counter]').forEach(function (el) {
        const target = parseFloat(el.dataset.counter);
        const suffix = el.dataset.suffix || '';
        const isDecimal = String(target).indexOf('.') !== -1;
        el.textContent = (isDecimal ? target.toFixed(1) : target.toLocaleString('en-IN')) + suffix;
      });
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    /* ---- Hero entrance ---- */
    const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    heroTl
      .from('.hero-eyebrow', { opacity: 0, y: 16, duration: 0.5 })
      .from('.hero-content h1', { opacity: 0, y: 24, duration: 0.7 }, '-=0.25')
      .from('.hero-content .lede', { opacity: 0, y: 20, duration: 0.6 }, '-=0.4')
      .from('.hero-actions .btn', { opacity: 0, y: 16, duration: 0.5, stagger: 0.1 }, '-=0.3')
      .from('.hero-stat', { opacity: 0, y: 16, duration: 0.5, stagger: 0.08 }, '-=0.2')
      .from('.hero-visual', { opacity: 0, scale: 0.92, duration: 0.8 }, '-=0.6');

    /* ---- Floating pills — continuous drift ---- */
    gsap.utils.toArray('.floating-pill').forEach(function (pill, i) {
      gsap.to(pill, {
        y: i % 2 === 0 ? -18 : 18,
        rotation: i % 2 === 0 ? 6 : -6,
        duration: 3 + i * 0.4,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: i * 0.2,
      });
    });

    /* ---- Gradient blobs — slow drift ---- */
    gsap.utils.toArray('.blob').forEach(function (blob, i) {
      gsap.to(blob, {
        x: i % 2 === 0 ? 40 : -30,
        y: i % 2 === 0 ? -30 : 40,
        duration: 10 + i * 2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    });

    /* ---- Scroll-triggered reveals ---- */
    gsap.utils.toArray('[data-animate="up"]').forEach(function (el) {
      gsap.from(el, {
        opacity: 0,
        y: 32,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%' },
      });
    });

    gsap.utils.toArray('[data-animate-stagger]').forEach(function (group) {
      gsap.from(group.children, {
        opacity: 0,
        y: 28,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power2.out',
        scrollTrigger: { trigger: group, start: 'top 85%' },
      });
    });

    /* ---- Counters (hero fires almost immediately since it's in view; stats-strip fires on scroll) ---- */
    gsap.utils.toArray('[data-counter]').forEach(function (el) {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 95%',
        once: true,
        onEnter: function () { animateCounter(el); },
      });
    });
  });
})();
