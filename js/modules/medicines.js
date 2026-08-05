document.addEventListener('DOMContentLoaded', function () {
  MP.Seed.ensureSeedData();

  const grid = document.getElementById('med-grid');
  const emptyState = document.getElementById('med-empty');
  const modal = document.getElementById('med-modal');
  const form = document.getElementById('med-form');
  const modalTitle = document.getElementById('med-modal-title');

  render();
  wireModal();
  wireCardActions();

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function getMedicines() {
    return MP.Store.get('medicines', []);
  }

  function isLowStock(med) {
    if (!med.totalQty) return false;
    return med.remainingQty <= Math.max(3, Math.round(med.totalQty * 0.2));
  }

  function render() {
    const meds = getMedicines();
    document.getElementById('stat-total').textContent = meds.length;
    document.getElementById('stat-low').textContent = meds.filter(isLowStock).length;
    document.getElementById('stat-doses').textContent = meds.reduce(function (sum, m) { return sum + (m.times || []).length; }, 0);

    if (!meds.length) {
      grid.innerHTML = '';
      emptyState.style.display = 'flex';
      return;
    }
    emptyState.style.display = 'none';

    grid.innerHTML = meds.map(renderCard).join('');
  }

  function renderCard(med) {
    const low = isLowStock(med);
    const pct = med.totalQty ? Math.max(0, Math.min(100, Math.round((med.remainingQty / med.totalQty) * 100))) : 100;
    const times = (med.times || []).map(function (t) { return '<span class="med-time-chip">' + t + '</span>'; }).join('');
    const metaParts = [med.strength, med.form].filter(Boolean).join(' · ');
    return (
      '<div class="med-card glass' + (low ? ' low-stock' : '') + '" data-med-id="' + med.id + '">' +
        '<div class="med-card-top">' +
          '<div style="display:flex;gap:var(--space-3);align-items:flex-start;">' +
            '<div class="med-icon"><i class="fa-solid fa-pills"></i></div>' +
            '<div>' +
              '<div class="med-name">' + escapeHtml(med.name) + '</div>' +
              '<div class="med-meta">' + escapeHtml(metaParts) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="med-card-actions">' +
            '<button data-edit-med="' + med.id + '" aria-label="Edit ' + escapeHtml(med.name) + '"><i class="fa-solid fa-pen"></i></button>' +
            '<button data-delete-med="' + med.id + '" aria-label="Delete ' + escapeHtml(med.name) + '"><i class="fa-solid fa-trash"></i></button>' +
          '</div>' +
        '</div>' +
        (times ? '<div class="med-times">' + times + '</div>' : '') +
        (med.doctor || med.purpose ? '<div class="med-meta">' + [med.purpose, med.doctor ? ('Dr. ' + escapeHtml(med.doctor)).replace('Dr. Dr.', 'Dr.') : ''].filter(Boolean).join(' · ') + '</div>' : '') +
        '<div>' +
          '<div class="med-stock-row"><span>' + med.remainingQty + ' / ' + med.totalQty + ' left</span>' + (low ? '<span style="color:var(--color-danger);font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Low stock</span>' : '') + '</div>' +
          '<div class="med-stock-bar"><div class="med-stock-bar-fill' + (low ? ' low' : '') + '" style="width:' + pct + '%;"></div></div>' +
        '</div>' +
      '</div>'
    );
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function wireModal() {
    document.querySelectorAll('[data-open-add]').forEach(function (btn) {
      btn.addEventListener('click', function () { openModal(null); });
    });
    document.querySelectorAll('[data-close-modal]').forEach(function (btn) {
      btn.addEventListener('click', closeModal);
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hasAttribute('hidden')) closeModal();
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      saveMedicine();
    });
  }

  function wireCardActions() {
    grid.addEventListener('click', function (e) {
      const editBtn = e.target.closest('[data-edit-med]');
      if (editBtn) {
        const med = getMedicines().find(function (m) { return m.id === editBtn.dataset.editMed; });
        if (med) openModal(med);
        return;
      }
      const delBtn = e.target.closest('[data-delete-med]');
      if (delBtn) {
        const meds = getMedicines();
        const med = meds.find(function (m) { return m.id === delBtn.dataset.deleteMed; });
        if (med && window.confirm('Delete "' + med.name + '"? This cannot be undone.')) {
          MP.Store.set('medicines', meds.filter(function (m) { return m.id !== med.id; }));
          MP.EventBus.emit('medicine:deleted', { medicineId: med.id });
          render();
        }
      }
    });
  }

  function openModal(med) {
    form.reset();
    document.getElementById('med-id').value = med ? med.id : '';
    document.getElementById('med-name').value = med ? med.name : '';
    document.getElementById('med-strength').value = med ? med.strength : '';
    document.getElementById('med-form').value = med ? med.form : 'Tablet';
    document.getElementById('med-dosage').value = med ? med.dosageAmount : 1;
    document.getElementById('med-food').value = med ? med.foodTiming : 'after';
    document.getElementById('med-times').value = med && med.times ? med.times.join(', ') : '';
    document.getElementById('med-frequency').value = med ? med.frequency : 'daily';
    document.getElementById('med-start').value = med ? med.startDate : todayISO();
    document.getElementById('med-total').value = med ? med.totalQty : 30;
    document.getElementById('med-remaining').value = med ? med.remainingQty : 30;
    document.getElementById('med-doctor').value = med ? med.doctor : '';
    document.getElementById('med-purpose').value = med ? med.purpose : '';
    modalTitle.textContent = med ? 'Edit Medicine' : 'Add Medicine';
    modal.removeAttribute('hidden');
    document.getElementById('med-name').focus();
  }

  function closeModal() {
    modal.setAttribute('hidden', '');
  }

  function saveMedicine() {
    const id = document.getElementById('med-id').value;
    const times = document.getElementById('med-times').value
      .split(',')
      .map(function (t) { return t.trim(); })
      .filter(Boolean);

    const payload = {
      name: document.getElementById('med-name').value.trim(),
      strength: document.getElementById('med-strength').value.trim(),
      form: document.getElementById('med-form').value,
      dosageAmount: parseFloat(document.getElementById('med-dosage').value) || 0,
      foodTiming: document.getElementById('med-food').value,
      times: times,
      frequency: document.getElementById('med-frequency').value,
      startDate: document.getElementById('med-start').value || todayISO(),
      totalQty: parseInt(document.getElementById('med-total').value, 10) || 0,
      remainingQty: parseInt(document.getElementById('med-remaining').value, 10) || 0,
      doctor: document.getElementById('med-doctor').value.trim(),
      purpose: document.getElementById('med-purpose').value.trim()
    };

    if (!payload.name) return;

    const meds = getMedicines();
    if (id) {
      const idx = meds.findIndex(function (m) { return m.id === id; });
      if (idx !== -1) meds[idx] = Object.assign({}, meds[idx], payload);
      MP.EventBus.emit('medicine:updated', { medicineId: id });
    } else {
      const newMed = Object.assign({ id: MP.Seed.uid('med') }, payload);
      meds.push(newMed);
      MP.EventBus.emit('medicine:added', { medicineId: newMed.id });
    }
    MP.Store.set('medicines', meds);
    closeModal();
    render();
  }
});
