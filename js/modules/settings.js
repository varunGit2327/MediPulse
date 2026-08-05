document.addEventListener('DOMContentLoaded', function () {
  MP.Seed.ensureSeedData();

  wireAppearance();
  wireNotifications();
  wireBackup();
  wireReset();

  /* ===== Appearance (device-level, same raw localStorage keys as app-shell.js) ===== */
  function wireAppearance() {
    const root = document.documentElement;

    function refreshThemeButtons() {
      const current = root.getAttribute('data-theme') || 'light';
      document.querySelectorAll('[data-theme-choice]').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.themeChoice === current);
      });
    }
    function refreshFontButtons() {
      const current = root.getAttribute('data-font-scale') || 'normal';
      document.querySelectorAll('[data-fontscale-choice]').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.fontscaleChoice === current);
      });
    }

    document.querySelectorAll('[data-theme-choice]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        root.setAttribute('data-theme', btn.dataset.themeChoice);
        try { localStorage.setItem('medipulse:theme', btn.dataset.themeChoice); } catch (e) { /* ignore */ }
        const icon = document.querySelector('[data-theme-toggle] i');
        if (icon) icon.className = btn.dataset.themeChoice === 'dark' ? 'fa-solid fa-sun' : 'fa-regular fa-moon';
        refreshThemeButtons();
      });
    });

    document.querySelectorAll('[data-fontscale-choice]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        root.setAttribute('data-font-scale', btn.dataset.fontscaleChoice);
        try { localStorage.setItem('medipulse:fontScale', btn.dataset.fontscaleChoice); } catch (e) { /* ignore */ }
        refreshFontButtons();
      });
    });

    refreshThemeButtons();
    refreshFontButtons();
  }

  /* ===== Notifications (cosmetic preference, shared across profiles) ===== */
  function wireNotifications() {
    const settings = MP.Store.get('settings', { doseReminders: true, appointmentReminders: true, lowStockAlerts: true });
    document.getElementById('notif-doses').checked = settings.doseReminders !== false;
    document.getElementById('notif-appointments').checked = settings.appointmentReminders !== false;
    document.getElementById('notif-lowstock').checked = settings.lowStockAlerts !== false;

    ['notif-doses', 'notif-appointments', 'notif-lowstock'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', saveNotificationSettings);
    });
  }

  function saveNotificationSettings() {
    MP.Store.set('settings', {
      doseReminders: document.getElementById('notif-doses').checked,
      appointmentReminders: document.getElementById('notif-appointments').checked,
      lowStockAlerts: document.getElementById('notif-lowstock').checked
    });
  }

  /* ===== Backup & Restore ===== */
  function wireBackup() {
    document.querySelector('[data-export-backup]').addEventListener('click', exportBackup);
    document.getElementById('import-file').addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (file) importBackup(file);
    });
  }

  function allMedipulseKeys() {
    const keys = [];
    if (!MP.Store.isPersistent()) return keys;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('medipulse:') === 0) keys.push(k);
    }
    return keys;
  }

  function exportBackup() {
    const data = {};
    allMedipulseKeys().forEach(function (k) { data[k] = localStorage.getItem(k); });
    const payload = { exportedAt: new Date().toISOString(), app: 'MediPulse', version: '1.0.0', data: data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medipulse-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = function () {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        window.alert('That file doesn\'t look like a valid MediPulse backup.');
        return;
      }
      if (!parsed || !parsed.data || typeof parsed.data !== 'object') {
        window.alert('That file doesn\'t look like a valid MediPulse backup.');
        return;
      }
      if (!window.confirm('This will replace all current MediPulse data in this browser with the backup. Continue?')) return;

      if (!MP.Store.isPersistent()) {
        window.alert('This browser context can\'t save data persistently (see the console warning), so a restored backup won\'t survive a reload.');
      }
      Object.keys(parsed.data).forEach(function (key) {
        try { localStorage.setItem(key, parsed.data[key]); } catch (e) { /* ignore */ }
      });
      window.alert('Backup restored. The page will now reload.');
      window.location.reload();
    };
    reader.onerror = function () {
      window.alert('Could not read that file.');
    };
    reader.readAsText(file);
  }

  /* ===== Danger zone ===== */
  function wireReset() {
    document.querySelector('[data-reset-data]').addEventListener('click', function () {
      if (!window.confirm('This will permanently delete every profile, medicine, log, and setting stored in this browser. This cannot be undone. Continue?')) return;
      if (!window.confirm('Are you absolutely sure? Type OK to confirm one last time.')) return;
      allMedipulseKeys().forEach(function (k) { localStorage.removeItem(k); });
      window.location.reload();
    });
  }
});
