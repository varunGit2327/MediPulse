document.addEventListener('DOMContentLoaded', function () {
  MP.Seed.ensureSeedData();

  let period = 'daily';
  const dateInput = document.getElementById('report-date');

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

  dateInput.value = todayISO();

  wireControls();
  render();

  function getRange() {
    const base = dateInput.value || todayISO();
    if (period === 'daily') return { start: base, end: base };
    if (period === 'weekly') return { start: addDays(base, -6), end: base };
    // monthly: full calendar month containing `base`
    const d = new Date(base + 'T00:00:00');
    const start = toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
    const end = toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    return { start: start, end: end };
  }

  function eachDate(start, end) {
    const out = [];
    let d = start;
    while (d <= end) { out.push(d); d = addDays(d, 1); }
    return out;
  }

  /* ===== Data ===== */
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
        items.push({ medicineId: med.id, medicineName: med.name, time: time, scheduledAt: scheduledAt, status: status });
      });
    });
    return items;
  }

  function buildReport(start, end) {
    const meds = getMedicines();
    const log = getLog();
    const dates = eachDate(start, end);
    const allDoses = [];
    dates.forEach(function (d) { allDoses.push.apply(allDoses, dosesForDate(d, meds, log)); });

    const resolved = allDoses.filter(function (i) { return i.status !== 'pending'; });
    const taken = resolved.filter(function (i) { return i.status === 'taken'; }).length;
    const missed = resolved.filter(function (i) { return i.status === 'missed'; }).length;
    const skipped = resolved.filter(function (i) { return i.status === 'skipped'; }).length;
    const adherence = resolved.length ? Math.round((taken / resolved.length) * 100) : null;

    const perMed = {};
    meds.forEach(function (m) { perMed[m.id] = { name: m.name, scheduled: 0, taken: 0, missed: 0, skipped: 0 }; });
    resolved.forEach(function (item) {
      const rec = perMed[item.medicineId];
      if (!rec) return;
      rec.scheduled++;
      rec[item.status]++;
    });
    const medBreakdown = Object.keys(perMed).map(function (id) { return perMed[id]; }).filter(function (r) { return r.scheduled > 0; });

    const vitals = MP.Store.get('vitalsLog', []).filter(function (v) { return v.loggedAt.slice(0, 10) >= start && v.loggedAt.slice(0, 10) <= end; });
    const bpEntries = vitals.filter(function (v) { return v.type === 'bp'; });
    const sugarEntries = vitals.filter(function (v) { return v.type === 'sugar'; });
    const weightEntries = vitals.filter(function (v) { return v.type === 'weight'; }).sort(function (a, b) { return a.loggedAt.localeCompare(b.loggedAt); });

    const sleepEntries = MP.Store.get('sleepLog', []).filter(function (s) { return s.loggedAt.slice(0, 10) >= start && s.loggedAt.slice(0, 10) <= end; });
    const avgSleep = sleepEntries.length ? (sleepEntries.reduce(function (a, b) { return a + b.hours; }, 0) / sleepEntries.length).toFixed(1) : null;

    const appts = MP.Store.get('appointments', []).filter(function (a) { return a.date >= start && a.date <= end; }).sort(function (a, b) { return a.date.localeCompare(b.date); });

    return { start: start, end: end, taken: taken, missed: missed, skipped: skipped, adherence: adherence, medBreakdown: medBreakdown, bpEntries: bpEntries, sugarEntries: sugarEntries, weightEntries: weightEntries, avgSleep: avgSleep, appts: appts, allResolvedDoses: resolved };
  }

  function formatDateRange(start, end) {
    if (start === end) return new Date(start + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    return new Date(start + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' – ' + new Date(end + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function render() {
    const range = getRange();
    const report = buildReport(range.start, range.end);
    const periodLabel = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[period];

    document.getElementById('report-title').textContent = 'MediPulse ' + periodLabel + ' Report — ' + formatDateRange(range.start, range.end);

    document.getElementById('rep-adherence').textContent = report.adherence !== null ? report.adherence + '%' : '—';
    document.getElementById('rep-doses').textContent = report.taken + ' / ' + report.missed + ' / ' + report.skipped;
    document.getElementById('rep-appts').textContent = report.appts.length;
    document.getElementById('rep-sleep').textContent = report.avgSleep !== null ? report.avgSleep + 'h' : '—';

    const medTbody = document.querySelector('#rep-med-table tbody');
    if (!report.medBreakdown.length) {
      medTbody.innerHTML = '';
      document.getElementById('rep-med-empty').style.display = 'block';
      document.getElementById('rep-med-table').style.display = 'none';
    } else {
      document.getElementById('rep-med-empty').style.display = 'none';
      document.getElementById('rep-med-table').style.display = 'table';
      medTbody.innerHTML = report.medBreakdown.map(function (m) {
        const pct = m.scheduled ? Math.round((m.taken / m.scheduled) * 100) : 0;
        return '<tr><td>' + escapeHtml(m.name) + '</td><td>' + m.scheduled + '</td><td>' + m.taken + '</td><td>' + m.missed + '</td><td>' + m.skipped + '</td><td>' + pct + '%</td></tr>';
      }).join('');
    }

    const vitalsEl = document.getElementById('rep-vitals');
    const hasVitals = report.bpEntries.length || report.sugarEntries.length || report.weightEntries.length;
    if (!hasVitals) {
      vitalsEl.innerHTML = '';
      document.getElementById('rep-vitals-empty').style.display = 'block';
    } else {
      document.getElementById('rep-vitals-empty').style.display = 'none';
      let html = '<div class="vitals-summary-row">';
      if (report.bpEntries.length) {
        const avgSys = Math.round(report.bpEntries.reduce(function (a, b) { return a + b.systolic; }, 0) / report.bpEntries.length);
        const avgDia = Math.round(report.bpEntries.reduce(function (a, b) { return a + b.diastolic; }, 0) / report.bpEntries.length);
        html += '<div class="vitals-summary-item"><b>' + avgSys + '/' + avgDia + '</b><span>Avg Blood Pressure (' + report.bpEntries.length + ' readings)</span></div>';
      }
      if (report.sugarEntries.length) {
        const avgSugar = Math.round(report.sugarEntries.reduce(function (a, b) { return a + b.value; }, 0) / report.sugarEntries.length);
        html += '<div class="vitals-summary-item"><b>' + avgSugar + ' mg/dL</b><span>Avg Blood Sugar (' + report.sugarEntries.length + ' readings)</span></div>';
      }
      if (report.weightEntries.length) {
        const first = report.weightEntries[0].value;
        const last = report.weightEntries[report.weightEntries.length - 1].value;
        const diff = (last - first).toFixed(1);
        html += '<div class="vitals-summary-item"><b>' + last + ' kg</b><span>Weight (' + (diff >= 0 ? '+' : '') + diff + 'kg over period)</span></div>';
      }
      html += '</div>';
      vitalsEl.innerHTML = html;
    }

    const apptTbody = document.querySelector('#rep-appt-table tbody');
    if (!report.appts.length) {
      apptTbody.innerHTML = '';
      document.getElementById('rep-appt-empty').style.display = 'block';
      document.getElementById('rep-appt-table').style.display = 'none';
    } else {
      document.getElementById('rep-appt-empty').style.display = 'none';
      document.getElementById('rep-appt-table').style.display = 'table';
      apptTbody.innerHTML = report.appts.map(function (a) {
        return '<tr><td>' + a.date + '</td><td>' + escapeHtml(a.doctorName) + '</td><td>' + escapeHtml(a.department || '') + '</td><td>' + (a.status || 'upcoming') + '</td></tr>';
      }).join('');
    }
  }

  function wireControls() {
    document.querySelectorAll('[data-period]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-period]').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        period = btn.dataset.period;
        render();
      });
    });
    dateInput.addEventListener('change', render);

    document.querySelector('[data-print-report]').addEventListener('click', function () {
      window.print();
    });

    document.querySelector('[data-export-csv]').addEventListener('click', exportCsv);
  }

  function csvEscape(val) {
    const s = String(val === undefined || val === null ? '' : val);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCsv() {
    const range = getRange();
    const report = buildReport(range.start, range.end);
    const rows = [];

    rows.push(['MediPulse Report', formatDateRange(range.start, range.end)]);
    rows.push([]);
    rows.push(['Dose Log']);
    rows.push(['Date', 'Time', 'Medicine', 'Status']);
    report.allResolvedDoses.forEach(function (d) {
      rows.push([d.scheduledAt.slice(0, 10), d.time, d.medicineName, d.status]);
    });
    rows.push([]);
    rows.push(['Medicine Breakdown']);
    rows.push(['Medicine', 'Scheduled', 'Taken', 'Missed', 'Skipped', 'Adherence %']);
    report.medBreakdown.forEach(function (m) {
      rows.push([m.name, m.scheduled, m.taken, m.missed, m.skipped, m.scheduled ? Math.round((m.taken / m.scheduled) * 100) : 0]);
    });
    rows.push([]);
    rows.push(['Vitals']);
    rows.push(['Type', 'Date', 'Value']);
    report.bpEntries.forEach(function (v) { rows.push(['Blood Pressure', v.loggedAt.slice(0, 10), v.systolic + '/' + v.diastolic]); });
    report.sugarEntries.forEach(function (v) { rows.push(['Blood Sugar', v.loggedAt.slice(0, 10), v.value + ' mg/dL']); });
    report.weightEntries.forEach(function (v) { rows.push(['Weight', v.loggedAt.slice(0, 10), v.value + ' kg']); });
    rows.push([]);
    rows.push(['Appointments']);
    rows.push(['Date', 'Doctor', 'Department', 'Status']);
    report.appts.forEach(function (a) { rows.push([a.date, a.doctorName, a.department || '', a.status || 'upcoming']); });

    const csv = rows.map(function (row) { return row.map(csvEscape).join(','); }).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medipulse-report-' + period + '-' + range.start + '-to-' + range.end + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
});
