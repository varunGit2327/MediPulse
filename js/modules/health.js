document.addEventListener('DOMContentLoaded', function () {
  MP.Seed.ensureSeedData();

  const modal = document.getElementById('vitals-modal');
  const form = document.getElementById('vitals-form');
  let activeType = 'bp';
  let selectedMood = null;

  wireModal();
  wireWater();
  wireTimeline();
  render();

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function todaysWaterMl() {
    const log = MP.Store.get('waterLog', []);
    const today = todayISO();
    return log.filter(function (w) { return w.loggedAt.slice(0, 10) === today; })
               .reduce(function (sum, w) { return sum + w.amountMl; }, 0);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function timeAgo(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.round(hrs / 24);
    return days + 'd ago';
  }

  /* ===== Render stat cards ===== */
  function render() {
    renderBP();
    renderSugar();
    renderWeight();
    renderSleep();
    renderMood();
    renderWater();
    renderTimeline();
  }

  function latestOfType(type) {
    const log = MP.Store.get('vitalsLog', []).filter(function (v) { return v.type === type; });
    log.sort(function (a, b) { return b.loggedAt.localeCompare(a.loggedAt); });
    return log[0] || null;
  }

  function renderBP() {
    const el = document.getElementById('stat-bp');
    const sub = document.getElementById('stat-bp-sub');
    const entry = latestOfType('bp');
    if (!entry) { el.textContent = '—'; sub.textContent = 'No readings yet'; return; }
    el.textContent = entry.systolic + '/' + entry.diastolic;
    let badge = 'good', label = 'Normal';
    if (entry.systolic >= 130 || entry.diastolic >= 80) { badge = 'bad'; label = 'High'; }
    else if (entry.systolic >= 120) { badge = 'warn'; label = 'Elevated'; }
    sub.innerHTML = timeAgo(entry.loggedAt) + '<span class="health-badge ' + badge + '">' + label + '</span>';
  }

  function renderSugar() {
    const el = document.getElementById('stat-sugar');
    const sub = document.getElementById('stat-sugar-sub');
    const entry = latestOfType('sugar');
    if (!entry) { el.textContent = '—'; sub.textContent = 'No readings yet'; return; }
    el.textContent = entry.value + ' mg/dL';
    let badge = 'good', label = 'Normal';
    if (entry.value >= 200) { badge = 'bad'; label = 'High'; }
    else if (entry.value >= 140) { badge = 'warn'; label = 'Elevated'; }
    sub.innerHTML = (entry.context === 'postMeal' ? 'Post-meal' : entry.context === 'fasting' ? 'Fasting' : 'Random') + ' · ' + timeAgo(entry.loggedAt) + '<span class="health-badge ' + badge + '">' + label + '</span>';
  }

  function renderWeight() {
    const el = document.getElementById('stat-weight');
    const sub = document.getElementById('stat-weight-sub');
    const log = MP.Store.get('vitalsLog', []).filter(function (v) { return v.type === 'weight'; }).sort(function (a, b) { return b.loggedAt.localeCompare(a.loggedAt); });
    const entry = log[0];
    if (!entry) { el.textContent = '—'; sub.textContent = 'No readings yet'; return; }
    el.textContent = entry.value + ' kg';
    let trend = '';
    if (log[1]) {
      const diff = entry.value - log[1].value;
      if (Math.abs(diff) >= 0.1) {
        trend = '<span class="health-badge ' + (diff < 0 ? 'good' : 'warn') + '"><i class="fa-solid fa-arrow-' + (diff < 0 ? 'down' : 'up') + '"></i> ' + Math.abs(diff).toFixed(1) + 'kg</span>';
      }
    }
    sub.innerHTML = timeAgo(entry.loggedAt) + trend;
  }

  function renderSleep() {
    const el = document.getElementById('stat-sleep');
    const sub = document.getElementById('stat-sleep-sub');
    const log = MP.Store.get('sleepLog', []).slice().sort(function (a, b) { return b.loggedAt.localeCompare(a.loggedAt); });
    const entry = log[0];
    if (!entry) { el.textContent = '—'; sub.textContent = 'No entry yet'; return; }
    el.textContent = entry.hours + 'h';
    const qualityLabel = { great: 'Great', good: 'Good', ok: 'Okay', poor: 'Poor' }[entry.quality] || '';
    const badge = entry.hours >= 7 ? 'good' : entry.hours >= 5 ? 'warn' : 'bad';
    sub.innerHTML = qualityLabel + ' · ' + timeAgo(entry.loggedAt) + '<span class="health-badge ' + badge + '">' + (entry.hours >= 7 ? 'Well rested' : entry.hours >= 5 ? 'A bit short' : 'Low sleep') + '</span>';
  }

  function renderMood() {
    const el = document.getElementById('stat-mood');
    const sub = document.getElementById('stat-mood-sub');
    const moodEmoji = { great: '😄', good: '🙂', okay: '😐', low: '🙁', awful: '😞' };
    const moodLabel = { great: 'Great', good: 'Good', okay: 'Okay', low: 'Low', awful: 'Awful' };
    const today = todayISO();
    const log = MP.Store.get('moodLog', []).filter(function (m) { return m.loggedAt.slice(0, 10) === today; })
      .sort(function (a, b) { return b.loggedAt.localeCompare(a.loggedAt); });
    const entry = log[0];
    if (!entry) { el.textContent = '—'; sub.textContent = 'Not logged yet'; return; }
    el.textContent = moodEmoji[entry.mood] + ' ' + moodLabel[entry.mood];
    sub.textContent = timeAgo(entry.loggedAt) + (entry.note ? ' · "' + entry.note + '"' : '');
  }

  function renderWater() {
    const goal = MP.Store.get('waterGoalMl', 2500);
    document.getElementById('stat-water').textContent = todaysWaterMl() + ' / ' + goal + ' ml';
  }

  /* ===== Combined recent entries timeline ===== */
  function buildTimeline() {
    const items = [];
    MP.Store.get('vitalsLog', []).forEach(function (v) {
      let label, icon;
      if (v.type === 'bp') { label = 'Blood Pressure: ' + v.systolic + '/' + v.diastolic + ' mmHg'; icon = 'fa-heart-pulse'; }
      else if (v.type === 'sugar') { label = 'Blood Sugar: ' + v.value + ' mg/dL'; icon = 'fa-droplet'; }
      else { label = 'Weight: ' + v.value + ' kg'; icon = 'fa-weight-scale'; }
      items.push({ id: v.id, key: 'vitalsLog', icon: icon, label: label, sub: '', loggedAt: v.loggedAt });
    });
    MP.Store.get('sleepLog', []).forEach(function (s) {
      items.push({ id: s.id, key: 'sleepLog', icon: 'fa-moon', label: 'Sleep: ' + s.hours + 'h', sub: s.quality, loggedAt: s.loggedAt });
    });
    MP.Store.get('moodLog', []).forEach(function (m) {
      const moodLabel = { great: 'Great', good: 'Good', okay: 'Okay', low: 'Low', awful: 'Awful' }[m.mood] || m.mood;
      items.push({ id: m.id, key: 'moodLog', icon: 'fa-face-smile', label: 'Mood: ' + moodLabel, sub: m.note || '', loggedAt: m.loggedAt });
    });
    MP.Store.get('waterLog', []).forEach(function (w) {
      items.push({ id: w.id, key: 'waterLog', icon: 'fa-glass-water', label: 'Water: +' + w.amountMl + ' ml', sub: '', loggedAt: w.loggedAt });
    });
    items.sort(function (a, b) { return b.loggedAt.localeCompare(a.loggedAt); });
    return items.slice(0, 15);
  }

  function renderTimeline() {
    const items = buildTimeline();
    const list = document.getElementById('health-timeline');
    const empty = document.getElementById('health-empty');
    if (!items.length) {
      list.innerHTML = '';
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';
    list.innerHTML = items.map(function (item) {
      return '<div class="health-timeline-row">' +
        '<div class="health-timeline-icon"><i class="fa-solid ' + item.icon + '"></i></div>' +
        '<div class="health-timeline-info"><b>' + escapeHtml(item.label) + '</b>' + (item.sub ? '<span>' + escapeHtml(item.sub) + '</span>' : '') + '</div>' +
        '<span class="health-timeline-time">' + timeAgo(item.loggedAt) + '</span>' +
        '<button data-delete-entry="' + item.id + '" data-store-key="' + item.key + '" aria-label="Delete entry"><i class="fa-solid fa-trash"></i></button>' +
        '</div>';
    }).join('');
  }

  function wireTimeline() {
    document.getElementById('health-timeline').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-delete-entry]');
      if (!btn) return;
      const key = btn.dataset.storeKey;
      const id = btn.dataset.deleteEntry;
      const log = MP.Store.get(key, []).filter(function (item) { return item.id !== id; });
      MP.Store.set(key, log);
      render();
    });
  }

  /* ===== Water quick-log ===== */
  function wireWater() {
    document.querySelectorAll('[data-add-water]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const amount = parseInt(btn.dataset.addWater, 10);
        const log = MP.Store.get('waterLog', []);
        log.push({ id: MP.Seed.uid('water'), amountMl: amount, loggedAt: new Date().toISOString() });
        MP.Store.set('waterLog', log);
        MP.EventBus.emit('water:logged', { amount: amount });
        render();
      });
    });
  }

  /* ===== Vitals modal ===== */
  function wireModal() {
    document.querySelectorAll('[data-open-vitals]').forEach(function (btn) {
      btn.addEventListener('click', openModal);
    });
    document.querySelectorAll('[data-close-modal]').forEach(function (btn) {
      btn.addEventListener('click', closeModal);
    });
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hasAttribute('hidden')) closeModal(); });

    document.querySelectorAll('.vitals-type-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { setActiveType(tab.dataset.vitalsType); });
    });

    document.querySelectorAll('.mood-option').forEach(function (opt) {
      opt.addEventListener('click', function () {
        document.querySelectorAll('.mood-option').forEach(function (o) { o.classList.remove('selected'); });
        opt.classList.add('selected');
        selectedMood = opt.dataset.mood;
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      saveEntry();
    });
  }

  function setActiveType(type) {
    activeType = type;
    document.querySelectorAll('.vitals-type-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.vitalsType === type);
    });
    document.querySelectorAll('.vitals-section').forEach(function (s) {
      s.hidden = s.dataset.vitalsSection !== type;
    });
  }

  function openModal() {
    form.reset();
    selectedMood = null;
    document.querySelectorAll('.mood-option').forEach(function (o) { o.classList.remove('selected'); });
    setActiveType('bp');
    modal.removeAttribute('hidden');
  }

  function closeModal() {
    modal.setAttribute('hidden', '');
  }

  function saveEntry() {
    const now = new Date().toISOString();
    const vitalsLog = MP.Store.get('vitalsLog', []);

    if (activeType === 'bp') {
      const systolic = parseInt(document.getElementById('v-systolic').value, 10);
      const diastolic = parseInt(document.getElementById('v-diastolic').value, 10);
      if (!systolic || !diastolic) return;
      vitalsLog.push({ id: MP.Seed.uid('vital'), type: 'bp', systolic: systolic, diastolic: diastolic, loggedAt: now });
      MP.Store.set('vitalsLog', vitalsLog);
      MP.EventBus.emit('vitals:logged', { type: 'bp' });
    } else if (activeType === 'sugar') {
      const value = parseInt(document.getElementById('v-sugar').value, 10);
      if (!value) return;
      vitalsLog.push({ id: MP.Seed.uid('vital'), type: 'sugar', value: value, context: document.getElementById('v-sugar-context').value, loggedAt: now });
      MP.Store.set('vitalsLog', vitalsLog);
      MP.EventBus.emit('vitals:logged', { type: 'sugar' });
    } else if (activeType === 'weight') {
      const value = parseFloat(document.getElementById('v-weight').value);
      if (!value) return;
      vitalsLog.push({ id: MP.Seed.uid('vital'), type: 'weight', value: value, loggedAt: now });
      MP.Store.set('vitalsLog', vitalsLog);
      MP.EventBus.emit('vitals:logged', { type: 'weight' });
    } else if (activeType === 'sleep') {
      const hours = parseFloat(document.getElementById('v-sleep-hours').value);
      if (!hours && hours !== 0) return;
      const log = MP.Store.get('sleepLog', []);
      log.push({ id: MP.Seed.uid('sleep'), hours: hours, quality: document.getElementById('v-sleep-quality').value, loggedAt: now });
      MP.Store.set('sleepLog', log);
      MP.EventBus.emit('sleep:logged', {});
    } else if (activeType === 'mood') {
      if (!selectedMood) return;
      const log = MP.Store.get('moodLog', []);
      log.push({ id: MP.Seed.uid('mood'), mood: selectedMood, note: document.getElementById('v-mood-note').value.trim(), loggedAt: now });
      MP.Store.set('moodLog', log);
      MP.EventBus.emit('mood:logged', { mood: selectedMood });
    }

    closeModal();
    render();
  }
});
