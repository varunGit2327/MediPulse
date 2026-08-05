document.addEventListener('DOMContentLoaded', function () {
  MP.Seed.ensureSeedData();

  const grid = document.getElementById('family-grid');
  const modal = document.getElementById('family-modal');
  const form = document.getElementById('family-form');
  const modalTitle = document.getElementById('family-modal-title');

  wireModal();
  wireGridActions();
  render();

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function getProfiles() { return MP.Store.get('profiles', []); }
  function getActiveId() { return MP.Store.get('activeProfileId'); }

  function initialsFor(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function render() {
    const profiles = getProfiles();
    const activeId = getActiveId();
    grid.innerHTML = profiles.map(function (p) { return renderCard(p, p.id === activeId); }).join('');
  }

  function renderCard(p, isActive) {
    return '<div class="dash-card glass family-card' + (isActive ? ' active' : '') + '" data-fam-id="' + p.id + '">' +
      (isActive ? '<span class="family-active-badge"><i class="fa-solid fa-circle-check"></i> Active</span>' : '') +
      '<div class="family-avatar">' + escapeHtml(p.avatarInitials || initialsFor(p.name)) + '</div>' +
      '<div class="family-name">' + escapeHtml(p.name) + '</div>' +
      '<div class="family-relation">' + escapeHtml(p.relation || '') + '</div>' +
      (isActive
        ? '<button class="btn btn-ghost" disabled style="margin-top:var(--space-2);">Currently Viewing</button>'
        : '<button class="btn btn-primary" data-switch-fam="' + p.id + '" style="margin-top:var(--space-2);">Switch To</button>') +
      '<div class="family-card-actions">' +
        '<button data-edit-fam="' + p.id + '" aria-label="Edit ' + escapeHtml(p.name) + '"><i class="fa-solid fa-pen"></i></button>' +
        '<button data-delete-fam="' + p.id + '" aria-label="Delete ' + escapeHtml(p.name) + '"><i class="fa-solid fa-trash"></i></button>' +
      '</div>' +
      '</div>';
  }

  function wireGridActions() {
    grid.addEventListener('click', function (e) {
      const switchBtn = e.target.closest('[data-switch-fam]');
      const editBtn = e.target.closest('[data-edit-fam]');
      const deleteBtn = e.target.closest('[data-delete-fam]');

      if (switchBtn) { switchProfile(switchBtn.dataset.switchFam); return; }
      if (editBtn) {
        const p = getProfiles().find(function (p) { return p.id === editBtn.dataset.editFam; });
        if (p) openModal(p);
        return;
      }
      if (deleteBtn) { deleteProfile(deleteBtn.dataset.deleteFam); return; }
    });
  }

  function switchProfile(id) {
    MP.Store.set('activeProfileId', id);
    render();
    const avatarEl = document.querySelector('[data-active-avatar]');
    const p = getProfiles().find(function (p) { return p.id === id; });
    if (avatarEl && p) avatarEl.textContent = p.avatarInitials || initialsFor(p.name);
  }

  function deleteProfile(id) {
    const profiles = getProfiles();
    if (profiles.length <= 1) {
      window.alert("You need at least one profile — add another before deleting this one.");
      return;
    }
    const p = profiles.find(function (p) { return p.id === id; });
    if (!p || !window.confirm('Delete profile "' + p.name + '"? All of their medicines, logs, and history will be permanently removed.')) return;

    const remaining = profiles.filter(function (pr) { return pr.id !== id; });
    MP.Store.set('profiles', remaining);

    if (getActiveId() === id) {
      MP.Store.set('activeProfileId', remaining[0].id);
    }

    // Clean up that profile's namespaced data (medicines, reminderLog, vitalsLog, etc.)
    if (MP.Store.isPersistent()) {
      const prefix = 'medipulse:' + id + ':';
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(prefix) === 0) toRemove.push(k);
      }
      toRemove.forEach(function (k) { localStorage.removeItem(k); });
    }

    render();
    const avatarEl = document.querySelector('[data-active-avatar]');
    const active = getProfiles().find(function (pr) { return pr.id === getActiveId(); });
    if (avatarEl && active) avatarEl.textContent = active.avatarInitials || initialsFor(active.name);
  }

  function wireModal() {
    document.querySelectorAll('[data-open-add]').forEach(function (btn) {
      btn.addEventListener('click', function () { openModal(null); });
    });
    document.querySelectorAll('[data-close-modal]').forEach(function (btn) {
      btn.addEventListener('click', closeModal);
    });
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hasAttribute('hidden')) closeModal(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      saveProfile();
    });
  }

  function openModal(p) {
    form.reset();
    document.getElementById('fam-id').value = p ? p.id : '';
    document.getElementById('fam-name').value = p ? p.name : '';
    document.getElementById('fam-relation').value = p ? p.relation : 'Self';
    document.getElementById('fam-initials').value = p ? (p.avatarInitials || '') : '';
    modalTitle.textContent = p ? 'Edit Profile' : 'Add Family Member';
    modal.removeAttribute('hidden');
    document.getElementById('fam-name').focus();
  }

  function closeModal() {
    modal.setAttribute('hidden', '');
  }

  function saveProfile() {
    const id = document.getElementById('fam-id').value;
    const name = document.getElementById('fam-name').value.trim();
    if (!name) return;
    const relation = document.getElementById('fam-relation').value;
    const initials = document.getElementById('fam-initials').value.trim() || initialsFor(name);

    const profiles = getProfiles();
    if (id) {
      const idx = profiles.findIndex(function (p) { return p.id === id; });
      if (idx !== -1) profiles[idx] = Object.assign({}, profiles[idx], { name: name, relation: relation, avatarInitials: initials });
    } else {
      profiles.push({ id: MP.Seed.uid('profile'), name: name, relation: relation, avatarInitials: initials, isPrimary: false });
    }
    MP.Store.set('profiles', profiles);
    closeModal();
    render();

    if (id === getActiveId()) {
      const avatarEl = document.querySelector('[data-active-avatar]');
      if (avatarEl) avatarEl.textContent = initials;
    }
  }
});
