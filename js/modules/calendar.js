document.addEventListener('DOMContentLoaded', function () {
  MP.Seed.ensureSeedData();

  const grid = document.getElementById('cal-grid');
  const monthLabel = document.getElementById('cal-month-label');
  let viewDate = new Date();
  let selectedDate = todayISO();

  wireNav();
  wireDetailActions();
  render();

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function toISODate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayISO() { return toISODate(new Date()); }
  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return toISODate(d);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ===== Data helpers (mirrors reminders.js logic, scoped to a single date) ===== */
  function getMedicines() { return MP.Store.get('medicines', []); }
  function getLog() { return MP.Store.get('reminderLog', []); }
  function getAppointments() { return MP.Store.get('appointments', []); }

  function findLogEntry(log, medicineId, scheduledAt) {
    return log.find(function (r) { return r.medicineId === medicineId && r.scheduledAt === scheduledAt; });
  }

  function dosesForDate(dateStr) {
    const meds = getMedicines();
    const log = getLog();
    const now = new Date();
    const items = [];
    meds.forEach(function (med) {
      if (med.frequency === 'asNeeded' || !med.times || !med.times.length) return;
      if (med.startDate && dateStr < med.startDate) return;
      const include = med.frequency === 'weekly'
        ? new Date(dateStr + 'T00:00:00').getDay() === new Date((med.startDate || dateStr) + 'T00:00:00').getDay()
        : true;
      if (!include) return;
      med.times.forEach(function (time) {
        const scheduledAt = dateStr + 'T' + time;
        const scheduledDateObj = new Date(scheduledAt);
        const entry = findLogEntry(log, med.id, scheduledAt);
        let status = 'pending';
        if (entry) {
          status = entry.status;
          if (status === 'snoozed' && entry.snoozeUntil && now >= new Date(entry.snoozeUntil)) {
            status = scheduledDateObj <= now ? 'missed' : 'pending';
          }
        } else if (scheduledDateObj <= now) {
          status = 'missed';
        }
        items.push({ medicineId: med.id, name: med.name, time: time, scheduledAt: scheduledAt, status: status });
      });
    });
    items.sort(function (a, b) { return a.time.localeCompare(b.time); });
    return items;
  }

  function appointmentsForDate(dateStr) {
    return getAppointments().filter(function (a) { return a.date === dateStr; })
      .sort(function (a, b) { return a.time.localeCompare(b.time); });
  }

  /* ===== Month grid render ===== */
  function render() {
    monthLabel.textContent = viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(year, month, 1 - startOffset);

    let html = '';
    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + i);
      const dateStr = toISODate(cellDate);
      const inMonth = cellDate.getMonth() === month;
      const doseCount = dosesForDate(dateStr).length;
      const apptCount = appointmentsForDate(dateStr).length;

      const classes = ['calendar-day'];
      if (!inMonth) classes.push('other-month');
      if (dateStr === todayISO()) classes.push('today');
      if (dateStr === selectedDate) classes.push('selected');

      html += '<div class="' + classes.join(' ') + '" data-cal-day="' + dateStr + '">' +
        '<span class="calendar-day-num">' + cellDate.getDate() + '</span>' +
        (doseCount || apptCount
          ? '<div class="calendar-day-dots">' +
              (doseCount ? '<span class="calendar-day-dot med"></span>' : '') +
              (apptCount ? '<span class="calendar-day-dot appt"></span>' : '') +
              '<span class="calendar-day-count">' + (doseCount + apptCount) + '</span>' +
            '</div>'
          : '') +
        '</div>';
    }
    grid.innerHTML = html;

    grid.querySelectorAll('[data-cal-day]').forEach(function (cell) {
      cell.addEventListener('click', function () {
        selectedDate = cell.dataset.calDay;
        render();
        renderDetail();
      });
    });

    renderDetail();
  }

  function dayHeading(dateStr) {
    const today = todayISO();
    if (dateStr === today) return 'Today · ' + new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function renderDetail() {
    document.getElementById('cal-detail-heading').innerHTML = '<i class="fa-regular fa-calendar"></i> ' + dayHeading(selectedDate);
    const doses = dosesForDate(selectedDate);
    const appts = appointmentsForDate(selectedDate);
    const empty = document.getElementById('cal-detail-empty');
    const list = document.getElementById('cal-detail-list');

    if (!doses.length && !appts.length) {
      empty.style.display = 'flex';
      list.innerHTML = '';
      return;
    }
    empty.style.display = 'none';

    let html = '';
    appts.forEach(function (a) {
      html += '<div class="cal-detail-row">' +
        '<div class="cal-detail-icon appt"><i class="fa-solid fa-stethoscope"></i></div>' +
        '<div class="cal-detail-info"><b>' + escapeHtml(a.doctorName) + '</b><span>' + a.time + (a.department ? ' · ' + escapeHtml(a.department) : '') + '</span></div>' +
        '<span class="cal-detail-status ' + (a.status || 'upcoming') + '">' + (a.status || 'upcoming').replace(/^./, function (c) { return c.toUpperCase(); }) + '</span>' +
        '</div>';
    });
    doses.forEach(function (d) {
      const canAct = d.status === 'pending' || d.status === 'missed';
      html += '<div class="cal-detail-row">' +
        '<div class="cal-detail-icon"><i class="fa-solid fa-pills"></i></div>' +
        '<div class="cal-detail-info"><b>' + escapeHtml(d.name) + '</b><span>' + d.time + '</span></div>' +
        '<span class="cal-detail-status ' + d.status + '">' + (d.status === 'pending' ? 'Upcoming' : d.status.replace(/^./, function (c) { return c.toUpperCase(); })) + '</span>' +
        (canAct ? '<div class="cal-detail-actions">' +
            '<button data-cal-take="' + d.medicineId + '" data-scheduled="' + d.scheduledAt + '" aria-label="Mark taken"><i class="fa-solid fa-check"></i></button>' +
            '<button data-cal-skip="' + d.medicineId + '" data-scheduled="' + d.scheduledAt + '" aria-label="Skip"><i class="fa-solid fa-forward"></i></button>' +
          '</div>' : '<div class="cal-detail-actions"></div>') +
        '</div>';
    });
    list.innerHTML = html;
  }

  function wireDetailActions() {
    document.getElementById('cal-detail-list').addEventListener('click', function (e) {
      const takeBtn = e.target.closest('[data-cal-take]');
      const skipBtn = e.target.closest('[data-cal-skip]');
      if (!takeBtn && !skipBtn) return;
      const btn = takeBtn || skipBtn;
      const status = takeBtn ? 'taken' : 'skipped';
      const log = getLog();
      const existing = findLogEntry(log, btn.dataset.calTake || btn.dataset.calSkip, btn.dataset.scheduled);
      if (existing) {
        existing.status = status;
        existing.actionedAt = new Date().toISOString();
      } else {
        log.push({ id: MP.Seed.uid('log'), medicineId: btn.dataset.calTake || btn.dataset.calSkip, scheduledAt: btn.dataset.scheduled, status: status, actionedAt: new Date().toISOString() });
      }
      MP.Store.set('reminderLog', log);
      render();
    });
  }

  function wireNav() {
    document.querySelector('[data-cal-prev]').addEventListener('click', function () {
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
      render();
    });
    document.querySelector('[data-cal-next]').addEventListener('click', function () {
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
      render();
    });
    document.querySelector('[data-cal-today]').addEventListener('click', function () {
      viewDate = new Date();
      selectedDate = todayISO();
      render();
    });
  }
});
