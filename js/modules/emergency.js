document.addEventListener('DOMContentLoaded', function () {
  MP.Seed.ensureSeedData();

  const infoModal = document.getElementById('info-modal');
  const infoForm = document.getElementById('info-form');
  const contactModal = document.getElementById('contact-modal');
  const contactForm = document.getElementById('contact-form');
  const contactModalTitle = document.getElementById('contact-modal-title');

  wireModals();
  render();

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function getInfo() { return MP.Store.get('emergencyInfo', { bloodGroup: '', allergies: [], conditions: [] }); }
  function getContacts() { return MP.Store.get('emergencyContacts', []); }
  function getActiveProfileName() {
    const profiles = MP.Store.get('profiles', []);
    const activeId = MP.Store.get('activeProfileId');
    const p = profiles.find(function (pr) { return pr.id === activeId; });
    return p ? p.name : 'You';
  }

  function render() {
    const info = getInfo();
    document.getElementById('ec-name').textContent = getActiveProfileName();
    document.getElementById('ec-blood').textContent = info.bloodGroup || '—';

    const allergyEl = document.getElementById('ec-allergies');
    allergyEl.innerHTML = info.allergies && info.allergies.length
      ? info.allergies.map(function (a) { return '<span class="chip">' + escapeHtml(a) + '</span>'; }).join('')
      : '<span class="emergency-empty">None recorded</span>';

    const conditionEl = document.getElementById('ec-conditions');
    conditionEl.innerHTML = info.conditions && info.conditions.length
      ? info.conditions.map(function (c) { return '<span class="chip">' + escapeHtml(c) + '</span>'; }).join('')
      : '<span class="emergency-empty">None recorded</span>';

    const meds = MP.Store.get('medicines', []);
    const medsEl = document.getElementById('ec-medicines');
    medsEl.innerHTML = meds.length
      ? '<div class="med-pill-row">' + meds.map(function (m) { return '<span class="med-pill">' + escapeHtml(m.name) + (m.strength ? ' (' + escapeHtml(m.strength) + ')' : '') + '</span>'; }).join('') + '</div>'
      : '<span class="emergency-empty">None recorded</span>';

    renderContacts();
  }

  function renderContacts() {
    const contacts = getContacts();
    const listEl = document.getElementById('ec-contacts');
    const emptyEl = document.getElementById('ec-contacts-empty');
    if (!contacts.length) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    listEl.innerHTML = contacts.map(function (c) {
      const telHref = 'tel:' + c.phone.replace(/[^\d+]/g, '');
      return '<div class="emergency-contact-row">' +
        '<div class="emergency-contact-info"><b>' + escapeHtml(c.name) + '</b><span>' + escapeHtml(c.relation || '') + (c.relation ? ' · ' : '') + escapeHtml(c.phone) + '</span></div>' +
        '<div class="emergency-contact-actions">' +
          '<a href="' + telHref + '" aria-label="Call ' + escapeHtml(c.name) + '"><i class="fa-solid fa-phone"></i></a>' +
          '<button data-edit-contact="' + c.id + '" aria-label="Edit contact"><i class="fa-solid fa-pen"></i></button>' +
          '<button data-delete-contact="' + c.id + '" aria-label="Delete contact"><i class="fa-solid fa-trash"></i></button>' +
        '</div>' +
      '</div>';
    }).join('');

    listEl.querySelectorAll('[data-edit-contact]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const c = getContacts().find(function (c) { return c.id === btn.dataset.editContact; });
        if (c) openContactModal(c);
      });
    });
    listEl.querySelectorAll('[data-delete-contact]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const contacts = getContacts();
        const c = contacts.find(function (c) { return c.id === btn.dataset.deleteContact; });
        if (c && window.confirm('Delete emergency contact "' + c.name + '"?')) {
          MP.Store.set('emergencyContacts', contacts.filter(function (x) { return x.id !== c.id; }));
          renderContacts();
        }
      });
    });
  }

  /* ===== Info modal (blood group / allergies / conditions) ===== */
  function openInfoModal() {
    const info = getInfo();
    document.getElementById('info-blood').value = info.bloodGroup || '';
    document.getElementById('info-allergies').value = (info.allergies || []).join(', ');
    document.getElementById('info-conditions').value = (info.conditions || []).join(', ');
    infoModal.removeAttribute('hidden');
  }

  function saveInfo() {
    const allergies = document.getElementById('info-allergies').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    const conditions = document.getElementById('info-conditions').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    MP.Store.set('emergencyInfo', { bloodGroup: document.getElementById('info-blood').value, allergies: allergies, conditions: conditions });
    infoModal.setAttribute('hidden', '');
    render();
  }

  /* ===== Contact modal ===== */
  function openContactModal(contact) {
    contactForm.reset();
    document.getElementById('contact-id').value = contact ? contact.id : '';
    document.getElementById('contact-name').value = contact ? contact.name : '';
    document.getElementById('contact-relation').value = contact ? contact.relation : '';
    document.getElementById('contact-phone').value = contact ? contact.phone : '';
    contactModalTitle.textContent = contact ? 'Edit Emergency Contact' : 'Add Emergency Contact';
    contactModal.removeAttribute('hidden');
    document.getElementById('contact-name').focus();
  }

  function saveContact() {
    const id = document.getElementById('contact-id').value;
    const name = document.getElementById('contact-name').value.trim();
    const phone = document.getElementById('contact-phone').value.trim();
    if (!name || !phone) return;
    const relation = document.getElementById('contact-relation').value.trim();

    const contacts = getContacts();
    if (id) {
      const idx = contacts.findIndex(function (c) { return c.id === id; });
      if (idx !== -1) contacts[idx] = Object.assign({}, contacts[idx], { name: name, relation: relation, phone: phone });
    } else {
      contacts.push({ id: MP.Seed.uid('contact'), name: name, relation: relation, phone: phone });
    }
    MP.Store.set('emergencyContacts', contacts);
    contactModal.setAttribute('hidden', '');
    renderContacts();
  }

  function wireModals() {
    document.querySelector('[data-open-info]').addEventListener('click', openInfoModal);
    document.querySelector('[data-open-contact]').addEventListener('click', function () { openContactModal(null); });
    document.querySelector('[data-print-emergency]').addEventListener('click', function () { window.print(); });

    document.querySelectorAll('[data-close-modal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        infoModal.setAttribute('hidden', '');
        contactModal.setAttribute('hidden', '');
      });
    });
    [infoModal, contactModal].forEach(function (m) {
      m.addEventListener('click', function (e) { if (e.target === m) m.setAttribute('hidden', ''); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!infoModal.hasAttribute('hidden')) infoModal.setAttribute('hidden', '');
      if (!contactModal.hasAttribute('hidden')) contactModal.setAttribute('hidden', '');
    });

    infoForm.addEventListener('submit', function (e) { e.preventDefault(); saveInfo(); });
    contactForm.addEventListener('submit', function (e) { e.preventDefault(); saveContact(); });
  }
});
