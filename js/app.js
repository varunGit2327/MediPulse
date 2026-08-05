(function () {
  /* ---- Theme toggle (persists to localStorage, respects OS preference on first visit) ---- */
  const root = document.documentElement;
  const themeToggle = document.querySelector('[data-theme-toggle]');
  let stored = null;
  try { stored = localStorage.getItem('medipulse:theme'); } catch (e) { /* opaque origin / storage blocked — fall through to system preference */ }
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = stored || (systemPrefersDark ? 'dark' : 'light');
  root.setAttribute('data-theme', initialTheme);
  updateThemeIcon(initialTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      const current = root.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('medipulse:theme', next); } catch (e) { /* ignore — theme still applies for this session */ }
      updateThemeIcon(next);
    });
  }

  function updateThemeIcon(theme) {
    if (!themeToggle) return;
    const icon = themeToggle.querySelector('i');
    if (!icon) return;
    icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-regular fa-moon';
  }

  /* ---- Mobile nav ---- */
  const navToggle = document.querySelector('[data-nav-toggle]');
  const navLinks = document.querySelector('[data-nav-links]');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      const isOpen = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
      navToggle.querySelector('i').className = isOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    });
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.querySelector('i').className = 'fa-solid fa-bars';
      });
    });
  }

  /* ---- Sticky nav shadow on scroll ---- */
  const nav = document.querySelector('.nav');
  window.addEventListener('scroll', function () {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 12);
  });

  /* ---- FAQ accordion ---- */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (!question || !answer) return;
    question.addEventListener('click', function () {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (openItem) {
        if (openItem !== item) {
          openItem.classList.remove('open');
          openItem.querySelector('.faq-answer').style.maxHeight = null;
        }
      });
      item.classList.toggle('open', !isOpen);
      answer.style.maxHeight = !isOpen ? answer.scrollHeight + 'px' : null;
    });
  });
})();
