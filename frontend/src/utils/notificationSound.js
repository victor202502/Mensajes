// frontend/src/utils/notificationSound.js
// Rein visuelle/akustische Hilfsfunktion (Phase 3): spielt einen kurzen,
// dezenten Benachrichtigungston über die Web Audio API ab — ganz ohne
// externe Audiodatei. Keine Business-Logik, kein State.

export function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Zwei kurze, sanft ausklingende Töne (dezenter "Pop")
    [880, 1180].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;

      const start = now + index * 0.09;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    });

    // AudioContext nach dem Abspielen wieder schließen
    setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch (err) {
    console.warn('App: Benachrichtigungston konnte nicht abgespielt werden:', err);
  }
}
