const CHANNEL_ID = 3307818;
const USE_LOCAL = false;
let trendChart = null;
let pieChart = null;
let barChart = null;
let intensityChart = null;
let currentTrend = 2;

let lastMotionTime = 0;
const COOLDOWN_MS = 45000;
const DIM_LEVEL = 0.35;

const prevState = {
  ldr: null, pir: null, gas: null,
  avgLdr: null, avgMotion: null, avgGas: null,
  lightState: null
};

// ─── Web Audio Setup ───────────────────────────────────────────────────────────
let audioCtx = null;
let audioUnlocked = false;
let lastGasAlertTime = 0;
let lastMotionBeepTime = 0;
const GAS_ALERT_COOLDOWN = 10000;  // beep at most every 10s for gas
const MOTION_BEEP_COOLDOWN = 3000; // beep at most every 3s for motion

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// Unlock audio on first user interaction (browser policy)
function unlockAudio() {
  if (audioUnlocked) return;
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
  audioUnlocked = true;
}

document.addEventListener('click', unlockAudio, { once: false });
document.addEventListener('keydown', unlockAudio, { once: false });

/**
 * Play a tone
 * @param {number} frequency - Hz
 * @param {number} duration - ms
 * @param {string} type - 'sine' | 'square' | 'sawtooth' | 'triangle'
 * @param {number} volume - 0 to 1
 * @param {number} startDelay - seconds from now
 */
function playTone(frequency, duration, type = 'sine', volume = 0.3, startDelay = 0) {
  if (!audioUnlocked) return;
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + startDelay);

  // Fade in + out to avoid clicks
  gain.gain.setValueAtTime(0, ctx.currentTime + startDelay);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + startDelay + 0.01);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startDelay + duration / 1000 - 0.01);

  osc.start(ctx.currentTime + startDelay);
  osc.stop(ctx.currentTime + startDelay + duration / 1000);
}

// ⚠️ Gas Danger Alert — harsh descending alarm, 3 pulses
function playGasAlert() {
  const now = Date.now();
  if (now - lastGasAlertTime < GAS_ALERT_COOLDOWN) return;
  lastGasAlertTime = now;

  // 3 descending beeps: 880Hz → 660Hz → 440Hz
  playTone(880, 300, 'sawtooth', 0.4, 0.0);
  playTone(660, 300, 'sawtooth', 0.4, 0.35);
  playTone(440, 400, 'sawtooth', 0.4, 0.70);
}

// 🚶 Motion Detected — soft double blip
function playMotionBeep() {
  const now = Date.now();
  if (now - lastMotionBeepTime < MOTION_BEEP_COOLDOWN) return;
  lastMotionBeepTime = now;

  playTone(1200, 80, 'sine', 0.15, 0.0);
  playTone(1400, 80, 'sine', 0.15, 0.1);
}

// 🌙 Cooldown entering standby — soft descending chime
function playDimChime() {
  playTone(600, 200, 'triangle', 0.12, 0.0);
  playTone(400, 300, 'triangle', 0.10, 0.2);
}

// ─── Data Fetch ────────────────────────────────────────────────────────────────
async function fetchData() {
  try {
    const url = USE_LOCAL
      ? './python/data.json'
      : `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?results=80`;
    const res = await fetch(url);
    const json = await res.json();
    return json.feeds || [];
  } catch (e) {
    console.error("Fetch error:", e);
    return [];
  }
}

// ─── Main Update ───────────────────────────────────────────────────────────────
async function updateAllData() {
  const feeds = await fetchData();
  if (feeds.length === 0) return;

  const latest = feeds[feeds.length - 1];
  const ldr = parseFloat(latest.field1) || 768;
  const pir = parseFloat(latest.field2) || 0;
  const gas = parseFloat(latest.field3) || 544;

  const avgLDR = (feeds.reduce((a, b) => a + parseFloat(b.field1 || 0), 0) / feeds.length).toFixed(0);
  const avgMotion = ((feeds.filter(f => parseFloat(f.field2) === 1).length / feeds.length) * 100).toFixed(0);
  const avgGas = (feeds.reduce((a, b) => a + parseFloat(b.field3 || 0), 0) / feeds.length).toFixed(0);

  // --- LDR ---
  if (ldr !== prevState.ldr) {
    const ldrEl = document.getElementById('ldr-value');
    if (ldrEl) { ldrEl.textContent = Math.round(ldr); flashValue(ldrEl); }
    const ldrBadge = document.getElementById('ldr-badge');
    if (ldrBadge) {
      if (ldr < 450) {
        ldrBadge.textContent = "NIGHT"; ldrBadge.className = "badge red";
        document.getElementById('ldr-desc').textContent = "Dark conditions";
      } else {
        ldrBadge.textContent = "DAY"; ldrBadge.className = "badge yellow";
        document.getElementById('ldr-desc').textContent = "Bright daylight";
      }
    }
    prevState.ldr = ldr;
  }

  // --- PIR ---
  if (pir !== prevState.pir) {
    const pirEl = document.getElementById('pir-value');
    if (pirEl) { pirEl.textContent = pir === 1 ? "DETECTED" : "UNDETECTED"; flashValue(pirEl); }
    const pirBadge = document.getElementById('pir-badge');
    if (pirBadge) {
      pirBadge.textContent = pir === 1 ? "ACTIVE" : "INACTIVE";
      pirBadge.className = pir === 1 ? "badge green" : "badge red";
      document.getElementById('pir-desc').textContent = pir === 1 ? "Motion detected" : "No motion detected";
    }
    // 🔊 Play motion beep when motion is newly detected
    if (pir === 1 && prevState.pir !== 1) playMotionBeep();
    prevState.pir = pir;
  }

  // --- Gas ---
  if (gas !== prevState.gas) {
    const gasEl = document.getElementById('gas-value');
    if (gasEl) { gasEl.textContent = Math.round(gas); flashValue(gasEl); }
    const gasBadge = document.getElementById('gas-badge');
    if (gasBadge) {
      if (gas > 500) {
        gasBadge.textContent = "DANGER"; gasBadge.className = "badge red";
        document.getElementById('gas-desc').textContent = "High pollution detected";
        playGasAlert(); // 🔊 Gas danger alert
      } else {
        gasBadge.textContent = "SAFE"; gasBadge.className = "badge green";
        document.getElementById('gas-desc').textContent = "Good air quality";
      }
    }
    prevState.gas = gas;
  }

  // --- Averages ---
  if (avgLDR !== prevState.avgLdr) {
    const el = document.getElementById('avg-ldr');
    if (el) el.textContent = avgLDR;
    prevState.avgLdr = avgLDR;
  }
  if (avgMotion !== prevState.avgMotion) {
    const el = document.getElementById('avg-motion');
    if (el) el.textContent = avgMotion + "%";
    prevState.avgMotion = avgMotion;
  }
  if (avgGas !== prevState.avgGas) {
    const el = document.getElementById('avg-gas');
    if (el) el.textContent = avgGas + " PPM";
    prevState.avgGas = avgGas;
  }

  // --- Timestamp ---
  const lastUpdatedEl = document.getElementById('last-updated');
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = `Last Updated: ${new Date(latest.created_at).toLocaleTimeString('en-IN')}`;
  }

  if (USE_LOCAL) {
    const indicator = document.querySelector('.live-indicator');
    if (indicator) indicator.innerHTML = '<span class="dot"></span> LIVE • LOCAL';
  }

  updateStreetLight(ldr, pir);
  updateTrendChart(feeds);
  updateAdvancedCharts(feeds);
}

// ─── Flash Helper ──────────────────────────────────────────────────────────────
function flashValue(el) {
  if (!el) return;
  el.classList.remove('value-flash');
  void el.offsetWidth;
  el.classList.add('value-flash');
  setTimeout(() => el.classList.remove('value-flash'), 300);
}

// ─── Street Light ──────────────────────────────────────────────────────────────
function updateStreetLight(ldr, pir) {
  const now = Date.now();
  if (pir === 1) lastMotionTime = now;

  const timeSinceMotion = now - lastMotionTime;
  const inCooldown = lastMotionTime > 0 && timeSinceMotion < COOLDOWN_MS;
  const cooldownSecsLeft = Math.ceil((COOLDOWN_MS - timeSinceMotion) / 1000);

  let newState;
  if (ldr >= 450) newState = 'off';
  else if (pir === 1) newState = 'on';
  else if (inCooldown) newState = 'dim';
  else newState = 'standby';

  const bulb = document.getElementById('light-bulb');
  const status = document.getElementById('light-status');
  const reason = document.getElementById('light-reason');

  if (newState !== prevState.lightState) {
    const map = {
      off: { bulbClass: 'bulb off', glow: '0', statusText: 'OFF', statusClass: 'status-text off', reasonText: 'Daylight detected' },
      on: { bulbClass: 'bulb on', glow: '1', statusText: 'ON', statusClass: 'status-text on', reasonText: 'Motion + Dark detected' },
      standby: { bulbClass: 'bulb standby', glow: '0.1', statusText: 'STANDBY', statusClass: 'status-text standby', reasonText: 'Dark — awaiting motion' },
    };

    if (newState !== 'dim') {
      const m = map[newState];
      bulb.className = m.bulbClass;
      bulb.style.setProperty('--glow-intensity', m.glow);
      status.textContent = m.statusText;
      status.className = m.statusClass;
      reason.textContent = m.reasonText;
    } else {
      bulb.className = 'bulb dim';
      bulb.style.setProperty('--glow-intensity', String(DIM_LEVEL));
      status.textContent = 'DIM';
      status.className = 'status-text dim';
    }

    // 🔊 Play chime when transitioning into dim from on
    if (newState === 'dim' && prevState.lightState === 'on') playDimChime();

    prevState.lightState = newState;
  }

  // Countdown text — only the reason span, only during dim
  if (newState === 'dim') {
    const newReason = `Motion ended — dimming in ${cooldownSecsLeft}s`;
    if (reason.textContent !== newReason) reason.textContent = newReason;
  }
}

// ─── Manual Control ────────────────────────────────────────────────────────────
function manualLight(state) {
  const bulb = document.getElementById('light-bulb');
  const status = document.getElementById('light-status');
  const reason = document.getElementById('light-reason');

  if (state === 'ON') {
    bulb.className = 'bulb on';
    status.textContent = 'ON';
    status.className = 'status-text on';
    reason.textContent = 'Manually turned ON';
    prevState.lightState = 'on';
  } else {
    bulb.className = 'bulb off';
    status.textContent = 'OFF';
    status.className = 'status-text off';
    reason.textContent = 'Manually turned OFF';
    prevState.lightState = 'off';
  }
}

// ─── Charts ────────────────────────────────────────────────────────────────────
function updateTrendChart(feeds) {
  const ctx = document.getElementById('trendChart');
  const labels = feeds.map(f => new Date(f.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  let dataPoints = [], color = '#c026d3';

  if (currentTrend === 0) {
    dataPoints = feeds.map(f => parseFloat(f.field1) || 0); color = '#fcd34d';
  } else if (currentTrend === 1) {
    dataPoints = feeds.map(f => (parseFloat(f.field2) || 0) * 100); color = '#22ff88';
  } else {
    dataPoints = feeds.map(f => parseFloat(f.field3) || 0); color = '#c026d3';
  }

  if (trendChart) {
    trendChart.data.labels = labels;
    trendChart.data.datasets[0].data = dataPoints;
    trendChart.data.datasets[0].borderColor = color;
    trendChart.data.datasets[0].label = currentTrend === 0 ? 'LDR' : currentTrend === 1 ? 'Motion' : 'Gas (PPM)';
    trendChart.update('none');
  } else {
    trendChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: currentTrend === 0 ? 'LDR' : currentTrend === 1 ? 'Motion' : 'Gas (PPM)', data: dataPoints, borderColor: color, borderWidth: 4, tension: 0.4, pointRadius: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { y: { grid: { color: '#333' } }, x: { grid: { color: '#333' } } } }
    });
  }
}

function updateAdvancedCharts(feeds) {
  const onCount = feeds.filter(f => parseFloat(f.field1) < 450 && parseFloat(f.field2) === 1).length;
  const standbyCount = feeds.filter(f => parseFloat(f.field1) < 450 && parseFloat(f.field2) === 0).length;
  const offCount = feeds.length - onCount - standbyCount;
  const pieData = [onCount || 35, standbyCount || 30, offCount || 35];
  const intensityData = feeds.slice(0, 15).map(f => parseFloat(f.field3) || 300);

  if (pieChart) {
    pieChart.data.datasets[0].data = pieData;
    pieChart.update('none');
  } else {
    pieChart = new Chart(document.getElementById('pieChart'), {
      type: 'pie',
      data: { labels: ['ON', 'Standby', 'OFF'], datasets: [{ data: pieData, backgroundColor: ['#22ff88', '#eab308', '#64748b'] }] },
      options: { animation: false }
    });
  }

  if (!barChart) {
    barChart = new Chart(document.getElementById('barChart'), {
      type: 'bar',
      data: { labels: ['00-06', '06-12', '12-18', '18-00'], datasets: [{ label: 'LDR', data: [420, 810, 650, 280], backgroundColor: '#fcd34d' }, { label: 'Gas', data: [210, 340, 450, 520], backgroundColor: '#c026d3' }] }
    });
  }

  if (intensityChart) {
    intensityChart.data.datasets[0].data = intensityData;
    intensityChart.update('none');
  } else {
    intensityChart = new Chart(document.getElementById('intensityChart'), {
      type: 'bar',
      data: { labels: Array.from({ length: 15 }, (_, i) => i + 1), datasets: [{ label: 'Gas PPM', data: intensityData, backgroundColor: '#ef4444' }] },
      options: { animation: false }
    });
  }
}

// ─── Navigation & UI ───────────────────────────────────────────────────────────
function switchTrend(n) {
  currentTrend = n;
  document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', i === n));
  fetchData().then(updateTrendChart);
}

function navigateTo(section) {
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  document.getElementById('section-' + section).style.display = 'block';
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('nav-' + section).classList.add('active');
}

function showSensorModal(n) {
  const modals = [
    { title: "LDR Sensor", body: "A Light Dependent Resistor (LDR) measures ambient light intensity. In this project, it helps the system automatically detect day or night and control street lights accordingly." },
    { title: "PIR Motion Sensor", body: "Passive Infrared Sensor detects movement of humans or vehicles. When motion is detected in dark conditions, the street light turns to 100% brightness. This feature saves up to 68% energy." },
    { title: "MQ-135 Gas Sensor", body: "Detects harmful gases and air pollution levels. If the value exceeds 500 PPM, the system shows danger alert and records data for smart city monitoring." }
  ];
  document.getElementById('modal-title').innerHTML = modals[n].title;
  document.getElementById('modal-body').innerHTML = `<p>${modals[n].body}</p>`;
  document.getElementById('modal').style.display = 'flex';
}

function closeModal() { document.getElementById('modal').style.display = 'none'; }

function showAutoLogic() {
  alert("🔧 AUTO LOGIC:\n\nLDR < 450 && PIR = 1 → Light ON\nLDR < 450 && PIR = 0 + cooldown → DIM (45s)\nLDR < 450 && no recent motion → STANDBY\nLDR ≥ 450 → Light OFF");
}

function refreshData() { updateAllData(); }

// ─── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await updateAllData();
  const interval = USE_LOCAL ? 2000 : 15000;
  setInterval(updateAllData, interval);
}

window.onload = init;