const $ = id => document.getElementById(id);
const show = id => document.querySelectorAll('section').forEach(s => s.classList.toggle('on', s.id === id));
const hhmm = d => d.toTimeString().slice(0, 5);
const num = (k, d) => Number(localStorage.getItem(k)) || d;

const SWITCH_EVERY = 30;   // sekunder før oppdraget byttes mens alarmen ringer

let state = 'idle', wake = null, tick = null;
let target = null, targetSince = 0, busy = false;

async function lockScreen() {
  try {
    wake = await navigator.wakeLock.request('screen');
    $('wl').textContent = '✓ Skjermen holdes våken';
  } catch { $('wl').textContent = '⚠ Kunne ikke holde skjermen våken – slå av automatisk lås i iPhone-innstillinger.'; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state !== 'idle') lockScreen();
});

function setState(s) { state = s; localStorage.setItem('state', s); }

async function arm() {
  const t = $('time').value;
  if (!t) return;
  $('arm').disabled = true; $('armMsg').textContent = 'Laster bildemodell (ca. 15 MB, kun første gang)…';
  Alarm.setRamp(num('ramp', 90));
  const unlocked = Alarm.unlock();               // må startes direkte fra trykket
  const ok = await Verify.load();
  await unlocked;
  $('arm').disabled = false;
  if (!ok) { $('armMsg').textContent = 'Kunne ikke laste bildemodellen. Sjekk nettet og prøv igjen.'; return; }
  $('armMsg').textContent = '';
  localStorage.setItem('time', t);
  $('at').textContent = t;
  lockScreen();
  setState('watch'); show('watch');
  clearInterval(tick);
  tick = setInterval(onTick, 1000); onTick();
}

function newTarget() {
  target = Verify.pick(target); targetSince = Date.now();
  $('target').textContent = target.no;
}

function onTick() {
  const now = new Date();
  $('now').textContent = $('now2').textContent = now.toTimeString().slice(0, 8);
  if (state === 'watch' && hhmm(now) === localStorage.getItem('time')) ring();
  if (state === 'ring') {
    Alarm.resume();
    const left = SWITCH_EVERY - Math.floor((Date.now() - targetSince) / 1000);
    if (left <= 0 && !busy) { newTarget(); setMsg('Oppdraget ble byttet!', 'bad'); }
    else $('switch').textContent = busy ? '' : `Byttes om ${left} sek`;
    $('vol').style.width = Math.round(Alarm.level() * 100) + '%';
  }
}

function setMsg(t, cls = '') { $('msg').textContent = t; $('msg').className = cls; }

function ring() {
  setState('ring'); show('ring');
  target = null; newTarget(); setMsg('');
  Alarm.start();
}

function stopAll() {
  clearInterval(tick); Alarm.stop(); wake?.release?.(); wake = null; setState('idle');
}

$('arm').onclick = arm;
$('cancel').onclick = () => { stopAll(); show('setup'); };
$('again').onclick = () => show('setup');
$('ramp').onchange = () => localStorage.setItem('ramp', $('ramp').value);
$('test').onclick = () => Alarm.test();

$('cam').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f || busy) return;
  busy = true;
  const asked = target;            // oppdraget som gjelder NÅ, ikke da du åpnet kameraet
  setMsg('Sjekker bildet…');
  const r = await Verify.matches(f, asked);
  busy = false;
  if (r.ok) { stopAll(); show('done'); return; }
  // Feil bilde: nytt oppdrag med en gang, så du ikke kan prøve samme ting om igjen.
  newTarget();
  setMsg(r.error ? r.error + ' Alarmen fortsetter.' : `Det var ikke ${asked.no}. Nytt oppdrag!`, 'bad');
  Alarm.resume();
};

// Gjenopprett innstillinger
$('time').value = localStorage.getItem('time') || '07:00';
$('ramp').value = num('ramp', 90);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
