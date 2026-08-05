document.addEventListener('DOMContentLoaded', function () {
  MP.Seed.ensureSeedData();
  renderGreeting();
  renderTimeline();
  renderNextMedicine();
  renderWater();
  renderScore();
  renderAppointment();
  wireActions();

  function activeProfile() {
    const profiles = MP.Store.get('profiles', []);
    const id = MP.Store.get('activeProfileId');
    return profiles.find(function (p) { return p.id === id; }) || profiles[0];
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function todaysReminders() {
    const meds = MP.Store.get('medicines', []);
    const log = MP.Store.get('reminderLog', []);
    const today = todayISO();
    const items = [];
    meds.forEach(function (med) {
      (med.times || []).forEach(function (time) {
        const scheduledAt = today + 'T' + time;
        const entry = log.find(function (r) { return r.medicineId === med.id && r.scheduledAt === scheduledAt; });
        items.push({ medicineId: med.id, name: med.name, time: time, status: entry ? entry.status : 'pending' });
      });
    });
    items.sort(function (a, b) { return a.time.localeCompare(b.time); });
    return items;
  }

  function renderGreeting() {
    const profile = activeProfile();
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const nameEl = document.getElementById('dash-greeting');
    const dateEl = document.getElementById('dash-date');
    if (nameEl) nameEl.textContent = greeting + ', ' + (profile ? profile.name : 'there');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function renderTimeline() {
    const items = todaysReminders();
    const list = document.getElementById('timeline-list');
    if (!list) return;
    const now = new Date().toTimeString().slice(0, 5);
    if (!items.length) {
      list.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--fs-sm);">No medicines scheduled today. <a href="medicines.html" style="color:var(--color-primary);">Add one</a>.</p>';
      return;
    }
    list.innerHTML = items.map(function (item) {
      const isNext = item.status === 'pending' && item.time >= now;
      const dotClass = item.status === 'taken' ? 'taken' : (isNext ? 'upcoming' : 'pending');
      const statusLabel = item.status === 'taken' ? 'Taken' : isNext ? 'Up next' : 'Pending';
      const action = item.status !== 'taken'
        ? '<span class="timeline-actions"><button data-take="' + item.medicineId + '" data-time="' + item.time + '" aria-label="Mark ' + item.name + ' as taken"><i class="fa-solid fa-check"></i></button></span>'
        : '';
      return '<div class="timeline-item">' +
        '<span class="timeline-time">' + item.time + '</span>' +
        '<span class="timeline-dot ' + dotClass + '"></span>' +
        '<span class="timeline-info"><b>' + item.name + '</b><span>' + statusLabel + '</span></span>' +
        action +
        '</div>';
    }).join('');
  }

  function renderNextMedicine() {
    const pending = todaysReminders().filter(function (i) { return i.status !== 'taken'; });
    const now = new Date().toTimeString().slice(0, 5);
    const next = pending.find(function (i) { return i.time >= now; }) || pending[0];
    const nameEl = document.getElementById('next-med-name');
    const timeEl = document.getElementById('next-med-time');
    if (!nameEl || !timeEl) return;
    if (next) {
      nameEl.textContent = next.name;
      timeEl.textContent = 'at ' + next.time;
    } else {
      nameEl.textContent = 'All done';
      timeEl.textContent = 'No more doses today';
    }
  }

  function todaysWaterMl() {
    const log = MP.Store.get('waterLog', []);
    const today = todayISO();
    return log.filter(function (w) { return w.loggedAt.slice(0, 10) === today; })
               .reduce(function (sum, w) { return sum + w.amountMl; }, 0);
  }

  function renderWater() {
    const goal = MP.Store.get('waterGoalMl', 2500);
    const el = document.getElementById('water-value');
    if (el) el.textContent = todaysWaterMl() + ' / ' + goal + ' ml';
  }

  function renderScore() {
    // Only counts components that actually have data logged today — a brand-new
    // profile with nothing added yet shows "no data", not a fake baseline score.
    const items = todaysReminders();
    const resolved = items.filter(function (i) { return i.status === 'taken' || i.status === 'skipped' || i.status === 'missed'; });
    const adherencePct = resolved.length ? Math.round((resolved.filter(function (i) { return i.status === 'taken'; }).length / resolved.length) * 100) : null;

    const goal = MP.Store.get('waterGoalMl', 2500);
    const waterToday = MP.Store.get('waterLog', []).filter(function (w) { return w.loggedAt.slice(0, 10) === todayISO(); });
    const waterPct = waterToday.length ? Math.min(100, Math.round((todaysWaterMl() / goal) * 100)) : null;

    const sleepEntry = MP.Store.get('sleepLog', []).find(function (s) { return s.loggedAt.slice(0, 10) === todayISO(); });
    const sleepScore = sleepEntry ? Math.max(0, Math.min(100, Math.round((sleepEntry.hours / 8) * 100))) : null;

    const moodMap = { great: 100, good: 80, okay: 60, low: 40, awful: 20 };
    const moodEntry = MP.Store.get('moodLog', []).find(function (m) { return m.loggedAt.slice(0, 10) === todayISO(); });
    const moodScore = moodEntry ? moodMap[moodEntry.mood] : null;

    const components = [adherencePct, waterPct, sleepScore, moodScore].filter(function (v) { return v !== null; });

    const ring = document.getElementById('score-ring-fg');
    const valueEl = document.getElementById('score-value');
    const labelEl = document.getElementById('score-label');
    const circumference = 314;

    if (!components.length) {
      if (ring) ring.style.strokeDashoffset = circumference;
      if (valueEl) valueEl.textContent = '—';
      if (labelEl) labelEl.textContent = 'No data yet';
      return;
    }

    const clamped = Math.max(0, Math.min(100, Math.round(components.reduce(function (a, b) { return a + b; }, 0) / components.length)));
    const offset = circumference - (clamped / 100) * circumference;
    if (ring) ring.style.strokeDashoffset = offset;
    if (valueEl) valueEl.textContent = clamped + '%';
    if (labelEl) labelEl.textContent = clamped >= 85 ? 'Excellent' : clamped >= 60 ? 'Good' : 'Needs attention';
  }

  function renderAppointment() {
    const el = document.getElementById('appointment-info');
    if (!el) return;
    const upcoming = MP.Store.get('appointments', []).filter(function (a) { return a.status === 'upcoming'; });
    if (!upcoming.length) {
      el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--fs-sm);">No upcoming appointments.</p>';
      return;
    }
    const a = upcoming[0];
    el.innerHTML = '<b style="font-family:var(--font-ui);font-weight:500;display:block;">' + a.doctorName + '</b>' +
      '<span style="font-size:var(--fs-sm);color:var(--color-text-muted);">' + a.department + ' · ' + a.date + ' at ' + a.time + '</span>';
  }

  function wireActions() {
    document.addEventListener('click', function (e) {
      const takeBtn = e.target.closest('[data-take]');
      if (takeBtn) {
        const medId = takeBtn.dataset.take;
        const time = takeBtn.dataset.time;
        const log = MP.Store.get('reminderLog', []);
        log.push({ id: MP.Seed.uid('log'), medicineId: medId, scheduledAt: todayISO() + 'T' + time, status: 'taken', actionedAt: new Date().toISOString() });
        MP.Store.set('reminderLog', log);
        renderTimeline();
        renderNextMedicine();
        renderScore();
        MP.EventBus.emit('medicine:taken', { medicineId: medId });
        return;
      }
      const waterBtn = e.target.closest('[data-add-water]');
      if (waterBtn) {
        const amount = parseInt(waterBtn.dataset.addWater, 10);
        const log = MP.Store.get('waterLog', []);
        log.push({ id: MP.Seed.uid('water'), amountMl: amount, loggedAt: new Date().toISOString() });
        MP.Store.set('waterLog', log);
        renderWater();
        renderScore();
        MP.EventBus.emit('water:logged', { amount: amount });
      }
    });
  }
});
