// Alarmlyd som blir sterkere og sterkere.
// iOS Safari ignorerer audio.volume, så stigningen er "bakt inn" i en generert WAV:
// først en rampe-fil (stille -> full styrke over `rampSecs`), deretter en loop på full styrke.
// <audio> ringer også når lydløsbryteren er på (i motsetning til ren Web Audio).
const Alarm = (() => {
  const RATE = 16000;
  let ramp = null, loop = null, rampSecs = 90, ringing = false;

  function wav(secs, gainAt) {
    const n = RATE * secs;
    const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const slot = t % 1.0;                              // 1 sek: to pip + pause
      const pip = slot < 0.18 ? slot : (slot >= 0.3 && slot < 0.48 ? slot - 0.3 : -1);
      let env = 0;
      if (pip >= 0) env = Math.min(1, pip * 120, (0.18 - pip) * 120);
      const f = slot < 0.3 ? 1175 : 1568;
      const s = Math.sign(Math.sin(2 * Math.PI * f * t)) * 0.9 * env * gainAt(t);
      v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 32767, true);
    }
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }

  function build() {
    // Fra 4 % til 100 % av full styrke; kurven er kvadratisk så den merkes tidlig og blir brutal mot slutten
    const rampGain = t => 0.04 + 0.96 * Math.pow(Math.min(1, t / rampSecs), 2);
    ramp = new Audio(wav(rampSecs, rampGain));
    loop = new Audio(wav(4, () => 1)); loop.loop = true;
    ramp.onended = () => { if (ringing) loop.play().catch(() => {}); };
  }

  const prime = a => { a.muted = true; return a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => {}); };

  return {
    setRamp(secs) { rampSecs = secs; ramp = loop = null; },
    // Må kalles fra et trykk (iOS-krav) for å låse opp lyd senere.
    async unlock() { if (!ramp) build(); await prime(ramp); await prime(loop); },
    start() {
      if (!ramp) build();
      if (ringing) { this.resume(); return; }
      ringing = true; ramp.currentTime = 0; ramp.play().catch(() => {});
    },
    // Hvis iOS har pauset lyden (f.eks. ved samtale), fortsett der den slapp.
    resume() {
      if (!ringing) return;
      const a = ramp.ended ? loop : ramp;
      if (a.paused) a.play().catch(() => {});
    },
    stop() { ringing = false; [ramp, loop].forEach(a => { if (a) { a.pause(); a.currentTime = 0; } }); },
    // Kort test av gjeldende lyd (starter stille, så rampen merkes ikke; spiller full styrke 3 sek)
    async test() { if (!loop) build(); await prime(loop); loop.play(); setTimeout(() => { loop.pause(); loop.currentTime = 0; }, 3000); },
    level() { return ringing ? Math.min(1, (ramp && !ramp.ended ? ramp.currentTime / rampSecs : 1)) : 0; },
    ringing: () => ringing,
  };
})();
