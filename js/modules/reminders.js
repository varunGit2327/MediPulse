document.addEventListener('DOMContentLoaded', function () {
  MP.Seed.ensureSeedData();

  const listEl = document.getElementById('reminders-list');
  const emptyEl = document.getElementById('reminders-empty');
  const tabs = document.querySelectorAll('.reminder-tab');
  let activeTab = 'today';

  wireTabs();
  wireActions();
  render();

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function toISODate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return toISODate(d);
  }

  function dayLabel(dateStr) {
    const today = todayISO();
    if (dateStr === today) return 'Today';
    if (dateStr === addDays(today, -1)) return 'Yesterday';
    if (dateStr === addDays(today, 1)) return 'Tomorrow';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  }

  function getMedicines() {
    return MP.Store.get('medicines', []);
  }

  function getLog() {
    return MP.Store.get('reminderLog', []);
  }

  function findLogEntry(log, medicineId, scheduledAt) {
    return log.find(function (r) { return r.medicineId === medicineId && r.scheduledAt === scheduledAt; });
  }

  /* Build every scheduled dose between startDate and endDate (inclusive) */
  function buildSchedule(startDate, endDate) {
    const meds = getMedicines();
    const log = getLog();
    const now = new Date();
    const items = [];

    meds.forEach(function (med) {
      if (med.frequency === 'asNeeded' || !med.times || !med.times.length) return;
      let d = startDate;
      while (d <= endDate) {
        const include = med.frequency === 'weekly'
          ? new Date(d + 'T00:00:00').getDay() === new Date((med.startDate || d) + 'T00:00:00').getDay()
          : true;
        if (include && (!med.startDate || d >= med.startDate)) {
          med.times.forEach(function (time) {
            const scheduledAt = d + 'T' + time;
            const scheduledDate = new Date(scheduledAt);
            const entry = findLogEntry(log, med.id, scheduledAt);
            let status = 'pending';
            if (entry) {
              status = entry.status;
              if (status === 'snoozed' && entry.snoozeUntil && now >= new Date(entry.snoozeUntil)) {
                status = scheduledDate <= now ? 'missed' : 'pending';
              }
            } else if (scheduledDate <= now) {
              status = 'missed';
            }
            items.push({
              medicineId: med.id,
              name: med.name,
              dosageLabel: [med.dosageAmount ? (med.dosageAmount + ' ' + (med.form || 'dose')) : med.form, med.strength].filter(Boolean).join(' · '),
              date: d,
              time: time,
              scheduledAt: scheduledAt,
              status: status,
              snoozeUntil: entry && entry.snoozeUntil ? entry.snoozeUntil : null
            });
          });
        }
        d = addDays(d, 1);
      }
    });
    items.sort(function (a, b) { return a.scheduledAt.localeCompare(b.scheduledAt); });
    return items;
  }

  function render() {
    const today = todayISO();
    let items, groupOrder;

    if (activeTab === 'today') {
      items = buildSchedule(today, today);
      groupOrder = 'asc';
    } else if (activeTab === 'upcoming') {
      items = buildSchedule(addDays(today, 1), addDays(today, 6));
      groupOrder = 'asc';
    } else {
      items = buildSchedule(addDays(today, -6), addDays(today, -1)).reverse();
      groupOrder = 'desc';
    }

    renderStats();

    if (!items.length) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'flex';
      return;
    }
    emptyEl.style.display = 'none';

    const groups = {};
    const order = [];
    items.forEach(function (item) {
      if (!groups[item.date]) { groups[item.date] = []; order.push(item.date); }
      groups[item.date].push(item);
    });
    if (groupOrder === 'desc') order.sort().reverse(); else order.sort();

    listEl.innerHTML = order.map(function (date) {
      return '<div class="reminder-day-group">' +
        '<div class="reminder-day-heading"><i class="fa-regular fa-calendar"></i> ' + dayLabel(date) + '</div>' +
        groups[date].map(renderRow).join('') +
        '</div>';
    }).join('');
  }

  function renderRow(item) {
    const statusLabelMap = { taken: 'Taken', missed: 'Missed', skipped: 'Skipped', snoozed: 'Snoozed', pending: 'Upcoming' };
    let statusLabel = statusLabelMap[item.status] || item.status;
    if (item.status === 'snoozed' && item.snoozeUntil) {
      const t = new Date(item.snoozeUntil);
      statusLabel = 'Snoozed until ' + pad(t.getHours()) + ':' + pad(t.getMinutes());
    }

    const canAct = item.status === 'pending' || item.status === 'missed' || item.status === 'snoozed';
    const actions = canAct
      ? '<div class="reminder-row-actions">' +
          '<button data-take="' + item.medicineId + '" data-scheduled="' + item.scheduledAt + '" aria-label="Mark taken"><i class="fa-solid fa-check"></i></button>' +
          '<button data-skip="' + item.medicineId + '" data-scheduled="' + item.scheduledAt + '" aria-label="Skip dose"><i class="fa-solid fa-forward"></i></button>' +
          '<button data-snooze="' + item.medicineId + '" data-scheduled="' + item.scheduledAt + '" aria-label="Snooze 15 minutes"><i class="fa-solid fa-clock"></i></button>' +
        '</div>'
      : '<div class="reminder-row-actions">' +
          '<button data-undo="' + item.medicineId + '" data-scheduled="' + item.scheduledAt + '" aria-label="Undo"><i class="fa-solid fa-rotate-left"></i></button>' +
        '</div>';

    return '<div class="reminder-row glass">' +
      '<span class="reminder-row-time">' + item.time + '</span>' +
      '<span class="reminder-row-dot ' + item.status + '"></span>' +
      '<span class="reminder-row-info"><b>' + escapeHtml(item.name) + '</b><span>' + escapeHtml(item.dosageLabel) + '</span></span>' +
      '<span class="reminder-row-status ' + item.status + '">' + statusLabel + '</span>' +
      actions +
      '</div>';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderStats() {
    const today = todayISO();
    const now = new Date();
    const todayItems = buildSchedule(today, today).filter(function (i) { return new Date(i.scheduledAt) <= now; });
    const takenToday = todayItems.filter(function (i) { return i.status === 'taken'; }).length;
    const adherence = todayItems.length ? Math.round((takenToday / todayItems.length) * 100) : 100;
    document.getElementById('stat-adherence').textContent = adherence + '%';

    const weekItems = buildSchedule(addDays(today, -6), today);
    const missed = weekItems.filter(function (i) { return i.status === 'missed'; }).length;
    document.getElementById('stat-missed').textContent = missed;

    let streak = 0;
    let d = weekItems.some(function (i) { return i.date === today; }) && allTakenForDay(today) ? today : addDays(today, -1);
    for (let i = 0; i < 60; i++) {
      const dayItems = buildSchedule(d, d);
      if (!dayItems.length) { d = addDays(d, -1); continue; }
      const allTaken = dayItems.every(function (i) { return i.status === 'taken'; });
      if (!allTaken) break;
      streak++;
      d = addDays(d, -1);
    }
    document.getElementById('stat-streak').textContent = streak + (streak === 1 ? ' day' : ' days');

    function allTakenForDay(dateStr) {
      const dayItems = buildSchedule(dateStr, dateStr);
      return dayItems.length > 0 && dayItems.every(function (i) { return i.status === 'taken'; });
    }
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

  function wireActions() {
    listEl.addEventListener('click', function (e) {
      const takeBtn = e.target.closest('[data-take]');
      const skipBtn = e.target.closest('[data-skip]');
      const snoozeBtn = e.target.closest('[data-snooze]');
      const undoBtn = e.target.closest('[data-undo]');

      if (takeBtn) { setStatus(takeBtn.dataset.take, takeBtn.dataset.scheduled, 'taken'); return; }
      if (skipBtn) { setStatus(skipBtn.dataset.skip, skipBtn.dataset.scheduled, 'skipped'); return; }
      if (snoozeBtn) { snooze(snoozeBtn.dataset.snooze, snoozeBtn.dataset.scheduled); return; }
      if (undoBtn) { removeLogEntry(undoBtn.dataset.undo, undoBtn.dataset.scheduled); return; }
    });
  }

  function setStatus(medicineId, scheduledAt, status) {
    const log = getLog();
    const existing = findLogEntry(log, medicineId, scheduledAt);
    if (existing) {
      existing.status = status;
      existing.snoozeUntil = null;
      existing.actionedAt = new Date().toISOString();
    } else {
      log.push({ id: MP.Seed.uid('log'), medicineId: medicineId, scheduledAt: scheduledAt, status: status, actionedAt: new Date().toISOString() });
    }
    MP.Store.set('reminderLog', log);
    MP.EventBus.emit('medicine:' + status, { medicineId: medicineId });
    render();
  }

  function snooze(medicineId, scheduledAt) {
    const log = getLog();
    const existing = findLogEntry(log, medicineId, scheduledAt);
    const snoozeUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    if (existing) {
      existing.status = 'snoozed';
      existing.snoozeUntil = snoozeUntil;
      existing.actionedAt = new Date().toISOString();
    } else {
      log.push({ id: MP.Seed.uid('log'), medicineId: medicineId, scheduledAt: scheduledAt, status: 'snoozed', snoozeUntil: snoozeUntil, actionedAt: new Date().toISOString() });
    }
    MP.Store.set('reminderLog', log);
    render();
  }

  function removeLogEntry(medicineId, scheduledAt) {
    const log = getLog().filter(function (r) { return !(r.medicineId === medicineId && r.scheduledAt === scheduledAt); });
    MP.Store.set('reminderLog', log);
    render();
  }
});
