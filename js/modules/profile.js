document.addEventListener('DOMContentLoaded', function () {
  MP.Seed.ensureSeedData();

  const detailsModal = document.getElementById('details-modal');
  const detailsForm = document.getElementById('details-form');

  wireModal();
  wireGoals();
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

  function getActiveProfile() {
    const profiles = MP.Store.get('profiles', []);
    const activeId = MP.Store.get('activeProfileId');
    return profiles.find(function (p) { return p.id === activeId; }) || profiles[0];
  }

  function getDetails() { return MP.Store.get('profileDetails', { dateOfBirth: '', gender: '', heightCm: '' }); }

  function ageFromDob(dob) {
    if (!dob) return null;
    const b = new Date(dob + 'T00:00:00');
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
    return age;
  }

  /* ===== Shared dose-schedule helpers (same logic as reminders/analytics) ===== */
  function getMedicines() { return MP.Store.get('medicines', []); }
  function getLog() { return MP.Store.get('reminderLog', []); }
  function findLogEntry(log, medicineId, scheduledAt) {
    return log.find(function (r) { return r.medicineId === medicineId && r.scheduledAt === scheduledAt; });
  }
  function dosesForDate(dateStr, meds, log) {
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
          if (status === 'snoozed') status = scheduledDateObj <= now ? 'missed' : 'pending';
        } else if (scheduledDateObj <= now) {
          status = 'missed';
        }
        items.push({ status: status });
      });
    });
    return items;
  }

  function currentStreak() {
    const meds = getMedicines();
    const log = getLog();
    let streak = 0;
    let d = todayISO();
    for (let i = 0; i < 60; i++) {
      const dayItems = dosesForDate(d, meds, log);
      if (!dayItems.length) { d = addDays(d, -1); continue; }
      const allTaken = dayItems.every(function (i) { return i.status === 'taken'; });
      if (!allTaken) break;
      streak++;
      d = addDays(d, -1);
    }
    return streak;
  }

  function adherenceOverDays(nDays) {
    const meds = getMedicines();
    const log = getLog();
    let taken = 0, resolved = 0;
    for (let i = 0; i < nDays; i++) {
      dosesForDate(addDays(todayISO(), -i), meds, log).forEach(function (item) {
        if (item.status === 'pending') return;
        resolved++;
        if (item.status === 'taken') taken++;
      });
    }
    return resolved ? Math.round((taken / resolved) * 100) : null;
  }

  function anyDosesTaken() {
    return getLog().some(function (l) { return l.status === 'taken'; });
  }

  function anyPerfectDay() {
    const meds = getMedicines();
    const log = getLog();
    for (let i = 0; i < 30; i++) {
      const items = dosesForDate(addDays(todayISO(), -i), meds, log);
      if (items.length && items.every(function (it) { return it.status === 'taken'; })) return true;
    }
    return false;
  }

  function metWaterGoalAnyDay() {
    const goal = MP.Store.get('waterGoalMl', 2500);
    const log = MP.Store.get('waterLog', []);
    const byDay = {};
    log.forEach(function (w) {
      const d = w.loggedAt.slice(0, 10);
      byDay[d] = (byDay[d] || 0) + w.amountMl;
    });
    return Object.keys(byDay).some(function (d) { return byDay[d] >= goal; });
  }

  /* ===== Achievement definitions ===== */
  function getAchievementDefs() {
    return [
      { id: 'first_medicine', icon: 'fa-pills', name: 'First Steps', desc: 'Add your first medicine', condition: function () { return getMedicines().length > 0; } },
      { id: 'dose_master', icon: 'fa-check-double', name: 'Dose Master', desc: 'Log your first taken dose', condition: anyDosesTaken },
      { id: 'week_warrior', icon: 'fa-fire', name: 'Week Warrior', desc: '7-day taking streak', condition: function () { return currentStreak() >= 7; } },
      { id: 'perfect_day', icon: 'fa-medal', name: 'Perfect Day', desc: 'Take every dose in a single day', condition: anyPerfectDay },
      { id: 'hydration_hero', icon: 'fa-glass-water', name: 'Hydration Hero', desc: 'Hit your water goal in a day', condition: metWaterGoalAnyDay },
      { id: 'health_tracker', icon: 'fa-heart-pulse', name: 'Health Tracker', desc: 'Log a vitals, sleep, or mood entry', condition: function () {
        return MP.Store.get('vitalsLog', []).length > 0 || MP.Store.get('sleepLog', []).length > 0 || MP.Store.get('moodLog', []).length > 0;
      } },
      { id: 'appointment_keeper', icon: 'fa-stethoscope', name: 'Appointment Keeper', desc: 'Complete an appointment', condition: function () {
        return MP.Store.get('appointments', []).some(function (a) { return a.status === 'completed'; });
      } },
      { id: 'consistency_champ', icon: 'fa-crown', name: 'Consistency Champion', desc: '80%+ adherence over 14 days', condition: function () {
        const pct = adherenceOverDays(14);
        return pct !== null && pct >= 80;
      } }
    ];
  }

  function evaluateAchievements() {
    const defs = getAchievementDefs();
    let unlocked = MP.Store.get('achievementsUnlocked', []);
    const unlockedIds = unlocked.map(function (u) { return u.id; });
    let changed = false;
    defs.forEach(function (def) {
      if (unlockedIds.indexOf(def.id) === -1 && def.condition()) {
        unlocked.push({ id: def.id, unlockedAt: new Date().toISOString() });
        unlockedIds.push(def.id);
        changed = true;
      }
    });
    if (changed) MP.Store.set('achievementsUnlocked', unlocked);
    return { defs: defs, unlockedIds: unlockedIds };
  }

  /* ===== Daily challenge ===== */
  function dayOfYear(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d - start) / 86400000);
  }

  function getChallengePool() {
    return [
      { id: 'take_all_doses', name: 'Take all of today\'s doses', desc: 'Clear every scheduled dose today', check: function () {
        const items = dosesForDate(todayISO(), getMedicines(), getLog());
        return items.length > 0 && items.every(function (i) { return i.status === 'taken'; });
      } },
      { id: 'log_water', name: 'Log your water intake', desc: 'Add at least one glass of water today', check: function () {
        return MP.Store.get('waterLog', []).some(function (w) { return w.loggedAt.slice(0, 10) === todayISO(); });
      } },
      { id: 'log_mood', name: 'Check in on your mood', desc: 'Log how you\'re feeling today', check: function () {
        return MP.Store.get('moodLog', []).some(function (m) { return m.loggedAt.slice(0, 10) === todayISO(); });
      } },
      { id: 'log_sleep', name: 'Log last night\'s sleep', desc: 'Record how many hours you slept', check: function () {
        return MP.Store.get('sleepLog', []).some(function (s) { return s.loggedAt.slice(0, 10) === todayISO(); });
      } }
    ];
  }

  function renderChallenge() {
    const pool = getChallengePool();
    const challenge = pool[dayOfYear(todayISO()) % pool.length];
    const done = challenge.check();

    if (done) {
      const logged = MP.Store.get('dailyChallengeLog', []);
      if (!logged.some(function (l) { return l.date === todayISO() && l.challengeId === challenge.id; })) {
        logged.push({ date: todayISO(), challengeId: challenge.id });
        MP.Store.set('dailyChallengeLog', logged);
      }
    }

    document.getElementById('pf-challenge').innerHTML =
      '<div class="challenge-card' + (done ? ' done' : '') + '">' +
        '<div class="challenge-icon"><i class="fa-solid ' + (done ? 'fa-check' : 'fa-star') + '"></i></div>' +
        '<div class="challenge-info"><b>' + escapeHtml(challenge.name) + '</b><span>' + escapeHtml(challenge.desc) + '</span></div>' +
        '<span class="challenge-status ' + (done ? 'done' : 'pending') + '">' + (done ? 'Completed' : 'Pending') + '</span>' +
      '</div>';
  }

  function renderAchievements() {
    const result = evaluateAchievements();
    const grid = document.getElementById('pf-achievements');
    grid.innerHTML = result.defs.map(function (def) {
      const unlocked = result.unlockedIds.indexOf(def.id) !== -1;
      return '<div class="achievement-card ' + (unlocked ? 'unlocked' : 'locked') + '">' +
        '<div class="achievement-icon"><i class="fa-solid ' + (unlocked ? def.icon : 'fa-lock') + '"></i></div>' +
        '<div class="achievement-name">' + escapeHtml(def.name) + '</div>' +
        '<div class="achievement-desc">' + escapeHtml(def.desc) + '</div>' +
      '</div>';
    }).join('');
  }

  /* ===== Identity + details ===== */
  function render() {
    const profile = getActiveProfile();
    const details = getDetails();

    document.getElementById('pf-avatar').textContent = profile ? (profile.avatarInitials || profile.name.charAt(0).toUpperCase()) : 'Y';
    document.getElementById('pf-name').textContent = profile ? profile.name : 'You';
    document.getElementById('pf-relation').textContent = profile ? (profile.relation || '') : '';

    const age = ageFromDob(details.dateOfBirth);
    const rows = [];
    if (age !== null) rows.push(['Age', age + ' years']);
    if (details.gender) rows.push(['Gender', details.gender]);
    if (details.heightCm) rows.push(['Height', details.heightCm + ' cm']);
    document.getElementById('pf-details-list').innerHTML = rows.length
      ? rows.map(function (r) { return '<div><span>' + r[0] + '</span><span>' + escapeHtml(String(r[1])) + '</span></div>'; }).join('')
      : '';

    document.getElementById('pf-water-goal').value = MP.Store.get('waterGoalMl', 2500);

    renderChallenge();
    renderAchievements();
  }

  function wireGoals() {
    document.querySelector('[data-save-goals]').addEventListener('click', function () {
      const val = parseInt(document.getElementById('pf-water-goal').value, 10);
      if (val && val > 0) {
        MP.Store.set('waterGoalMl', val);
        MP.EventBus.emit('goal:updated', { waterGoalMl: val });
      }
    });
  }

  function wireModal() {
    document.querySelector('[data-open-details]').addEventListener('click', openModal);
    document.querySelectorAll('[data-close-modal]').forEach(function (btn) {
      btn.addEventListener('click', closeModal);
    });
    detailsModal.addEventListener('click', function (e) { if (e.target === detailsModal) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !detailsModal.hasAttribute('hidden')) closeModal(); });
    detailsForm.addEventListener('submit', function (e) { e.preventDefault(); saveDetails(); });
  }

  function openModal() {
    const profile = getActiveProfile();
    const details = getDetails();
    document.getElementById('d-name').value = profile ? profile.name : '';
    document.getElementById('d-dob').value = details.dateOfBirth || '';
    document.getElementById('d-gender').value = details.gender || '';
    document.getElementById('d-height').value = details.heightCm || '';
    detailsModal.removeAttribute('hidden');
    document.getElementById('d-name').focus();
  }

  function closeModal() {
    detailsModal.setAttribute('hidden', '');
  }

  function saveDetails() {
    const name = document.getElementById('d-name').value.trim();
    if (!name) return;

    const profiles = MP.Store.get('profiles', []);
    const activeId = MP.Store.get('activeProfileId');
    const idx = profiles.findIndex(function (p) { return p.id === activeId; });
    if (idx !== -1) {
      profiles[idx] = Object.assign({}, profiles[idx], { name: name });
      MP.Store.set('profiles', profiles);
      const avatarEl = document.querySelector('[data-active-avatar]');
      if (avatarEl) avatarEl.textContent = profiles[idx].avatarInitials || name.charAt(0).toUpperCase();
    }

    MP.Store.set('profileDetails', {
      dateOfBirth: document.getElementById('d-dob').value,
      gender: document.getElementById('d-gender').value,
      heightCm: document.getElementById('d-height').value
    });

    closeModal();
    render();
  }
});
