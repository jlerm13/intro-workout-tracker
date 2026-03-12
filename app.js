let currentPhase       = 1;
let currentSession     = 1;
let completedExercises = {};
let sessionData        = {};
let cardCollapsed      = {};
let completedSets      = {};   // tracks confirmed set rows: key = "sk-exIdx-setIdx"
let workoutDates       = [];   // ISO date strings of days with logged sets

// Rest timer state
let restInterval     = null;
let restSecondsLeft  = 0;
let restTotalSeconds = 0;

// Focus mode state
let focusExIdx       = 0;
let focusSetIdx      = 0;
let focusRestInterval = null;
let focusRestLeft    = 0;
let focusRestTotal   = 0;

/* ════════════════ LOCALSTORAGE ════════════════ */
function saveToStorage() {
    try {
        localStorage.setItem('wt-sessionData',    JSON.stringify(sessionData));
        localStorage.setItem('wt-completed',      JSON.stringify(completedExercises));
        localStorage.setItem('wt-phase',          String(currentPhase));
        localStorage.setItem('wt-session',        String(currentSession));
        localStorage.setItem('wt-completed-sets', JSON.stringify(completedSets));
        localStorage.setItem('wt-workout-dates',  JSON.stringify(workoutDates));
    } catch (e) { /* ignore quota errors */ }
}

function loadFromStorage() {
    try {
        const sd = localStorage.getItem('wt-sessionData');
        const ce = localStorage.getItem('wt-completed');
        const ph = localStorage.getItem('wt-phase');
        const se = localStorage.getItem('wt-session');
        const cs = localStorage.getItem('wt-completed-sets');
        const wd = localStorage.getItem('wt-workout-dates');
        if (sd) sessionData        = JSON.parse(sd);
        if (ce) completedExercises = JSON.parse(ce);
        if (ph) {
            currentPhase = parseInt(ph);
            document.querySelectorAll('.phase-btn').forEach((btn, i) => {
                btn.classList.toggle('active', (i + 1) === currentPhase);
            });
        }
        if (se) currentSession = parseInt(se);
        if (cs) completedSets  = JSON.parse(cs);
        if (wd) workoutDates   = JSON.parse(wd);
    } catch (e) { /* ignore parse errors */ }
}

/* ════════════════ WORKOUT DATE TRACKING ════════════════ */
function recordWorkoutDate() {
    const today = new Date().toISOString().split('T')[0];
    if (!workoutDates.includes(today)) {
        workoutDates.push(today);
        saveToStorage();
        renderHeatmap();
    }
}

/* ════════════════ PERSONAL RECORD DETECTION ════════════════ */
function getExercisePR(exIdx) {
    let maxWeight = 0;
    Object.entries(sessionData).forEach(([sk, data]) => {
        Object.entries(data).forEach(([key, val]) => {
            if (key.startsWith(`${sk}-${exIdx}-`) && key.endsWith('-weight')) {
                const w = parseFloat(val);
                if (!isNaN(w) && w > maxWeight) maxWeight = w;
            }
        });
    });
    return maxWeight;
}

function checkPR(exIdx, inputValue, badgeId) {
    const badge = document.getElementById(badgeId);
    if (!badge) return;
    const w = parseFloat(inputValue);
    if (isNaN(w) || w <= 0) { badge.style.display = 'none'; return; }
    const pr = getExercisePR(exIdx);
    // Show PR if new value beats all previously SAVED weights
    badge.style.display = (w > pr) ? '' : 'none';
}

/* ════════════════ SET CONFIRM (main view) ════════════════ */
function confirmSet(exIdx, setIdx) {
    const sk  = getSessionKey();
    const key = `${sk}-${exIdx}-${setIdx}`;
    completedSets[key] = !completedSets[key];
    const isDone = completedSets[key];

    const btn = document.getElementById(`setbtn-${exIdx}-${setIdx}`);
    const row = document.getElementById(`setrow-${exIdx}-${setIdx}`);
    if (btn) { btn.classList.toggle('confirmed', isDone); btn.textContent = isDone ? '✓ Done' : 'Done'; }
    if (row) row.classList.toggle('confirmed', isDone);

    if (isDone) {
        // Save input values at time of confirm
        const wInp = document.getElementById(`winp-${exIdx}-${setIdx}`);
        const rInp = document.getElementById(`rinp-${exIdx}-${setIdx}`);
        if (wInp && wInp.value) updateWeight(exIdx, setIdx, wInp.value);
        if (rInp && rInp.value) updateReps(exIdx, setIdx, rInp.value);
        recordWorkoutDate();
        // Auto-start rest timer
        const ex = workoutData[currentPhase].exercises[exIdx];
        if (ex.rest !== '—' && ex.rest !== '0') startRest(ex.rest);
    }
    saveToStorage();
}

/* ════════════════ HEATMAP ════════════════ */
function renderHeatmap() {
    const grid     = document.getElementById('heatmapGrid');
    const streakEl = document.getElementById('streakText');
    if (!grid) return;

    const today    = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Build 28-day window starting from Monday of the week 4 weeks ago
    const days = [];
    for (let i = 27; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }

    // Compute current streak (consecutive days going backwards from today)
    let streak = 0;
    const check = new Date(today);
    while (workoutDates.includes(check.toISOString().split('T')[0])) {
        streak++;
        check.setDate(check.getDate() - 1);
    }

    grid.innerHTML = days.map(d => {
        const isActive = workoutDates.includes(d);
        const isToday  = d === todayStr;
        return `<div class="heatmap-day${isActive ? ' active' : ''}${isToday ? ' today' : ''}" title="${d}"></div>`;
    }).join('');

    if (streakEl) {
        streakEl.innerHTML = streak > 0
            ? `<span class="streak-num">${streak}-day</span> streak`
            : 'Start your streak today';
    }
}

/* ════════════════ SET PROGRESSION ════════════════ */
// Returns the actual number of sets for an exercise given the current phase + session,
// reflecting the progression rules described in each session note.
function getActualSets(exercise, phase, session) {
    const base   = exercise.sets;
    const type   = exercise.type;
    const isMain = type === 'Block A';
    const isCore = type === 'Block E';
    const isWarm = type === 'Warm-Up';

    // Warm-up never changes
    if (isWarm) return base;

    if (phase === 1) {
        // Base = 2 for all
        switch (session) {
            case 1: return base;          // 2 — baseline
            case 2: return base + 1;      // 3 — add +1 set to all
            case 3: return 4;             // 4 — add +1 more (all reach 4)
            case 4:                       // taper
                if (isMain) return 4;
                if (isCore) return base;
                return 3;
            default: return base;
        }
    }

    if (phase === 2) {
        // Base = 3 for most, 2 for Block E
        switch (session) {
            case 1: return base;
            case 2: return isMain ? 4 : base;
            case 3: return isCore ? base : 4;
            case 4: return isCore ? base : 4;
            case 5: return isMain ? 5 : (isCore ? base : 4);
            case 6: return isMain ? 4 : (isCore ? base : 3);
            default: return base;
        }
    }

    if (phase === 3) {
        // Base = 3 for all. Block A = strength lifts, Block E = core/accessory
        const isStrengthA = type === 'Block A';
        switch (session) {
            case 1: return base;                                           // 3 all — learn loads
            case 2: return isStrengthA ? 4 : base;                        // A→4
            case 3: return isCore ? base : 4;                             // B/C/D→4
            case 4: return isCore ? base : 4;                             // maintain
            case 5: return isStrengthA ? 5 : (isCore ? base : 4);        // A→5, B/C/D→4
            case 6: return isStrengthA ? 5 : (isCore ? base : 4);        // maintain peak
            case 7: return isCore ? base : 5;                             // max volume — all→5
            case 8: return isStrengthA ? 5 : (isCore ? base : 4);        // slight pull-back
            case 9: return isStrengthA ? 4 : base;                        // taper
            default: return base;
        }
    }

    return base;
}

/* ════════════════ REST TIMER ════════════════ */
function formatTime(s) {
    if (s <= 0) return '0s';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${s}s`;
}

function startRest(restValue) {
    if (!restValue || restValue === '—' || restValue === '0') return;
    // "120-180" → use lower bound
    const seconds = parseInt(restValue.split('-')[0]);
    if (isNaN(seconds) || seconds <= 0) return;

    if (restInterval) clearInterval(restInterval);

    restSecondsLeft  = seconds;
    restTotalSeconds = seconds;

    const timer  = document.getElementById('restTimer');
    const timeEl = document.getElementById('restTime');
    const fillEl = document.getElementById('restBarFill');

    timer.classList.remove('hidden', 'done');
    timeEl.textContent     = formatTime(restSecondsLeft);
    fillEl.style.width     = '100%';
    fillEl.style.transition = 'none';

    // Trigger reflow so transition applies from next tick
    requestAnimationFrame(() => {
        fillEl.style.transition = `width ${seconds}s linear`;
        fillEl.style.width      = '0%';
    });

    restInterval = setInterval(() => {
        restSecondsLeft--;
        if (timeEl) timeEl.textContent = formatTime(restSecondsLeft);

        if (restSecondsLeft <= 0) {
            clearInterval(restInterval);
            restInterval = null;
            timer.classList.add('done');
            if (timeEl) timeEl.textContent = 'Done!';
            if (fillEl) { fillEl.style.transition = 'none'; fillEl.style.width = '100%'; }
        }
    }, 1000);
}

function dismissRest() {
    if (restInterval) clearInterval(restInterval);
    restInterval = null;
    document.getElementById('restTimer').classList.add('hidden');
}

/* ════════════════ FOCUS MODE ════════════════ */
function enterFocusMode() {
    focusExIdx = 0;
    focusSetIdx = 0;
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
    document.getElementById('focusOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    renderFocusExercise();
}

function exitFocusMode() {
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
    document.getElementById('focusOverlay').classList.add('hidden');
    document.body.style.overflow = '';
    updateWorkout();
}

function renderFocusSetDots(actualSets) {
    const sk   = getSessionKey();
    let html   = '';
    for (let s = 0; s < actualSets; s++) {
        const done    = !!completedSets[`${sk}-${focusExIdx}-${s}`];
        const current = s === focusSetIdx;
        html += `<div class="focus-set-dot${done ? ' done' : current ? ' current' : ''}" onclick="jumpFocusSet(${s})"></div>`;
    }
    document.getElementById('focusSetDots').innerHTML = html;
}

function renderFocusExercise() {
    const data       = workoutData[currentPhase];
    const exercises  = data.exercises;
    const ex         = exercises[focusExIdx];
    const actualSets = getActualSets(ex, currentPhase, currentSession);
    const sk         = getSessionKey();
    const curData    = sessionData[sk] || {};
    const wKey       = `${sk}-${focusExIdx}-${focusSetIdx}-weight`;
    const rKey       = `${sk}-${focusExIdx}-${focusSetIdx}-reps`;
    const prev       = getPrevData(focusExIdx, focusSetIdx);
    const savedW     = curData[wKey] || (prev && prev.weight !== '—' ? prev.weight : '');
    const savedR     = curData[rKey] || (prev && prev.reps   !== '—' ? prev.reps   : '');
    const isDone     = !!completedSets[`${sk}-${focusExIdx}-${focusSetIdx}`];

    document.getElementById('focusProgText').textContent    = `Exercise ${focusExIdx + 1} of ${exercises.length}`;
    document.getElementById('focusBlockTag').textContent    = ex.type;
    document.getElementById('focusBlockTag').className      = `ex-tag focus-block-tag ${getTagClass(ex.type)}`;
    document.getElementById('focusExName').textContent      = ex.name;
    document.getElementById('focusSetCounter').textContent  = `Set ${focusSetIdx + 1} of ${actualSets}`;
    document.getElementById('focusNote').textContent        = `💡 ${ex.note}`;

    if (prev && prev.weight !== '—') {
        document.getElementById('focusPrev').textContent = `Last time: ${prev.weight} lbs × ${prev.reps} reps`;
    } else {
        document.getElementById('focusPrev').textContent = 'First time — start comfortable';
    }

    document.getElementById('focusWeight').value = savedW;
    document.getElementById('focusReps').value   = savedR;

    renderFocusSetDots(actualSets);

    // Prev/next buttons
    const isFirst  = focusExIdx === 0 && focusSetIdx === 0;
    const isLast   = focusExIdx === exercises.length - 1 && focusSetIdx === actualSets - 1;
    const prevBtn  = document.getElementById('focusPrevBtn');
    const nextBtn  = document.getElementById('focusNextBtn');
    prevBtn.disabled = isFirst;
    nextBtn.textContent = isLast ? 'Finish ✓' : 'Next →';
    nextBtn.className   = `focus-nav-btn${isLast ? ' finish' : ''}`;

    // Show inputs / rest
    const restDisplay = document.getElementById('focusRestDisplay');
    const inputs      = document.getElementById('focusInputs');
    const doneBtn     = document.getElementById('focusDoneBtn');
    restDisplay.classList.add('hidden');
    inputs.style.display  = '';
    doneBtn.style.display = '';
    doneBtn.textContent   = isDone ? '✓ Set Done' : '✓ Done Set';
}

function confirmFocusSet() {
    const ex         = workoutData[currentPhase].exercises[focusExIdx];
    const actualSets = getActualSets(ex, currentPhase, currentSession);
    const sk         = getSessionKey();
    const wVal       = document.getElementById('focusWeight').value;
    const rVal       = document.getElementById('focusReps').value;

    if (!sessionData[sk]) sessionData[sk] = {};
    if (wVal) sessionData[sk][`${sk}-${focusExIdx}-${focusSetIdx}-weight`] = wVal;
    if (rVal) sessionData[sk][`${sk}-${focusExIdx}-${focusSetIdx}-reps`]   = rVal;

    completedSets[`${sk}-${focusExIdx}-${focusSetIdx}`] = true;
    saveToStorage();
    recordWorkoutDate();

    renderFocusSetDots(actualSets);

    const doneBtn = document.getElementById('focusDoneBtn');
    doneBtn.textContent = '✓ Set Done';

    const hasRest = ex.rest !== '—' && ex.rest !== '0';
    if (hasRest) {
        startFocusRest(ex.rest);
    } else {
        setTimeout(() => advanceFocusSet(), 300);
    }
}

function startFocusRest(restValue) {
    const seconds = parseInt(restValue.split('-')[0]);
    if (isNaN(seconds) || seconds <= 0) { advanceFocusSet(); return; }

    if (focusRestInterval) clearInterval(focusRestInterval);
    focusRestLeft  = seconds;
    focusRestTotal = seconds;

    const restDisplay = document.getElementById('focusRestDisplay');
    const restTimeEl  = document.getElementById('focusRestTime');
    const restFillEl  = document.getElementById('focusRestBarFill');
    const inputs      = document.getElementById('focusInputs');
    const doneBtn     = document.getElementById('focusDoneBtn');

    restDisplay.classList.remove('hidden');
    inputs.style.display  = 'none';
    doneBtn.style.display = 'none';

    restTimeEl.textContent       = formatTime(focusRestLeft);
    restFillEl.style.transition  = 'none';
    restFillEl.style.width       = '100%';
    requestAnimationFrame(() => {
        restFillEl.style.transition = `width ${seconds}s linear`;
        restFillEl.style.width      = '0%';
    });

    focusRestInterval = setInterval(() => {
        focusRestLeft--;
        if (restTimeEl) restTimeEl.textContent = formatTime(focusRestLeft);
        if (focusRestLeft <= 0) {
            clearInterval(focusRestInterval);
            focusRestInterval = null;
            if (restTimeEl) restTimeEl.textContent = 'Done!';
            setTimeout(() => advanceFocusSet(), 600);
        }
    }, 1000);
}

function skipFocusRest() {
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
    advanceFocusSet();
}

function advanceFocusSet() {
    const data       = workoutData[currentPhase];
    const ex         = data.exercises[focusExIdx];
    const actualSets = getActualSets(ex, currentPhase, currentSession);

    if (focusSetIdx < actualSets - 1) {
        focusSetIdx++;
    } else if (focusExIdx < data.exercises.length - 1) {
        focusExIdx++;
        focusSetIdx = 0;
    } else {
        exitFocusMode();
        return;
    }
    renderFocusExercise();
}

function focusNavPrev() {
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
    if (focusSetIdx > 0) {
        focusSetIdx--;
    } else if (focusExIdx > 0) {
        focusExIdx--;
        const prevEx = workoutData[currentPhase].exercises[focusExIdx];
        focusSetIdx  = getActualSets(prevEx, currentPhase, currentSession) - 1;
    }
    renderFocusExercise();
}

function focusNavNext() {
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
    advanceFocusSet();
}

function jumpFocusSet(s) {
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
    focusSetIdx = s;
    renderFocusExercise();
}

/* ════════════════ EXERCISE ACTIONS ════════════════ */
function toggleCard(idx) {
    cardCollapsed[idx] = !cardCollapsed[idx];
    const body   = document.getElementById(`body-${idx}`);
    const toggle = document.getElementById(`toggle-${idx}`);
    if (body)   body.classList.toggle('hidden', cardCollapsed[idx]);
    if (toggle) toggle.classList.toggle('open', !cardCollapsed[idx]);
}

function toggleExercise(idx) {
    const key = getExerciseKey(idx);
    completedExercises[key] = !completedExercises[key];
    const done = completedExercises[key];

    const check = document.getElementById(`check-${idx}`);
    const name  = document.getElementById(`name-${idx}`);
    const block = document.getElementById(`block-${idx}`);

    if (check) { check.classList.toggle('done', done); check.innerHTML = done ? '✓' : ''; }
    if (name)  { name.classList.toggle('done', done); }
    if (block) { block.style.opacity = done ? '0.65' : ''; }

    updateCompletionProgress();
    saveToStorage();
}

function updateWeight(exIdx, setIdx, value) {
    const sk = getSessionKey();
    if (!sessionData[sk]) sessionData[sk] = {};
    sessionData[sk][`${sk}-${exIdx}-${setIdx}-weight`] = value;
    saveToStorage();
}

function updateReps(exIdx, setIdx, value) {
    const sk = getSessionKey();
    if (!sessionData[sk]) sessionData[sk] = {};
    sessionData[sk][`${sk}-${exIdx}-${setIdx}-reps`] = value;
    saveToStorage();
}

/* ════════════════ HELPERS ════════════════ */
function getSessionKey()   { return `${currentPhase}-${currentSession}`; }
function getExerciseKey(i) { return `${getSessionKey()}-${i}`; }

function getTagClass(type) {
    const map = { 'Warm-Up': 'tag-warmup', 'Block A': 'tag-a', 'Block B': 'tag-b',
                  'Block C': 'tag-c', 'Block D': 'tag-d', 'Block E': 'tag-e' };
    return map[type] || 'tag-e';
}

function getPrevData(exIdx, setIdx) {
    if (currentSession < 2) return null;
    const prevKey  = `${currentPhase}-${currentSession - 1}`;
    const prevData = sessionData[prevKey];
    if (!prevData) return null;
    const w = prevData[`${prevKey}-${exIdx}-${setIdx}-weight`];
    const r = prevData[`${prevKey}-${exIdx}-${setIdx}-reps`];
    return (w || r) ? { weight: w || '—', reps: r || '—' } : null;
}

function getSuggestion(exIdx, setIdx) {
    const prev = getPrevData(exIdx, setIdx);
    if (!prev || prev.weight === '—' || prev.reps === '—') return 'Start comfortable';
    const w = parseFloat(prev.weight);
    const r = parseInt(prev.reps);
    if (isNaN(w) || isNaN(r)) return 'Use previous as baseline';
    return `Try ${w + 2.5} lbs × ${r} or ${w} lbs × ${r + 1}`;
}

/* ════════════════ NAVIGATION ════════════════ */
function selectPhase(phase) {
    currentPhase   = phase;
    currentSession = 1;
    cardCollapsed  = {};
    document.querySelectorAll('.phase-btn').forEach((btn, i) => {
        btn.classList.toggle('active', (i + 1) === phase);
    });
    updateWorkout();
}

function selectSession(session) {
    currentSession = session;
    cardCollapsed  = {};
    updateWorkout();
}

/* ════════════════ PROGRESS ════════════════ */
function updateCompletionProgress() {
    const data  = workoutData[currentPhase];
    const total = data.exercises.length;
    let done = 0;
    data.exercises.forEach((_, i) => {
        if (completedExercises[getExerciseKey(i)]) done++;
    });
    const pct  = total > 0 ? (done / total) * 100 : 0;
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('progressText');
    if (fill) fill.style.width = pct + '%';
    if (text) text.textContent = `${done} of ${total} complete`;
}

/* ════════════════ SIDEBAR ════════════════ */
function renderSessionNav() {
    const data = workoutData[currentPhase];
    const nav  = document.getElementById('sessionNav');
    if (!nav) return;
    nav.innerHTML = '';
    for (let s = 1; s <= data.totalSessions; s++) {
        const item = document.createElement('div');
        item.className = `sess-item${s === currentSession ? ' active' : ''}`;
        item.innerHTML = `
            <span class="sess-icon">${s === currentSession ? '📋' : '📄'}</span>
            <span>Session ${s}</span>
        `;
        item.onclick = () => selectSession(s);
        nav.appendChild(item);
    }
}

function updateSidebar() {
    const data = workoutData[currentPhase];
    const prog = data.progression[currentSession - 1];

    const noteEl = document.getElementById('sessionNote');
    if (noteEl) noteEl.textContent = prog.note;

    renderSessionNav();
    updateCompletionProgress();

    const prevContainer = document.getElementById('prevContent');
    if (!prevContainer) return;

    if (currentSession === 1) {
        prevContainer.innerHTML = `<p style="font-size:12px;color:var(--text3);font-style:italic;">First session — establish baseline</p>`;
    } else {
        const prevKey  = `${currentPhase}-${currentSession - 1}`;
        const prevData = sessionData[prevKey];
        let html = '';
        if (prevData && Object.keys(prevData).length > 0) {
            data.exercises.slice(0, 5).forEach((ex, idx) => {
                const w = prevData[`${prevKey}-${idx}-0-weight`] || '—';
                const r = prevData[`${prevKey}-${idx}-0-reps`]   || '—';
                if (w !== '—' || r !== '—') {
                    html += `
                        <div class="prev-item">
                            <div class="prev-name">${ex.name}</div>
                            <div class="prev-data">Set 1: ${w} lbs × ${r} reps</div>
                        </div>`;
                }
            });
        }
        prevContainer.innerHTML = html ||
            `<p style="font-size:12px;color:var(--text3);font-style:italic;">No data from previous session</p>`;
    }
}

/* ════════════════ MAIN RENDER ════════════════ */
function updateWorkout() {
    const data = workoutData[currentPhase];

    document.getElementById('pageTitle').innerHTML =
        data.name + ' <span style="font-size:13px;color:var(--text3);font-weight:400;">v4</span>';
    document.getElementById('pageSubtitle').textContent = data.frequency;

    const prog = data.progression[currentSession - 1];
    document.getElementById('propSession').innerHTML =
        `<span class="prop-tag">Session ${currentSession} of ${data.totalSessions}</span>`;
    document.getElementById('propFocus').textContent = prog.note;

    const list = document.getElementById('exerciseList');
    list.innerHTML = '';

    let lastType = null;

    data.exercises.forEach((ex, idx) => {
        const sk         = getSessionKey();
        const isDone     = !!completedExercises[getExerciseKey(idx)];
        const isOpen     = !cardCollapsed[idx];
        const videoUrl   = exerciseVideos[ex.name];
        const actualSets = getActualSets(ex, currentPhase, currentSession);
        const setsChanged = actualSets !== ex.sets;

        // Section heading on block type change
        if (ex.type !== lastType) {
            const heading = document.createElement('div');
            heading.className   = 'blk-heading';
            heading.textContent = ex.type;
            list.appendChild(heading);
            lastType = ex.type;
        }

        // Build set rows
        let setRowsHtml = '';
        for (let s = 0; s < actualSets; s++) {
            const wKey      = `${sk}-${idx}-${s}-weight`;
            const rKey      = `${sk}-${idx}-${s}-reps`;
            const curData   = sessionData[sk] || {};
            const prev      = getPrevData(idx, s);
            // Pre-fill: current session data > previous session data > empty
            const wVal      = curData[wKey] || (prev && prev.weight !== '—' ? prev.weight : '');
            const rVal      = curData[rKey] || (prev && prev.reps   !== '—' ? prev.reps   : '');
            const hasRest   = ex.rest !== '—' && ex.rest !== '0';
            const setDone   = !!completedSets[`${sk}-${idx}-${s}`];

            setRowsHtml += `
                <tr class="set-row${setDone ? ' confirmed' : ''}" id="setrow-${idx}-${s}">
                    <td class="set-lbl">Set ${s + 1}</td>
                    <td>
                        <input class="num-inp" id="winp-${idx}-${s}" type="number" placeholder="lbs" value="${wVal}"
                               oninput="checkPR(${idx}, this.value, 'pr-${idx}-${s}')"
                               onchange="updateWeight(${idx}, ${s}, this.value)">
                        <span class="pr-badge" id="pr-${idx}-${s}" style="display:none">🏆 PR</span>
                    </td>
                    <td><input class="num-inp" id="rinp-${idx}-${s}" type="number" placeholder="reps" value="${rVal}"
                               onchange="updateReps(${idx}, ${s}, this.value)"></td>
                    <td class="prev-td">${prev ? `${prev.weight} × ${prev.reps}` : '—'}</td>
                    <td>${hasRest ? `<button class="rest-btn" onclick="startRest('${ex.rest}')">⏱ Rest</button>` : ''}</td>
                    <td><button class="set-done-btn${setDone ? ' confirmed' : ''}" id="setbtn-${idx}-${s}"
                                onclick="confirmSet(${idx}, ${s})">${setDone ? '✓ Done' : 'Done'}</button></td>
                </tr>`;
        }

        const block = document.createElement('div');
        block.className = 'ex-block';
        block.id        = `block-${idx}`;
        if (isDone) block.style.opacity = '0.65';

        block.innerHTML = `
            <div class="ex-row">
                <div class="ex-toggle${isOpen ? ' open' : ''}" id="toggle-${idx}" onclick="toggleCard(${idx})">
                    <span class="arr">▶</span>
                </div>
                <div class="ex-check${isDone ? ' done' : ''}" id="check-${idx}" onclick="toggleExercise(${idx})">${isDone ? '✓' : ''}</div>
                <div class="ex-title">
                    <span class="ex-name${isDone ? ' done' : ''}" id="name-${idx}">${ex.name}</span>
                    <span class="ex-tag ${getTagClass(ex.type)}">${ex.type}</span>
                </div>
                <div class="ex-actions">
                    ${videoUrl ? `<a href="${videoUrl}" target="_blank" class="vid-btn">▶ Video</a>` : ''}
                </div>
            </div>
            <div class="ex-body${isOpen ? '' : ' hidden'}" id="body-${idx}">
                <div class="ex-props">
                    <div class="xprop">
                        <span class="xprop-lbl">Sets</span>
                        <span class="xprop-val">${actualSets}</span>
                        ${setsChanged ? `<span class="sets-changed">↑ from ${ex.sets}</span>` : ''}
                    </div>
                    <div class="xprop"><span class="xprop-lbl">Reps</span><span class="xprop-val">${ex.reps}</span></div>
                    <div class="xprop"><span class="xprop-lbl">Tempo</span><span class="xprop-val">${ex.tempo}</span></div>
                    <div class="xprop"><span class="xprop-lbl">Rest</span><span class="xprop-val">${ex.rest}</span></div>
                </div>
                <div class="callout">
                    <span class="callout-ico">💡</span>
                    <span class="callout-txt">${ex.note}</span>
                </div>
                <div class="sets-lbl">Set Tracking</div>
                <table class="sets-tbl">
                    <thead>
                        <tr>
                            <th></th>
                            <th>Weight</th>
                            <th>Reps</th>
                            <th>Previous</th>
                            <th></th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${setRowsHtml}</tbody>
                </table>
            </div>`;

        list.appendChild(block);
    });

    updateSidebar();
    renderHeatmap();
    saveToStorage();
}

document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();
    updateWorkout();
    renderHeatmap();
});
