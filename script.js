const form = document.getElementById('risk-form');
const riskScore = document.getElementById('riskScore');
const riskBadge = document.getElementById('riskBadge');
const riskReason = document.getElementById('riskReason');
const hoursLeft = document.getElementById('hoursLeft');
const suggestion = document.getElementById('suggestion');
const trafficLight = document.querySelector('.traffic-light');

const controls = {
  deadlineDays: document.getElementById('deadlineDays'),
  taskSize: document.getElementById('taskSize'),
  priority: document.getElementById('priority'),
  history: document.getElementById('history'),
  calendarLoad: document.getElementById('calendarLoad'),
  energyPattern: document.getElementById('energyPattern'),
};

let scoreHistory = JSON.parse(localStorage.getItem('riskScoreHistory')) || [];
let taskProfiles = JSON.parse(localStorage.getItem('taskProfiles')) || [];
let microTasks = [];
let chatHistory = JSON.parse(localStorage.getItem('chatHistory')) || [];
let habitData = JSON.parse(localStorage.getItem('habitData')) || { streak: 0, completedToday: 0, bestTimeSlot: '9-11 AM', tasksCompleted: [] };
let isPanicMode = false;

const valueSpans = new Map(
  [...document.querySelectorAll('[data-value-for]')].map((span) => [span.dataset.valueFor, span]),
);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function scoreRisk() {
  const deadlineDays = Number(controls.deadlineDays.value);
  const taskSize = Number(controls.taskSize.value);
  const priority = Number(controls.priority.value);
  const history = Number(controls.history.value);
  const calendarLoad = Number(controls.calendarLoad.value);
  const energyPattern = Number(controls.energyPattern.value);

  const deadlinePressure = clamp((30 - deadlineDays) * 2.4, 0, 70);
  const workloadPressure = taskSize * 4;
  const priorityPressure = priority * 5;
  const historyPressure = (history - 1) * 12;
  const calendarPressure = calendarLoad * 0.35;
  const energyPressure = (energyPattern - 1) * 10;

  const rawScore =
    8 +
    deadlinePressure +
    workloadPressure +
    priorityPressure +
    historyPressure +
    calendarPressure +
    energyPressure;

  const score = Math.round(clamp(rawScore, 0, 100));

  let level = 'Low';
  let reason = 'You have enough time buffer and a manageable workload.';
  let nextStep = 'Keep momentum with a steady work block';

  if (score >= 67) {
    level = 'High';
    reason = 'Too little free time before deadline. Critical priority + low buffer time.';
    nextStep = 'Reduce scope or move work earlier today';
  } else if (score >= 34) {
    level = 'Medium';
    reason = 'Deadline pressure is building, but there is still room to recover.';
    nextStep = 'Protect a focused block and remove distractions';
  }

  riskScore.textContent = String(score);
  riskBadge.textContent = level;
  riskBadge.style.color = level === 'High' ? 'var(--danger)' : level === 'Medium' ? 'var(--warning)' : 'var(--success)';
  riskReason.textContent = reason;
  suggestion.textContent = nextStep;
  hoursLeft.textContent = String(deadlineDays * 24);
  trafficLight.dataset.level = level;

  Object.entries({
    deadlineDays: `${deadlineDays} days`,
    taskSize: `${taskSize} / 10`,
    calendarLoad: `${calendarLoad}%`,
  }).forEach(([key, label]) => {
    const span = valueSpans.get(key);
    if (span) {
      span.textContent = label;
    }
  });

  updateFactorBreakdown({
    deadlinePressure,
    workloadPressure,
    priorityPressure,
    historyPressure,
    calendarPressure,
    energyPressure,
  });
}

function updateFactorBreakdown(factors) {
  const maxFactor = 70;
  const factorsList = [
    { id: 'deadline', value: factors.deadlinePressure },
    { id: 'task', value: factors.workloadPressure },
    { id: 'priority', value: factors.priorityPressure },
    { id: 'history', value: factors.historyPressure },
    { id: 'calendar', value: factors.calendarPressure },
    { id: 'energy', value: factors.energyPressure },
  ];

  factorsList.forEach(({ id, value }) => {
    const fillEl = document.getElementById(`factor-${id}`);
    const valEl = document.getElementById(`factor-${id}-val`);
    if (fillEl && valEl) {
      const width = Math.min((value / maxFactor) * 100, 100);
      fillEl.style.width = `${width}%`;
      valEl.textContent = value.toFixed(0);
    }
  });
}

function saveProfile() {
  const name = document.getElementById('profileName').value.trim();
  if (!name) {
    alert('Please enter a profile name');
    return;
  }

  const profile = {
    id: Date.now(),
    name,
    deadlineDays: controls.deadlineDays.value,
    taskSize: controls.taskSize.value,
    priority: controls.priority.value,
    history: controls.history.value,
    calendarLoad: controls.calendarLoad.value,
    energyPattern: controls.energyPattern.value,
    score: riskScore.textContent,
    level: riskBadge.textContent,
  };

  taskProfiles.push(profile);
  localStorage.setItem('taskProfiles', JSON.stringify(taskProfiles));
  document.getElementById('profileName').value = '';
  renderProfiles();
}

function loadProfile(id) {
  const profile = taskProfiles.find((p) => p.id === id);
  if (!profile) return;

  controls.deadlineDays.value = profile.deadlineDays;
  controls.taskSize.value = profile.taskSize;
  controls.priority.value = profile.priority;
  controls.history.value = profile.history;
  controls.calendarLoad.value = profile.calendarLoad;
  controls.energyPattern.value = profile.energyPattern;

  scoreRisk();
}

function deleteProfile(id) {
  taskProfiles = taskProfiles.filter((p) => p.id !== id);
  localStorage.setItem('taskProfiles', JSON.stringify(taskProfiles));
  renderProfiles();
}

function renderProfiles() {
  const container = document.getElementById('profileList');
  container.innerHTML = '';

  if (taskProfiles.length === 0) {
    container.innerHTML = '<p style="grid-column: 1/-1; color: var(--muted); text-align: center; padding: 1rem;">No saved profiles yet.</p>';
    return;
  }

  taskProfiles.forEach((profile) => {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.innerHTML = `
      <span class="profile-card-name" title="${profile.name}">${profile.name}</span>
      <span class="profile-card-score">${profile.level} · ${profile.score}pts</span>
      <div class="profile-card-del">Delete</div>
    `;

    card.querySelector('.profile-card-name').addEventListener('click', () => loadProfile(profile.id));
    card.querySelector('.profile-card-del').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteProfile(profile.id);
    });

    container.appendChild(card);
  });
}

function addToHistory(score, level) {
  scoreHistory.push({
    timestamp: new Date().toLocaleString(),
    score,
    level,
  });

  if (scoreHistory.length > 20) {
    scoreHistory.shift();
  }

  localStorage.setItem('riskScoreHistory', JSON.stringify(scoreHistory));
  renderHistory();
}

function renderHistory() {
  const chart = document.getElementById('historyChart');
  const table = document.getElementById('historyTable');

  chart.innerHTML = '';
  table.innerHTML = '';

  if (scoreHistory.length === 0) {
    chart.innerHTML = '<div class="history-empty" style="width: 100%; display: flex; align-items: center; justify-content: center;">Start scoring tasks to see trends</div>';
    table.innerHTML = '<div class="history-empty">No history yet. Score a task to begin tracking.</div>';
    return;
  }

  const maxScore = 100;
  scoreHistory.forEach((entry) => {
    const barHeight = (entry.score / maxScore) * 100;
    const bar = document.createElement('div');
    bar.className = `history-bar ${entry.level.toLowerCase()}`;
    bar.style.minHeight = `${barHeight}%`;
    bar.title = `${entry.score} (${entry.level}) - ${entry.timestamp}`;
    chart.appendChild(bar);
  });

  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Score</th><th>Level</th><th>Time</th></tr>';
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  scoreHistory.slice().reverse().forEach((entry) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${entry.score}</td><td>${entry.level}</td><td>${entry.timestamp}</td>`;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
}

function togglePanicMode() {
  isPanicMode = !isPanicMode;
  const normalView = document.getElementById('normalView');
  const panicView = document.getElementById('panicModeView');
  const panicBtn = document.getElementById('panicModeBtn');

  if (isPanicMode) {
    normalView.classList.add('hidden');
    panicView.classList.remove('hidden');
    panicBtn.textContent = 'Panic Mode On';
    panicBtn.classList.add('active');
    renderPanicMode();
  } else {
    normalView.classList.remove('hidden');
    panicView.classList.add('hidden');
    panicBtn.textContent = 'Panic Mode Off';
    panicBtn.classList.remove('active');
  }
}

function renderPanicMode() {
  const taskList = document.getElementById('panicTaskList');
  taskList.innerHTML = '';

  if (microTasks.length === 0) {
    taskList.innerHTML = '<p style="color: var(--muted); text-align: center; padding: 1rem;">No micro-tasks. Break down a task first.</p>';
    return;
  }

  const urgentTasks = microTasks.slice(0, 5);
  urgentTasks.forEach((task, idx) => {
    const taskEl = document.createElement('div');
    taskEl.className = 'panic-task';
    taskEl.innerHTML = `<span>${idx + 1}. ${task.name} (${task.time})</span>`;
    taskEl.addEventListener('click', () => {
      taskEl.classList.toggle('done');
    });
    taskList.appendChild(taskEl);
  });
}

function startFocusTimer() {
  let timeLeft = 20 * 60;
  const timerDisplay = document.getElementById('panicTimer');

  const focusInterval = setInterval(() => {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    timerDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

    if (timeLeft <= 0) {
      clearInterval(focusInterval);
      alert('Focus time done! Check in at #2 of your micro-task list.');
      renderPanicCheckins();
    }
    timeLeft--;
  }, 1000);
}

function renderPanicCheckins() {
  const checkins = document.getElementById('panicCheckins');
  checkins.innerHTML = '<h3 style="margin-top: 0;">20-min check-ins</h3>';

  for (let i = 1; i <= 3; i++) {
    const checkIn = document.createElement('div');
    checkIn.style.cssText = 'padding: 0.8rem; margin: 0.6rem 0; background: rgba(255,255,255,0.06); border-radius: 12px; cursor: pointer; border-left: 4px solid var(--warning);';
    checkIn.innerHTML = `<strong>#${i} Check-in (${i * 20} min)</strong><p style="color: var(--muted); margin: 0.3rem 0 0; font-size: 0.9rem;">On track? Resume or reschedule.</p>`;
    checkins.appendChild(checkIn);
  }
}

function breakDownTask() {
  const input = document.getElementById('taskToBreakdown').value.trim();
  if (!input) {
    alert('Enter a task to break down');
    return;
  }

  const breakdowns = {
    'prepare interview': [
      { name: 'Research company', time: '20 mins' },
      { name: 'Review projects & achievements', time: '15 mins' },
      { name: 'Mock Q&A session', time: '25 mins' },
      { name: 'Final review & confidence check', time: '10 mins' },
    ],
    'write report': [
      { name: 'Gather data & outline', time: '20 mins' },
      { name: 'Write intro & summary', time: '15 mins' },
      { name: 'Draft main sections', time: '30 mins' },
      { name: 'Edit & format', time: '15 mins' },
    ],
    'design mockup': [
      { name: 'Sketch wireframe', time: '20 mins' },
      { name: 'Set up grid & colors', time: '15 mins' },
      { name: 'Build components', time: '25 mins' },
      { name: 'Polish & export', time: '10 mins' },
    ],
  };

  const taskLower = input.toLowerCase();
  let tasks = breakdowns['prepare interview'];

  Object.keys(breakdowns).forEach((key) => {
    if (taskLower.includes(key)) {
      tasks = breakdowns[key];
    }
  });

  if (!breakdowns[taskLower]) {
    tasks = [
      { name: `Plan ${input}`, time: '15 mins' },
      { name: `Execute ${input}`, time: '30 mins' },
      { name: `Review & refine`, time: '15 mins' },
    ];
  }

  microTasks = tasks;
  localStorage.setItem('microTasks', JSON.stringify(microTasks));
  document.getElementById('taskToBreakdown').value = '';
  renderMicroTasks();
  renderCalendarSlots();
}

function renderMicroTasks() {
  const list = document.getElementById('microTaskList');
  list.innerHTML = '';

  microTasks.forEach((task) => {
    const el = document.createElement('div');
    el.className = 'micro-task';
    el.draggable = true;
    el.innerHTML = `
      <div class="micro-task-info">
        <div class="micro-task-name">${task.name}</div>
        <div class="micro-task-time">${task.time}</div>
      </div>
    `;

    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(task));
      el.classList.add('dragging');
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
    });

    list.appendChild(el);
  });
}

function renderCalendarSlots() {
  const container = document.getElementById('calendarSlots');
  container.innerHTML = '';

  const slots = [
    { time: '9–10 AM' },
    { time: '10–11 AM' },
    { time: '11 AM–12 PM' },
    { time: '1–2 PM' },
    { time: '2–3 PM' },
    { time: '3–4 PM' },
  ];

  slots.forEach((slot) => {
    const slotEl = document.createElement('div');
    slotEl.className = 'calendar-slot';
    slotEl.innerHTML = slot.time;
    slotEl.dataset.slot = slot.time;

    slotEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      slotEl.style.backgroundColor = 'rgba(115, 240, 197, 0.2)';
    });

    slotEl.addEventListener('dragleave', () => {
      slotEl.style.backgroundColor = '';
    });

    slotEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const task = JSON.parse(e.dataTransfer.getData('text/plain'));
      slotEl.innerHTML = `<strong>${task.name}</strong><p style="margin: 0; color: var(--muted); font-size: 0.8rem;">${task.time}</p>`;
      slotEl.classList.add('booked');
      slotEl.style.backgroundColor = '';
    });

    container.appendChild(slotEl);
  });
}

function autoSchedule() {
  const slots = document.querySelectorAll('.calendar-slot');
  const tasks = microTasks.slice();

  slots.forEach((slot, idx) => {
    if (tasks[idx]) {
      const task = tasks[idx];
      slot.innerHTML = `<strong>${task.name}</strong><p style="margin: 0; color: var(--muted); font-size: 0.8rem;">${task.time}</p>`;
      slot.classList.add('booked');
    }
  });
}

function generateNudges() {
  const container = document.getElementById('nudgesList');
  container.innerHTML = '';

  const now = new Date();
  const hour = now.getHours();
  const energyLevel = Number(controls.energyPattern.value);

  const nudges = [];

  if (hour < 11 && microTasks.length > 0) {
    nudges.push({
      title: '⏰ Deep work window',
      msg: `You have 25 mins before your next meeting. Start "${microTasks[0].name}" now.`,
    });
  }

  if (energyLevel === 3 && hour > 18) {
    nudges.push({
      title: '⚡ Energy check',
      msg: 'Energy seems low at night. Move coding block to 9 AM tomorrow?',
    });
  }

  if (Number(riskScore.textContent) >= 67) {
    nudges.push({
      title: '🚨 High risk detected',
      msg: 'Your deadline risk is critical. Consider panic mode for a focused plan.',
    });
  }

  if (microTasks.length > 0 && Number(controls.deadlineDays.value) <= 3) {
    nudges.push({
      title: '⏱️ Urgent deadline',
      msg: `Only ${controls.deadlineDays.value} days left. Prioritize "${microTasks[0].name}".`,
    });
  }

  nudges.forEach((nudge) => {
    const el = document.createElement('div');
    el.className = 'nudge-item';
    el.innerHTML = `
      <div class="nudge-text">
        <strong>${nudge.title}</strong>
        <p>${nudge.msg}</p>
      </div>
      <div class="nudge-dismiss">✕</div>
    `;

    el.querySelector('.nudge-dismiss').addEventListener('click', () => {
      el.remove();
    });

    container.appendChild(el);
  });

  if (nudges.length === 0) {
    container.innerHTML = '<p style="color: var(--muted); text-align: center; padding: 1rem;">No nudges right now. Keep up the pace!</p>';
  }
}

function updateHabits() {
  const streakEl = document.getElementById('habitStreak');
  const weeklyEl = document.getElementById('weeklyScore');

  habitData.streak = scoreHistory.length > 0 ? scoreHistory.length : 0;
  habitData.completedToday = Math.floor(Math.random() * 8);
  const weeklyScore = Math.round((habitData.completedToday / 5) * 100);

  streakEl.textContent = `${habitData.streak} days`;
  weeklyEl.textContent = `${weeklyScore}%`;

  renderRecommendations();
  localStorage.setItem('habitData', JSON.stringify(habitData));
}

function renderRecommendations() {
  const container = document.getElementById('personalizedRecommendations');
  container.innerHTML = '';

  const recs = [];

  if (habitData.completedToday >= 4) {
    recs.push({
      icon: '🌟',
      title: 'On a roll',
      text: "You've completed 4+ tasks today. Great momentum!",
    });
  }

  if (habitData.streak > 7) {
    recs.push({
      icon: '🔥',
      title: 'Streak active',
      text: `You're ${habitData.streak} days in. Don't break it!`,
    });
  }

  recs.push({
    icon: '📈',
    title: 'Morning boost',
    text: 'You complete 2x more tasks in morning slots (9–11 AM). Schedule deep work then.',
  });

  recs.push({
    icon: '💡',
    title: 'Smart timing',
    text: 'Based on your patterns, move low-energy tasks to afternoon blocks.',
  });

  recs.forEach((rec) => {
    const el = document.createElement('div');
    el.className = 'recommendation-item';
    el.innerHTML = `
      <div class="recommendation-icon">${rec.icon}</div>
      <div class="recommendation-text">
        <strong>${rec.title}</strong>
        <p>${rec.text}</p>
      </div>
    `;
    container.appendChild(el);
  });
}

function initChat() {
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const toggleBtn = document.getElementById('toggleChatBtn');
  const chatBox = document.getElementById('chatBox');

  chatSendBtn.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });

  toggleBtn.addEventListener('click', () => {
    chatBox.classList.toggle('collapsed');
    toggleBtn.textContent = chatBox.classList.contains('collapsed') ? '▲' : '▼';
  });

  renderChatMessages();
}

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();

  if (!msg) return;

  chatHistory.push({ role: 'user', text: msg });

  const response = parseCommand(msg);
  chatHistory.push({ role: 'assistant', text: response });

  input.value = '';
  localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  renderChatMessages();
}

function parseCommand(msg) {
  const lower = msg.toLowerCase();

  if (lower.includes('what now') || lower.includes('what should') || lower.includes('help')) {
    return `Start with "${microTasks[0]?.name || 'Break down a task first'}". ${microTasks[0]?.time || ''}`;
  }

  if (lower.includes('reschedule') || lower.includes('move')) {
    return 'Task rescheduled to after 5 PM. Updated in calendar.';
  }

  if (lower.includes('finished') || lower.includes('done')) {
    habitData.completedToday++;
    return 'Great job! Moving to next task. Keep the streak alive!';
  }

  if (lower.includes('energy') || lower.includes('tired')) {
    return 'Energy low? Take a 10-min break or switch to easier tasks. Hydrate!';
  }

  if (lower.includes('panic')) {
    togglePanicMode();
    return 'Activating Panic Mode. Focus on minimum viable completion.';
  }

  return 'Command understood. Updating your plan now.';
}

function renderChatMessages() {
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';

  chatHistory.slice(-6).forEach((entry) => {
    const msgEl = document.createElement('div');
    msgEl.className = `chat-message ${entry.role}`;
    msgEl.textContent = entry.text;
    container.appendChild(msgEl);
  });

  container.scrollTop = container.scrollHeight;
}

Object.values(controls).forEach((control) => {
  control.addEventListener('input', scoreRisk);
  control.addEventListener('change', scoreRisk);
});

form.addEventListener('submit', (event) => event.preventDefault());

document.getElementById('panicModeBtn').addEventListener('click', togglePanicMode);
document.getElementById('exitPanicBtn').addEventListener('click', togglePanicMode);
document.getElementById('focusTimerBtn').addEventListener('click', startFocusTimer);
document.getElementById('breakdownBtn').addEventListener('click', breakDownTask);
document.getElementById('autoScheduleBtn').addEventListener('click', autoSchedule);
document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
document.getElementById('loadProfileBtn').addEventListener('click', renderProfiles);
document.getElementById('clearHistoryBtn').addEventListener('click', () => {
  if (confirm('Clear all score history?')) {
    scoreHistory = [];
    localStorage.setItem('riskScoreHistory', JSON.stringify(scoreHistory));
    renderHistory();
  }
});

setInterval(() => {
  generateNudges();
  updateHabits();
}, 5000);

setInterval(() => {
  const currentScore = Number(riskScore.textContent);
  const currentLevel = riskBadge.textContent;
  const lastEntry = scoreHistory[scoreHistory.length - 1];
  if (!lastEntry || lastEntry.score !== currentScore) {
    addToHistory(currentScore, currentLevel);
  }
}, 3000);

initChat();
renderMicroTasks();
renderCalendarSlots();
generateNudges();
updateHabits();
scoreRisk();
renderProfiles();
renderHistory();
