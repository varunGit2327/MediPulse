window.MP = window.MP || {};

/**
 * Seed — creates a default (empty) profile on first run, so the app is never
 * a broken screen. No sample data is pre-filled; the user adds everything themselves.
 */
MP.Seed = (function () {
  function uid(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 9);
  }

  function ensureProfile() {
    let profiles = MP.Store.get('profiles', []);
    if (!profiles.length) {
      const id = uid('profile');
      profiles = [{ id: id, name: 'You', relation: 'Self', avatarInitials: 'Y', isPrimary: true }];
      MP.Store.set('profiles', profiles);
      MP.Store.set('activeProfileId', id);
    } else if (!MP.Store.get('activeProfileId')) {
      MP.Store.set('activeProfileId', profiles[0].id);
    }
    return MP.Store.get('activeProfileId');
  }

  function ensureSeedData() {
    ensureProfile();
    if (MP.Store.get('medicines') === null) {
      MP.Store.set('medicines', []);
      MP.Store.set('reminderLog', []);
      MP.Store.set('waterLog', []);
      MP.Store.set('waterGoalMl', 2500);
      MP.Store.set('vitalsLog', []);
      MP.Store.set('sleepLog', []);
      MP.Store.set('moodLog', []);
      MP.Store.set('appointments', []);
      MP.Store.set('achievementsUnlocked', []);
      MP.Store.set('dailyChallengeLog', []);
      MP.Store.set('emergencyInfo', { bloodGroup: '', allergies: [], conditions: [] });
      MP.Store.set('emergencyContacts', []);
    }
  }

  return { ensureProfile: ensureProfile, ensureSeedData: ensureSeedData, uid: uid };
})();
