document.addEventListener('DOMContentLoaded', function () {
  /* ---- Theme toggle (shared across every internal page) ---- */
  const root = document.documentElement;
  const themeToggle = document.querySelector('[data-theme-toggle]');
  let stored = null;
  try { stored = localStorage.getItem('medipulse:theme'); } catch (e) { /* opaque origin / storage blocked */ }
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.setAttribute('data-theme', stored || (systemPrefersDark ? 'dark' : 'light'));
  updateThemeIcon();

  /* ---- Font scale (accessibility, shared across every page) ---- */
  let storedFontScale = null;
  try { storedFontScale = localStorage.getItem('medipulse:fontScale'); } catch (e) { /* ignore */ }
  root.setAttribute('data-font-scale', storedFontScale || 'normal');

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('medipulse:theme', next); } catch (e) { /* ignore */ }
      updateThemeIcon();
    });
  }

  function updateThemeIcon() {
    if (!themeToggle) return;
    const icon = themeToggle.querySelector('i');
    if (icon) icon.className = root.getAttribute('data-theme') === 'dark' ? 'fa-solid fa-sun' : 'fa-regular fa-moon';
  }

  /* ---- Mobile sidebar ---- */
  const sidebar = document.querySelector('[data-sidebar]');
  const sidebarToggle = document.querySelector('[data-sidebar-toggle]');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  /* ---- Active profile avatar initial ---- */
  if (window.MP && MP.Store) {
    const profiles = MP.Store.get('profiles', []);
    const activeId = MP.Store.get('activeProfileId');
    const active = profiles.find(function (p) { return p.id === activeId; }) || profiles[0];
    const avatarEl = document.querySelector('[data-active-avatar]');
    if (avatarEl && active) avatarEl.textContent = active.avatarInitials || active.name.charAt(0).toUpperCase();
  }

  /* ---- Clicking the avatar jumps to Family Profiles to switch ---- */
  const avatarBtn = document.querySelector('.profile-avatar-btn');
  if (avatarBtn) {
    avatarBtn.addEventListener('click', function () {
      const onFamilyPage = /family\.html$/.test(window.location.pathname);
      if (!onFamilyPage) window.location.href = 'family.html';
    });
  }
});
