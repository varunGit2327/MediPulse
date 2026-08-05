document.addEventListener('DOMContentLoaded', function () {
  MP.Seed.ensureSeedData();

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function toISODate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayISO() { return toISODate(new Date()); }
  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return toISODate(d);
  }
  function shortLabel(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#2563EB';
  }

  const COLORS = {
    primary: cssVar('--color-primary'),
    success: cssVar('--color-success'),
    danger: cssVar('--color-danger'),
    warning: cssVar('--color-warning'),
    muted: cssVar('--color-text-muted'),
    border: cssVar('--color-border') || 'rgba(15,23,42,0.08)'
  };

  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily || 'Inter, sans-serif';
  Chart.defaults.color = COLORS.muted;

  /* ===== Data helpers ===== */
  function getMedicines() { return MP.Store.get('medicines', []); }
  function getLog() { return MP.Store.get('reminderLog', []); }

  function findLogEntry(log, medicineId, scheduledAt) {
    return log.find(function (r) { return r.medicineId === medicineId && r.scheduledAt === scheduledAt; });
  }

  /* All scheduled doses for a single date, with resolved status (taken/missed/skipped/pending) */
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
        items.push({ medicineId: med.id, medicineName: med.name, status: status });
      });
    });
    return items;
  }

  function adherencePctForDay(dateStr, meds, log) {
    const items = dosesForDate(dateStr, meds, log).filter(function (i) { return i.status !== 'pending'; });
    if (!items.length) return null;
    const taken = items.filter(function (i) { return i.status === 'taken'; }).length;
    return Math.round((taken / items.length) * 100);
  }

  function waterPctForDay(dateStr) {
    const goal = MP.Store.get('waterGoalMl', 2500);
    const total = MP.Store.get('waterLog', []).filter(function (w) { return w.loggedAt.slice(0, 10) === dateStr; })
      .reduce(function (sum, w) { return sum + w.amountMl; }, 0);
    return goal ? Math.min(100, Math.round((total / goal) * 100)) : null;
  }

  function sleepScoreForDay(dateStr) {
    const entry = MP.Store.get('sleepLog', []).find(function (s) { return s.loggedAt.slice(0, 10) === dateStr; });
    if (!entry) return null;
    return Math.max(0, Math.min(100, Math.round((entry.hours / 8) * 100)));
  }

  function moodScoreForDay(dateStr) {
    const map = { great: 100, good: 80, okay: 60, low: 40, awful: 20 };
    const entry = MP.Store.get('moodLog', []).find(function (m) { return m.loggedAt.slice(0, 10) === dateStr; });
    return entry ? map[entry.mood] : null;
  }

  function healthScoreForDay(dateStr, meds, log) {
    const parts = [adherencePctForDay(dateStr, meds, log), waterPctForDay(dateStr), sleepScoreForDay(dateStr), moodScoreForDay(dateStr)]
      .filter(function (v) { return v !== null && v !== undefined; });
    if (!parts.length) return null;
    return Math.round(parts.reduce(function (a, b) { return a + b; }, 0) / parts.length);
  }

  /* ===== Compute range ===== */
  const today = todayISO();
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(addDays(today, -i));

  const meds = getMedicines();
  const log = getLog();

  const adherenceSeries = days.map(function (d) { return adherencePctForDay(d, meds, log); });
  const healthScoreSeries = days.map(function (d) { return healthScoreForDay(d, meds, log); });
  const labels = days.map(shortLabel);

  /* ===== Stat cards ===== */
  const validAdherence = adherenceSeries.filter(function (v) { return v !== null; });
  const avgAdherence = validAdherence.length ? Math.round(validAdherence.reduce(function (a, b) { return a + b; }, 0) / validAdherence.length) : null;
  document.getElementById('an-adherence').textContent = avgAdherence !== null ? avgAdherence + '%' : '—';

  const validHealthScores = healthScoreSeries.filter(function (v) { return v !== null; });
  const latestHealthScore = validHealthScores.length ? validHealthScores[validHealthScores.length - 1] : null;
  document.getElementById('an-health-score').textContent = latestHealthScore !== null ? latestHealthScore : '—';

  let streak = 0;
  let d = today;
  for (let i = 0; i < 60; i++) {
    const dayItems = dosesForDate(d, meds, log);
    if (!dayItems.length) { d = addDays(d, -1); continue; }
    const allTaken = dayItems.every(function (i) { return i.status === 'taken'; });
    if (!allTaken) break;
    streak++;
    d = addDays(d, -1);
  }
  document.getElementById('an-streak').textContent = streak + (streak === 1 ? ' day' : ' days');

  const last7 = [];
  for (let i = 6; i >= 0; i--) last7.push(addDays(today, -i));
  const sleepEntries = last7.map(function (d) {
    const e = MP.Store.get('sleepLog', []).find(function (s) { return s.loggedAt.slice(0, 10) === d; });
    return e ? e.hours : null;
  }).filter(function (v) { return v !== null; });
  const avgSleep = sleepEntries.length ? (sleepEntries.reduce(function (a, b) { return a + b; }, 0) / sleepEntries.length).toFixed(1) : null;
  document.getElementById('an-sleep').textContent = avgSleep !== null ? avgSleep + 'h' : '—';

  /* ===== Chart: Adherence Trend ===== */
  new Chart(document.getElementById('chart-adherence'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Adherence %',
        data: adherenceSeries,
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primary + '22',
        fill: true,
        tension: 0.3,
        spanGaps: true,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { min: 0, max: 100, grid: { color: COLORS.border } }, x: { grid: { display: false } } },
      plugins: { legend: { display: false } }
    }
  });

  /* ===== Chart: Health Score Trend ===== */
  new Chart(document.getElementById('chart-healthscore'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Health Score',
        data: healthScoreSeries,
        borderColor: COLORS.success,
        backgroundColor: COLORS.success + '22',
        fill: true,
        tension: 0.3,
        spanGaps: true,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { min: 0, max: 100, grid: { color: COLORS.border } }, x: { grid: { display: false } } },
      plugins: { legend: { display: false } }
    }
  });

  /* ===== Chart: Adherence by Medicine (14 days) ===== */
  if (!meds.length) {
    document.getElementById('chart-per-medicine').style.display = 'none';
    document.getElementById('chart-per-medicine-empty').style.display = 'flex';
  } else {
    const perMed = meds.filter(function (m) { return m.frequency !== 'asNeeded' && m.times && m.times.length; }).map(function (med) {
      let scheduled = 0, taken = 0;
      days.forEach(function (d) {
        dosesForDate(d, [med], log).forEach(function (item) {
          if (item.status === 'pending') return;
          scheduled++;
          if (item.status === 'taken') taken++;
        });
      });
      return { name: med.name, pct: scheduled ? Math.round((taken / scheduled) * 100) : null };
    }).filter(function (m) { return m.pct !== null; });

    if (!perMed.length) {
      document.getElementById('chart-per-medicine').style.display = 'none';
      document.getElementById('chart-per-medicine-empty').style.display = 'flex';
    } else {
      new Chart(document.getElementById('chart-per-medicine'), {
        type: 'bar',
        data: {
          labels: perMed.map(function (m) { return m.name; }),
          datasets: [{
            label: 'Adherence %',
            data: perMed.map(function (m) { return m.pct; }),
            backgroundColor: perMed.map(function (m) { return m.pct >= 80 ? COLORS.success : m.pct >= 50 ? COLORS.warning : COLORS.danger; }),
            borderRadius: 6
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true, maintainAspectRatio: false,
          scales: { x: { min: 0, max: 100, grid: { color: COLORS.border } }, y: { grid: { display: false } } },
          plugins: { legend: { display: false } }
        }
      });
    }
  }

  /* ===== Chart: Weight Trend ===== */
  const weightEntries = MP.Store.get('vitalsLog', []).filter(function (v) { return v.type === 'weight'; })
    .sort(function (a, b) { return a.loggedAt.localeCompare(b.loggedAt); });

  if (weightEntries.length < 2) {
    document.getElementById('chart-weight').style.display = 'none';
    document.getElementById('chart-weight-empty').style.display = 'flex';
  } else {
    new Chart(document.getElementById('chart-weight'), {
      type: 'line',
      data: {
        labels: weightEntries.map(function (e) { return shortLabel(e.loggedAt.slice(0, 10)); }),
        datasets: [{
          label: 'Weight (kg)',
          data: weightEntries.map(function (e) { return e.value; }),
          borderColor: COLORS.primary,
          backgroundColor: COLORS.primary + '22',
          fill: true,
          tension: 0.3,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { grid: { color: COLORS.border } }, x: { grid: { display: false } } },
        plugins: { legend: { display: false } }
      }
    });
  }
});
