document.addEventListener('DOMContentLoaded', function () {
  MP.Seed.ensureSeedData();

  const listEl = document.getElementById('appt-list');
  const emptyEl = document.getElementById('appt-empty');
  const modal = document.getElementById('appt-modal');
  const form = document.getElementById('appt-form');
  const modalTitle = document.getElementById('appt-modal-title');
  const tabs = document.querySelectorAll('.reminder-tab');
  let activeTab = 'upcoming';

  wireTabs();
  wireModal();
  wireListActions();
  render();

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function getAppointments() {
    return MP.Store.get('appointments', []);
  }

  function scheduledAt(appt) {
    return appt.date + 'T' + appt.time;
  }

  function isPast(appt) {
    // an upcoming-status appointment whose date/time has already elapsed still shows as "past"
    // so the tabs reflect reality even if the user never manually marked it complete
    return scheduledAt(appt) < nowISO() || appt.status === 'completed' || appt.status === 'cancelled';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatMonth(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' });
  }

  function render() {
    const appts = getAppointments();
    const upcoming = appts.filter(function (a) { return !isPast(a); }).sort(function (a, b) { return scheduledAt(a).localeCompare(scheduledAt(b)); });
    const past = appts.filter(isPast).sort(function (a, b) { return scheduledAt(b).localeCompare(scheduledAt(a)); });

    document.getElementById('stat-upcoming').textContent = upcoming.length;
    document.getElementById('stat-completed').textContent = appts.filter(function (a) { return a.status === 'completed'; }).length;

    const next = upcoming[0];
    document.getElementById('stat-next').textContent = next ? next.doctorName : '—';
    document.getElementById('stat-next-sub').textContent = next ? (next.department ? next.department + ' · ' : '') + next.date + ' at ' + next.time : 'No upcoming visits';

    const items = activeTab === 'upcoming' ? upcoming : past;
    if (!items.length) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'flex';
      return;
    }
    emptyEl.style.display = 'none';
    listEl.innerHTML = items.map(renderCard).join('');
  }

  function renderCard(appt) {
    const status = appt.status || 'upcoming';
    const day = new Date(appt.date + 'T00:00:00').getDate();
    const canAct = status === 'upcoming';
    const actions = (canAct
      ? '<button data-complete="' + appt.id + '" aria-label="Mark completed"><i class="fa-solid fa-check"></i></button>' +
        '<button data-cancel="' + appt.id + '" aria-label="Cancel appointment"><i class="fa-solid fa-ban"></i></button>'
      : '') +
      '<button data-edit-appt="' + appt.id + '" aria-label="Edit appointment"><i class="fa-solid fa-pen"></i></button>' +
      '<button data-delete-appt="' + appt.id + '" aria-label="Delete appointment"><i class="fa-solid fa-trash"></i></button>';

    return '<div class="appt-card glass ' + status + '">' +
      '<div class="appt-date-block"><b>' + day + '</b><span>' + formatMonth(appt.date) + '</span></div>' +
      '<div class="appt-info">' +
        '<b>' + escapeHtml(appt.doctorName) + '</b>' +
        '<div class="appt-meta">' + escapeHtml([appt.department, appt.hospital].filter(Boolean).join(' · ')) + ' — ' + appt.date + ' at ' + appt.time + '</div>' +
        (appt.notes ? '<div class="appt-notes">' + escapeHtml(appt.notes) + '</div>' : '') +
      '</div>' +
      '<span class="appt-status ' + status + '">' + status.charAt(0).toUpperCase() + status.slice(1) + '</span>' +
      '<div class="appt-actions">' + actions + '</div>' +
      '</div>';
  }

  function wireTabs() {
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        activeTab = tab.dataset.tab;
        render();
      });
    });
  }

  function wireListActions() {
    listEl.addEventListener('click', function (e) {
      const completeBtn = e.target.closest('[data-complete]');
      const cancelBtn = e.target.closest('[data-cancel]');
      const editBtn = e.target.closest('[data-edit-appt]');
      const deleteBtn = e.target.closest('[data-delete-appt]');

      if (completeBtn) { updateStatus(completeBtn.dataset.complete, 'completed'); return; }
      if (cancelBtn) { updateStatus(cancelBtn.dataset.cancel, 'cancelled'); return; }
      if (editBtn) {
        const appt = getAppointments().find(function (a) { return a.id === editBtn.dataset.editAppt; });
        if (appt) openModal(appt);
        return;
      }
      if (deleteBtn) {
        const appts = getAppointments();
        const appt = appts.find(function (a) { return a.id === deleteBtn.dataset.deleteAppt; });
        if (appt && window.confirm('Delete appointment with ' + appt.doctorName + '?')) {
          MP.Store.set('appointments', appts.filter(function (a) { return a.id !== appt.id; }));
          render();
        }
      }
    });
  }

  function updateStatus(id, status) {
    const appts = getAppointments();
    const idx = appts.findIndex(function (a) { return a.id === id; });
    if (idx === -1) return;
    appts[idx].status = status;
    MP.Store.set('appointments', appts);
    MP.EventBus.emit('appointment:' + status, { appointmentId: id });
    render();
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
      saveAppointment();
    });
  }

  function openModal(appt) {
    form.reset();
    document.getElementById('appt-id').value = appt ? appt.id : '';
    document.getElementById('appt-doctor').value = appt ? appt.doctorName : '';
    document.getElementById('appt-department').value = appt ? appt.department : '';
    document.getElementById('appt-hospital').value = appt ? appt.hospital : '';
    document.getElementById('appt-date').value = appt ? appt.date : todayISO();
    document.getElementById('appt-time').value = appt ? appt.time : '10:00';
    document.getElementById('appt-notes').value = appt ? (appt.notes || '') : '';
    modalTitle.textContent = appt ? 'Edit Appointment' : 'Add Appointment';
    modal.removeAttribute('hidden');
    document.getElementById('appt-doctor').focus();
  }

  function closeModal() {
    modal.setAttribute('hidden', '');
  }

  function saveAppointment() {
    const id = document.getElementById('appt-id').value;
    const payload = {
      doctorName: document.getElementById('appt-doctor').value.trim(),
      department: document.getElementById('appt-department').value.trim(),
      hospital: document.getElementById('appt-hospital').value.trim(),
      date: document.getElementById('appt-date').value,
      time: document.getElementById('appt-time').value,
      notes: document.getElementById('appt-notes').value.trim()
    };
    if (!payload.doctorName || !payload.date || !payload.time) return;

    const appts = getAppointments();
    if (id) {
      const idx = appts.findIndex(function (a) { return a.id === id; });
      if (idx !== -1) appts[idx] = Object.assign({}, appts[idx], payload);
      MP.EventBus.emit('appointment:updated', { appointmentId: id });
    } else {
      const newAppt = Object.assign({ id: MP.Seed.uid('appt'), status: 'upcoming' }, payload);
      appts.push(newAppt);
      MP.EventBus.emit('appointment:added', { appointmentId: newAppt.id });
    }
    MP.Store.set('appointments', appts);
    closeModal();
    render();
  }
});
