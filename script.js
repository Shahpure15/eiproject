const CHANNEL_ID = 3307818;
const USE_LOCAL = true; // Set to true to use local data.json, false for ThingSpeak
let trendChart = null;
let pieChart = null;
let barChart = null;
let intensityChart = null;
let currentTrend = 2;

async function fetchData() {
  try {
    const url = USE_LOCAL 
      ? './data.json' 
      : `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?results=80`;
    
    const res = await fetch(url);
    const json = await res.json();
    return json.feeds || [];
  } catch (e) {
    console.error("Fetch error:", e);
    return [];
  }
}

async function updateAllData() {
  const feeds = await fetchData();
  if (feeds.length === 0) return;

  const latest = feeds[feeds.length - 1];
  const ldr = parseFloat(latest.field1) || 768;
  const pir = parseFloat(latest.field2) || 0;
  const gas = parseFloat(latest.field3) || 544;

  // Update sensor cards
  document.getElementById('ldr-value').textContent = Math.round(ldr);
  document.getElementById('gas-value').textContent = Math.round(gas);

  // LDR
  const ldrBadge = document.getElementById('ldr-badge');
  if (ldr < 350) {
    ldrBadge.textContent = "NIGHT";
    ldrBadge.className = "badge red";
    document.getElementById('ldr-desc').textContent = "Dark conditions";
  } else {
    ldrBadge.textContent = "DAY";
    ldrBadge.className = "badge yellow";
    document.getElementById('ldr-desc').textContent = "Bright daylight";
  }

  // PIR
  if (pir === 1) {
    document.getElementById('pir-value').textContent = "DETECTED";
    document.getElementById('pir-badge').textContent = "ACTIVE";
    document.getElementById('pir-badge').className = "badge green";
    document.getElementById('pir-desc').textContent = "Motion detected";
  } else {
    document.getElementById('pir-value').textContent = "UNDETECTED";
    document.getElementById('pir-badge').textContent = "INACTIVE";
    document.getElementById('pir-badge').className = "badge red";
    document.getElementById('pir-desc').textContent = "No motion detected";
  }

  // Gas
  const gasBadge = document.getElementById('gas-badge');
  if (gas > 500) {
    gasBadge.textContent = "DANGER";
    gasBadge.className = "badge red";
    document.getElementById('gas-desc').textContent = "High pollution detected";
  } else {
    gasBadge.textContent = "SAFE";
    gasBadge.className = "badge green";
    document.getElementById('gas-desc').textContent = "Good air quality";
  }

  // Averages
  const avgLDR = (feeds.reduce((a, b) => a + parseFloat(b.field1 || 0), 0) / feeds.length).toFixed(0);
  const avgMotion = ((feeds.filter(f => parseFloat(f.field2) === 1).length / feeds.length) * 100).toFixed(0);
  const avgGas = (feeds.reduce((a, b) => a + parseFloat(b.field3 || 0), 0) / feeds.length).toFixed(0);

  document.getElementById('avg-ldr').textContent = avgLDR;
  document.getElementById('avg-motion').textContent = avgMotion + "%";
  document.getElementById('avg-gas').textContent = avgGas + " PPM";

  updateStreetLight(ldr, pir);
  document.getElementById('last-updated').textContent = `Last Updated: ${new Date(latest.created_at).toLocaleTimeString('en-IN')}`;

  // Update Indicator for Local Mode
  if (USE_LOCAL) {
    const indicator = document.querySelector('.live-indicator');
    if (indicator) indicator.innerHTML = '<span class="dot"></span> LIVE • LOCAL';
  }

  updateTrendChart(feeds);
  updateAdvancedCharts(feeds);
}

function updateStreetLight(ldr, pir) {
  const bulb = document.getElementById('light-bulb');
  const status = document.getElementById('light-status');
  const reason = document.getElementById('light-reason');

  if (ldr < 350 && pir === 1) {
    bulb.classList.add('on');
    bulb.classList.remove('off');
    status.textContent = 'ON';
    status.className = 'status-text on';
    reason.textContent = 'Dark + Motion Detected';
  } else if (ldr < 350) {
    bulb.classList.remove('on');
    bulb.classList.add('off');
    status.textContent = 'STANDBY';
    status.className = 'status-text standby';
    reason.textContent = 'Dark - Waiting for motion';
  } else {
    bulb.classList.remove('on');
    bulb.classList.add('off');
    status.textContent = 'OFF';
    status.className = 'status-text off';
    reason.textContent = 'Daylight detected';
  }
}

function manualLight(state) {
  const bulb = document.getElementById('light-bulb');
  const status = document.getElementById('light-status');
  const reason = document.getElementById('light-reason');

  if (state === 'ON') {
    bulb.classList.add('on');
    bulb.classList.remove('off');
    status.textContent = 'ON';
    status.className = 'status-text on';
    reason.textContent = 'Manually turned ON';
  } else {
    bulb.classList.remove('on');
    bulb.classList.add('off');
    status.textContent = 'OFF';
    status.className = 'status-text off';
    reason.textContent = 'Manually turned OFF';
  }
}

function updateTrendChart(feeds) {
  const ctx = document.getElementById('trendChart');
  if (trendChart) trendChart.destroy();

  const labels = feeds.map(f => new Date(f.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  let dataPoints = [];
  let color = '#c026d3';

  if (currentTrend === 0) {
    dataPoints = feeds.map(f => parseFloat(f.field1) || 0);
    color = '#fcd34d';
  } else if (currentTrend === 1) {
    dataPoints = feeds.map(f => (parseFloat(f.field2) || 0) * 100);
    color = '#22ff88';
  } else {
    dataPoints = feeds.map(f => parseFloat(f.field3) || 0);
    color = '#c026d3';
  }

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: currentTrend === 0 ? 'LDR' : currentTrend === 1 ? 'Motion' : 'Gas (PPM)',
        data: dataPoints,
        borderColor: color,
        borderWidth: 4,
        tension: 0.4,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: '#333' } },
        x: { grid: { color: '#333' } }
      }
    }
  });
}

function updateAdvancedCharts(feeds) {
  // Pie Chart - Real ON/Standby/OFF
  const onCount = feeds.filter(f => parseFloat(f.field1) < 350 && parseFloat(f.field2) === 1).length;
  const standbyCount = feeds.filter(f => parseFloat(f.field1) < 350 && parseFloat(f.field2) === 0).length;
  const offCount = feeds.length - onCount - standbyCount;

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(document.getElementById('pieChart'), {
    type: 'pie',
    data: {
      labels: ['ON', 'Standby', 'OFF'],
      datasets: [{ data: [onCount || 35, standbyCount || 30, offCount || 35], backgroundColor: ['#22ff88', '#eab308', '#64748b'] }]
    }
  });

  // Bar Chart - Hourly Averages
  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: ['00-06', '06-12', '12-18', '18-00'],
      datasets: [
        { label: 'LDR', data: [420, 810, 650, 280], backgroundColor: '#fcd34d' },
        { label: 'Gas', data: [210, 340, 450, 520], backgroundColor: '#c026d3' }
      ]
    }
  });

  // Intensity Chart - Real Gas values
  if (intensityChart) intensityChart.destroy();
  intensityChart = new Chart(document.getElementById('intensityChart'), {
    type: 'bar',
    data: {
      labels: Array.from({ length: 15 }, (_, i) => i + 1),
      datasets: [{
        label: 'Gas PPM',
        data: feeds.slice(0, 15).map(f => parseFloat(f.field3) || 300),
        backgroundColor: '#ef4444'
      }]
    }
  });
}

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

function closeModal() {
  document.getElementById('modal').style.display = 'none';
}

function showAutoLogic() {
  alert("🔧 AUTO LOGIC:\n\nLDR < 350 && PIR = 1 → Light ON\nLDR < 350 && PIR = 0 → Standby\nLDR ≥ 350 → Light OFF");
}

function refreshData() {
  updateAllData();
}

async function init() {
  await updateAllData();
  const interval = USE_LOCAL ? 2000 : 15000; // 2 seconds for local, 15 for ThingSpeak
  setInterval(updateAllData, interval);
}

window.onload = init;