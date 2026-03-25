let currentPhase       = 1;
let currentSession     = 1;
let completedExercises = {};
let sessionData        = {};
let cardCollapsed      = {};
let completedSets      = {};   // tracks confirmed set rows: key = "sk-exIdx-setIdx"
let workoutDates       = [];   // ISO date strings of days with logged sets
let rpeData            = {};   // key = "sk-exIdx-setIdx" → 'easy'|'solid'|'hard'

// Rest timer state
let restInterval     = null;
let restSecondsLeft  = 0;
let restTotalSeconds = 0;

// Focus mode state
let focusExIdx        = 0;
let focusSetIdx       = 0;
let focusRestInterval = null;
let focusRestLeft     = 0;
let focusRestTotal    = 0;

// Interval timer state (cardio conditioning)
let intervalWorkInterval = null;
let intervalWorkLeft     = 0;
let intervalPhase        = null;  // 'work' | 'rest' | null

// Superset-aware focus state
let focusBlockGroups  = [];  // [{type, exercises: [indices]}]
let focusGroupIdx     = 0;   // current block group
let focusSubIdx       = 0;   // exercise within group
let focusRoundIdx     = 0;   // current round (= set index)
let straightSetsBlocks = new Set(); // block types toggled to straight-sets mode (in-memory, per session)

// Session timer state
let sessionStartTime    = null;
let sessionTimerInterval = null;
let sessionTimerVisible  = false;  // hidden by default

// Block timer state (EDT countdown per block)
let blockTimerInterval   = null;
let blockTimeLeft        = 0;
let blockTimerTotal      = 0;
let blockTimerActive     = false;
let blockTimerStartWallTime = null;  // wall-clock anchor — immune to browser throttling
let lastRenderedGroupIdx = -1;     // detect block transitions

/* ════════════════ LOCALSTORAGE ════════════════ */
function saveToStorage() {
    try {
        localStorage.setItem('wt-sessionData',    JSON.stringify(sessionData));
        localStorage.setItem('wt-completed',      JSON.stringify(completedExercises));
        localStorage.setItem('wt-phase',          String(currentPhase));
        localStorage.setItem('wt-session',        String(currentSession));
        localStorage.setItem('wt-completed-sets', JSON.stringify(completedSets));
        localStorage.setItem('wt-workout-dates',  JSON.stringify(workoutDates));
        localStorage.setItem('wt-rpe-data',       JSON.stringify(rpeData));
    } catch (e) {
        showSaveError();
    }
}

function showSaveError() {
    let toast = document.getElementById('saveErrorToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'saveErrorToast';
        toast.textContent = '⚠️ Could not save — storage full. Free up space on your device.';
        toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#dc2626;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;z-index:99999;max-width:320px;text-align:center;';
        document.body.appendChild(toast);
    }
    toast.style.display = 'block';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => { toast.style.display = 'none'; }, 6000);
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
        const rd = localStorage.getItem('wt-rpe-data');
        if (rd) rpeData = JSON.parse(rd);
    } catch (e) { /* ignore parse errors */ }
}

/* ════════════════ WORKOUT DATE TRACKING ════════════════ */
function localDateStr(d = new Date()) {
    // Use local calendar date — toISOString() converts to UTC and can shift the date
    // for users in UTC− timezones who work out after 5 PM
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function recordWorkoutDate() {
    const today = localDateStr();
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
    const rpeDiv = document.getElementById(`rpe-${exIdx}-${setIdx}`);
    if (rpeDiv) rpeDiv.classList.toggle('hidden', !isDone);

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
    const grid = document.getElementById('heatmapGrid');
    if (!grid) return;

    const today    = new Date();
    const todayStr = localDateStr(today);

    const days = [];
    for (let i = 27; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push(localDateStr(d));
    }

    grid.innerHTML = days.map(d => {
        const isActive = workoutDates.includes(d);
        const isToday  = d === todayStr;
        return `<div class="heatmap-day${isActive ? ' active' : ''}${isToday ? ' today' : ''}" title="${d}"></div>`;
    }).join('');
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

    // Cardio warm-up: reps = number of rounds
    if (isWarm && exercise.work) return parseInt(exercise.reps) || base;
    // Non-cardio warm-up never changes
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

/* ════════════════ BLOCK TIMER (EDT countdown per block) ════════════════ */
function formatBlockTime(s) {
    if (s <= 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

function getBlockDuration(blockType, halved = false) {
    const prog = workoutData[currentPhase].progression[currentSession - 1];
    if (!prog || !prog.blockDurations) return 0;
    const mins = prog.blockDurations[blockType] || 0;
    return Math.round(halved ? mins / 2 * 60 : mins * 60);
}

function initBlockTimer() {
    clearBlockTimer();
    const group     = focusBlockGroups[focusGroupIdx];
    const totalSecs = getBlockDuration(group.type, group.halved || false);
    blockTimerTotal = totalSecs;
    blockTimeLeft   = totalSecs;
    blockTimerActive = false;

    const bar = document.getElementById('blockTimerBar');
    if (!bar) return;
    if (!totalSecs) { bar.classList.add('hidden'); return; }

    bar.classList.remove('hidden', 'block-timer-done');
    const label = group.halved ? `${group.type} (${group.subLabel})` : group.type;
    document.getElementById('blockTimerLabel').textContent = label;
    document.getElementById('blockTimerTime').textContent  = formatBlockTime(totalSecs);
    document.getElementById('blockTimerFill').style.width  = '100%';
    const startBtn = document.getElementById('blockStartBtn');
    startBtn.classList.remove('hidden');
    startBtn.disabled = false;
}

function startBlockTimer() {
    if (blockTimerActive) return;
    blockTimerActive = true;
    document.getElementById('blockStartBtn')?.classList.add('hidden');
    // Anchor to wall clock — accounts for any time already elapsed before hitting Start
    blockTimerStartWallTime = Date.now() - (blockTimerTotal - blockTimeLeft) * 1000;
    localStorage.setItem('wt-block-timer', JSON.stringify({
        startWall: blockTimerStartWallTime, total: blockTimerTotal
    }));
    blockTimerInterval = setInterval(() => {
        blockTimeLeft = Math.max(0, blockTimerTotal - Math.floor((Date.now() - blockTimerStartWallTime) / 1000));
        updateBlockTimerDisplay();
        if (blockTimeLeft === 0) blockTimerDone();
    }, 1000);
    updateBlockTimerDisplay();
}

function clearBlockTimer() {
    if (blockTimerInterval) { clearInterval(blockTimerInterval); blockTimerInterval = null; }
    blockTimerActive = false;
    blockTimerStartWallTime = null;
    localStorage.removeItem('wt-block-timer');
}

function blockTimerDone() {
    clearBlockTimer();
    const bar = document.getElementById('blockTimerBar');
    if (bar) bar.classList.add('block-timer-done');
    const timeEl = document.getElementById('blockTimerTime');
    if (timeEl) timeEl.textContent = 'TIME';
    const fillEl = document.getElementById('blockTimerFill');
    if (fillEl) fillEl.style.width = '0%';
    playBeep(880, 0.2, 1);
    setTimeout(() => playBeep(880, 0.2, 1), 350);
    setTimeout(() => playBeep(1100, 0.4, 1), 700);
    const doneBtn = document.getElementById('blockDoneBtn');
    if (doneBtn) doneBtn.classList.add('block-done-btn-ready');
}

function updateBlockTimerDisplay() {
    const timeEl = document.getElementById('blockTimerTime');
    const fillEl = document.getElementById('blockTimerFill');
    if (timeEl) timeEl.textContent = formatBlockTime(blockTimeLeft);
    if (fillEl && blockTimerTotal > 0)
        fillEl.style.width = (blockTimeLeft / blockTimerTotal * 100) + '%';
}

/* ════════════════ SESSION TIMER ════════════════ */
function formatSessionTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatSessionDuration(ms) {
    const totalMin = Math.round(ms / 60000);
    if (totalMin < 1) return '<1m';
    if (totalMin < 60) return `${totalMin}m`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function startSessionTimer() {
    sessionStartTime = Date.now();
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    const timerEl = document.getElementById('sessionTimer');

    // Load visibility preference — pill always visible, content toggles
    sessionTimerVisible = localStorage.getItem('wt-timer-visible') === 'true';
    timerEl.textContent = sessionTimerVisible ? '0:00' : '⏱';

    sessionTimerInterval = setInterval(() => {
        if (!sessionStartTime || !sessionTimerVisible) return;
        timerEl.textContent = formatSessionTime(Date.now() - sessionStartTime);
    }, 1000);
}

function stopSessionTimer() {
    if (sessionTimerInterval) { clearInterval(sessionTimerInterval); sessionTimerInterval = null; }
    const elapsed = sessionStartTime ? Date.now() - sessionStartTime : 0;
    sessionStartTime = null;
    return elapsed;
}

function toggleSessionTimer() {
    sessionTimerVisible = !sessionTimerVisible;
    const timerEl = document.getElementById('sessionTimer');
    if (sessionTimerVisible && sessionStartTime) {
        timerEl.textContent = formatSessionTime(Date.now() - sessionStartTime);
    } else {
        timerEl.textContent = '⏱';
    }
    try { localStorage.setItem('wt-timer-visible', String(sessionTimerVisible)); } catch (e) {}
}

/* ════════════════ AUDIO CUE (Web Audio API) ════════════════ */
let _audioCtx = null;
function getAudioCtx() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return _audioCtx;
}

function playBeep(freq, duration, count) {
    freq = freq || 880;
    duration = duration || 0.12;
    count = count || 1;
    try {
        const ctx = getAudioCtx();
        for (let i = 0; i < count; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = freq;
            gain.gain.value = 0.15;
            osc.connect(gain);
            gain.connect(ctx.destination);
            const start = ctx.currentTime + i * (duration + 0.08);
            osc.start(start);
            osc.stop(start + duration);
        }
    } catch (e) { /* audio not available */ }
}

/* ════════════════ INTERVAL TIMER (Cardio Conditioning) ════════════════ */
function clearIntervalTimer() {
    if (intervalWorkInterval) { clearInterval(intervalWorkInterval); intervalWorkInterval = null; }
    intervalPhase = null;
    intervalWorkLeft = 0;
}

function showReadyScreen() {
    const ex = workoutData[currentPhase].exercises[focusExIdx];
    if (!ex.work) return;

    clearIntervalTimer();
    intervalPhase = null;
    const workSec = parseInt(ex.work) || 30;

    // Show work screen in ready state
    document.getElementById('focusScreenExercise').classList.add('hidden');
    document.getElementById('focusScreenRest').classList.add('hidden');
    document.getElementById('focusScreenWork').classList.remove('hidden');

    const timerEl  = document.getElementById('intervalWorkTime');
    const labelEl  = document.getElementById('intervalWorkLabel');
    const phaseEl  = document.getElementById('intervalWorkPhase');
    const fillEl   = document.getElementById('intervalWorkBarFill');
    const startBtn = document.getElementById('intervalStartBtn');
    const skipBtn  = document.getElementById('intervalSkipBtn');

    timerEl.textContent = workSec;
    labelEl.textContent = `Round ${focusRoundIdx + 1}`;
    phaseEl.textContent = 'READY';
    phaseEl.className = 'interval-phase-label ready';

    // Static bar at 100%
    fillEl.style.transition = 'none';
    fillEl.style.width = '100%';

    // Show start button, hide skip button
    if (startBtn) { startBtn.classList.remove('hidden'); startBtn.onclick = function() { runCountdown(); }; }
    if (skipBtn) skipBtn.classList.add('hidden');
}

function runCountdown() {
    const timerEl  = document.getElementById('intervalWorkTime');
    const phaseEl  = document.getElementById('intervalWorkPhase');
    const startBtn = document.getElementById('intervalStartBtn');

    // Hide start button during countdown
    if (startBtn) startBtn.classList.add('hidden');

    let count = 3;
    timerEl.textContent = count;
    phaseEl.textContent = 'GET READY';
    phaseEl.className = 'interval-phase-label countdown';
    playBeep(660, 0.1, 1);

    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            timerEl.textContent = count;
            playBeep(660, 0.1, 1);
        } else {
            clearInterval(countdownInterval);
            startWorkPhase();
        }
    }, 1000);
}

function startWorkPhase() {
    const ex = workoutData[currentPhase].exercises[focusExIdx];
    if (!ex.work) return;

    clearIntervalTimer();
    intervalPhase = 'work';
    const workSec = parseInt(ex.work) || 30;
    intervalWorkLeft = workSec;

    // Show work screen, hide exercise + rest screens
    document.getElementById('focusScreenExercise').classList.add('hidden');
    document.getElementById('focusScreenRest').classList.add('hidden');
    document.getElementById('focusScreenWork').classList.remove('hidden');

    const timerEl  = document.getElementById('intervalWorkTime');
    const labelEl  = document.getElementById('intervalWorkLabel');
    const fillEl   = document.getElementById('intervalWorkBarFill');
    const phaseEl  = document.getElementById('intervalWorkPhase');
    const startBtn = document.getElementById('intervalStartBtn');
    const skipBtn  = document.getElementById('intervalSkipBtn');

    timerEl.textContent = intervalWorkLeft;
    labelEl.textContent = `Round ${focusRoundIdx + 1}`;
    phaseEl.textContent = 'GO';
    phaseEl.className = 'interval-phase-label go';

    // Hide start button, show skip button
    if (startBtn) startBtn.classList.add('hidden');
    if (skipBtn) skipBtn.classList.remove('hidden');

    // Fill bar animation
    fillEl.style.transition = 'none';
    fillEl.style.width = '100%';
    requestAnimationFrame(() => {
        fillEl.style.transition = `width ${workSec}s linear`;
        fillEl.style.width = '0%';
    });

    // Audio: GO beep (high, double)
    playBeep(1046, 0.15, 2);

    intervalWorkInterval = setInterval(() => {
        intervalWorkLeft--;
        if (timerEl) timerEl.textContent = intervalWorkLeft;

        // Warning beep at 3, 2, 1
        if (intervalWorkLeft <= 3 && intervalWorkLeft > 0) {
            playBeep(660, 0.08, 1);
        }

        if (intervalWorkLeft <= 0) {
            clearInterval(intervalWorkInterval);
            intervalWorkInterval = null;
            // Audio: STOP beep (low, long)
            playBeep(440, 0.25, 1);
            // Transition to combined rest + KPI screen
            endWorkPhase();
        }
    }, 1000);
}

function endWorkPhase() {
    intervalPhase = 'rest';

    const ex = workoutData[currentPhase].exercises[focusExIdx];
    let restSeconds = 0;
    if (ex.rest !== '—' && ex.rest !== '0') {
        restSeconds = parseInt(ex.rest.split('-')[0]) || 0;
    }

    // Go directly to rest screen with KPI inputs — timer starts immediately
    showCardioRestScreen(restSeconds);
}

function skipWorkPhase() {
    clearIntervalTimer();
    endWorkPhase();
}

function saveCardioKPIs() {
    const sk   = getSessionKey();
    const wVal = document.getElementById('cardioDistance');
    const rVal = document.getElementById('cardioCalories');

    if (!sessionData[sk]) sessionData[sk] = {};
    if (wVal && wVal.value) sessionData[sk][`${sk}-${focusExIdx}-${focusSetIdx}-weight`] = wVal.value;
    if (rVal && rVal.value) sessionData[sk][`${sk}-${focusExIdx}-${focusSetIdx}-reps`]   = rVal.value;

    completedSets[`${sk}-${focusExIdx}-${focusSetIdx}`] = true;
    saveToStorage();
    recordWorkoutDate();
}

function showCardioRestScreen(seconds) {
    // Hide work + exercise screens, show rest screen
    document.getElementById('focusScreenWork').classList.add('hidden');
    document.getElementById('focusScreenExercise').classList.add('hidden');
    document.getElementById('focusScreenRest').classList.remove('hidden');

    const group       = focusBlockGroups[focusGroupIdx];
    const firstEx     = workoutData[currentPhase].exercises[group.exercises[0]];
    const totalRounds = getActualSets(firstEx, currentPhase, currentSession);

    // Show cardio KPI inputs
    const kpiContainer = document.getElementById('cardioKpiInputs');
    if (kpiContainer) {
        kpiContainer.classList.remove('hidden');
        // Pre-populate from any existing saved data
        const sk = getSessionKey();
        const distInp = document.getElementById('cardioDistance');
        const calInp  = document.getElementById('cardioCalories');
        const savedDist = sessionData[sk] && sessionData[sk][`${sk}-${focusExIdx}-${focusSetIdx}-weight`];
        const savedCals = sessionData[sk] && sessionData[sk][`${sk}-${focusExIdx}-${focusSetIdx}-reps`];
        if (distInp) distInp.value = savedDist || '';
        if (calInp)  calInp.value  = savedCals || '';
    }

    // RPE only on final round
    const isLastSet = focusRoundIdx === totalRounds - 1;
    const rpeEl     = document.getElementById('focusRPE');
    if (rpeEl) rpeEl.style.display = isLastSet ? '' : 'none';

    // RPE button state
    const sk = getSessionKey();
    const currentRpe = rpeData[`${sk}-${focusExIdx}-${focusSetIdx}`];
    document.querySelectorAll('.focus-rpe-btn').forEach(b => b.classList.remove('selected'));
    if (currentRpe) {
        const rpeBtn = document.querySelector(`.focus-rpe-btn.${currentRpe}`);
        if (rpeBtn) rpeBtn.classList.add('selected');
    }

    // On-deck preview
    renderFocusOnDeck();

    // Update set dots
    renderFocusSetDots(totalRounds);

    const restDisplay = document.getElementById('focusRestDisplay');
    const continueBtn = document.getElementById('focusContinueBtn');

    if (seconds > 0) {
        restDisplay.classList.remove('hidden');
        continueBtn.classList.add('hidden');

        if (focusRestInterval) clearInterval(focusRestInterval);
        focusRestLeft  = seconds;
        focusRestTotal = seconds;

        const restTimeEl = document.getElementById('focusRestTime');
        const restFillEl = document.getElementById('focusRestBarFill');

        restTimeEl.textContent      = formatTime(focusRestLeft);
        restFillEl.style.transition = 'none';
        restFillEl.style.width      = '100%';
        requestAnimationFrame(() => {
            restFillEl.style.transition = `width ${seconds}s linear`;
            restFillEl.style.width      = '0%';
        });

        focusRestInterval = setInterval(() => {
            focusRestLeft--;
            if (restTimeEl) restTimeEl.textContent = formatTime(focusRestLeft);

            // Warning beeps at 3, 2, 1
            if (focusRestLeft <= 3 && focusRestLeft > 0) {
                playBeep(660, 0.08, 1);
            }

            if (focusRestLeft <= 0) {
                clearInterval(focusRestInterval);
                focusRestInterval = null;
                if (restTimeEl) restTimeEl.textContent = 'Done!';
                // Auto-save any entered KPIs
                saveCardioKPIs();
                intervalPhase = null;
                // Hide cardio KPI inputs
                if (kpiContainer) kpiContainer.classList.add('hidden');
                setTimeout(() => advanceFocusSet(), 600);
            }
        }, 1000);
    } else {
        restDisplay.classList.add('hidden');
        continueBtn.classList.remove('hidden');
    }
}

/* ════════════════ EDT BLOCK VIEW ════════════════ */
function getBlockSets(exIdx) {
    const sk = getSessionKey();
    return parseInt((sessionData[sk] || {})[`${sk}-${exIdx}-block-sets`]) || 0;
}

function getPrevBlockSets(exIdx) {
    if (currentSession < 2) return null;
    const prevSk   = `${currentPhase}-${currentSession - 1}`;
    const prevData = sessionData[prevSk];
    if (!prevData) return null;
    const val = parseInt(prevData[`${prevSk}-${exIdx}-block-sets`]);
    return isNaN(val) ? null : val;
}

function getBlockWeight(exIdx) {
    const sk    = getSessionKey();
    const curWt = (sessionData[sk] || {})[`${sk}-${exIdx}-block-weight`];
    if (curWt) return curWt;
    if (currentSession >= 2) {
        const prevSk = `${currentPhase}-${currentSession - 1}`;
        const prevWt = (sessionData[prevSk] || {})[`${prevSk}-${exIdx}-block-weight`];
        if (prevWt) return prevWt;
    }
    return '';
}

function saveBlockWeight(exIdx, value) {
    const sk = getSessionKey();
    if (!sessionData[sk]) sessionData[sk] = {};
    sessionData[sk][`${sk}-${exIdx}-block-weight`] = value;
    saveToStorage();
}

function incrementBlockSet(exIdx) {
    const sk = getSessionKey();
    if (!sessionData[sk]) sessionData[sk] = {};
    sessionData[sk][`${sk}-${exIdx}-block-sets`] = getBlockSets(exIdx) + 1;
    completedSets[`${sk}-${exIdx}-0`] = true;
    saveToStorage();
    recordWorkoutDate();
    const counterEl = document.getElementById(`block-counter-${exIdx}`);
    const vsEl      = document.getElementById(`block-vs-${exIdx}`);
    if (counterEl) {
        counterEl.textContent = getBlockSets(exIdx);
        counterEl.classList.add('block-set-plus-pulse');
        setTimeout(() => counterEl.classList.remove('block-set-plus-pulse'), 300);
    }
    if (vsEl) vsEl.innerHTML = buildDeltaHTML(exIdx);
}

function decrementBlockSet(exIdx) {
    const current = getBlockSets(exIdx);
    if (current <= 0) return;
    const sk = getSessionKey();
    if (!sessionData[sk]) sessionData[sk] = {};
    sessionData[sk][`${sk}-${exIdx}-block-sets`] = current - 1;
    saveToStorage();
    const counterEl = document.getElementById(`block-counter-${exIdx}`);
    const vsEl      = document.getElementById(`block-vs-${exIdx}`);
    if (counterEl) counterEl.textContent = getBlockSets(exIdx);
    if (vsEl) vsEl.innerHTML = buildDeltaHTML(exIdx);
}

function buildDeltaHTML(exIdx) {
    const cur  = getBlockSets(exIdx);
    const prev = getPrevBlockSets(exIdx);
    if (prev === null) return cur > 0 ? `<span class="block-set-delta-same">${cur} sets logged</span>` : '<span>first week</span>';
    const delta = cur - prev;
    const sign  = delta > 0 ? '+' : '';
    const cls   = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
    return `last week: ${prev} &nbsp;<span class="block-set-delta-${cls}">${sign}${delta}</span>`;
}

function renderBlockView() {
    document.getElementById('focusScreenBlock').classList.remove('hidden');
    document.getElementById('focusScreenExercise').classList.add('hidden');
    document.getElementById('focusScreenRest').classList.add('hidden');
    const workScreen = document.getElementById('focusScreenWork');
    if (workScreen) workScreen.classList.add('hidden');
    document.getElementById('focusOverlay').classList.add('block-mode');

    const group = focusBlockGroups[focusGroupIdx];

    if (focusGroupIdx !== lastRenderedGroupIdx) {
        lastRenderedGroupIdx = focusGroupIdx;
        initBlockTimer();
    }

    const progLabel = group.halved ? `${group.type} (${group.subLabel})` : group.type;
    document.getElementById('focusProgText').textContent = progLabel;
    document.getElementById('blockDoneName').textContent = progLabel;
    renderBlockProgress();

    // Straight-sets toggle — visible when block has 2 exercises OR is already split
    const canSplit  = group.exercises.length > 1;
    const isSplit   = !!group.halved;
    const toggleEl  = document.getElementById('blockSplitToggle');
    if (toggleEl) {
        if (canSplit || isSplit) {
            toggleEl.textContent = isSplit ? '⇄ Back to superset' : '⇄ Straight sets';
            toggleEl.classList.remove('hidden');
            toggleEl.onclick = () => toggleStraightSets(group.type);
        } else {
            toggleEl.classList.add('hidden');
        }
    }

    const listEl = document.getElementById('blockExList');
    listEl.innerHTML = group.exercises.map(exIdx => {
        const ex     = workoutData[currentPhase].exercises[exIdx];
        const sets   = getBlockSets(exIdx);
        const weight = getBlockWeight(exIdx);
        const wLabel = weight ? `${weight} lbs` : 'Set weight';
        return `
        <div class="block-ex-card">
            <div class="block-ex-name">${ex.name}</div>
            <div class="block-ex-weight-row" id="block-weight-row-${exIdx}" onclick="editBlockWeight(${exIdx})" style="cursor:pointer">
                <span class="block-ex-weight-val" id="block-weight-val-${exIdx}">${wLabel}</span>
                <button class="block-ex-edit-btn" title="Edit weight">✏️</button>
            </div>
            <div class="block-set-counter" id="block-counter-${exIdx}">${sets}</div>
            <div class="block-set-vs" id="block-vs-${exIdx}">${buildDeltaHTML(exIdx)}</div>
            <div class="block-set-btns">
                <button class="block-set-minus" onclick="decrementBlockSet(${exIdx})">−</button>
                <button class="block-set-plus" onclick="incrementBlockSet(${exIdx})">+</button>
            </div>
        </div>`;
    }).join('');

    document.getElementById('focusPrevBtn').style.display = 'none';
    document.getElementById('focusNextBtn').style.display = 'none';
}

function toggleStraightSets(blockType) {
    const currentFirstEx = focusBlockGroups[focusGroupIdx].exercises[0];
    if (straightSetsBlocks.has(blockType)) {
        straightSetsBlocks.delete(blockType);
    } else {
        straightSetsBlocks.add(blockType);
    }
    clearBlockTimer();
    lastRenderedGroupIdx = -1;
    focusBlockGroups = buildBlockGroups();
    const newIdx = focusBlockGroups.findIndex(g => g.exercises.includes(currentFirstEx));
    focusGroupIdx = newIdx >= 0 ? newIdx : 0;
    renderBlockView();
}

function editBlockWeight(exIdx) {
    const row = document.getElementById(`block-weight-row-${exIdx}`);
    if (!row) return;
    const current = getBlockWeight(exIdx);
    row.innerHTML = `
        <input class="block-ex-weight-input" id="block-weight-inp-${exIdx}"
               type="number" inputmode="decimal" value="${current}" placeholder="lbs"
               onblur="saveBlockWeightEdit(${exIdx})">
        <button class="block-ex-edit-btn" onmousedown="event.preventDefault()" onclick="saveBlockWeightEdit(${exIdx})">✓</button>`;
    const inp = document.getElementById(`block-weight-inp-${exIdx}`);
    if (inp) { inp.focus(); inp.select(); }
}

function saveBlockWeightEdit(exIdx) {
    const inp = document.getElementById(`block-weight-inp-${exIdx}`);
    if (!inp) return;
    const val = inp.value.trim();
    if (val) saveBlockWeight(exIdx, val);
    const row     = document.getElementById(`block-weight-row-${exIdx}`);
    const display = val ? `${val} lbs` : 'Set weight';
    row.innerHTML = `
        <span class="block-ex-weight-val" id="block-weight-val-${exIdx}">${display}</span>
        <button class="block-ex-edit-btn" onclick="editBlockWeight(${exIdx})" title="Edit weight">✏️</button>`;
}

function advanceToNextBlock() {
    if (focusGroupIdx < focusBlockGroups.length - 1) {
        focusGroupIdx++;
        focusSubIdx   = 0;
        focusRoundIdx = 0;
        syncFocusState();
        renderBlockView();
    } else {
        showSummary();
    }
}

/* ════════════════ WEIGHT LOCK (EDT weight-once per block) ════════════════ */
function unlockBlockWeight() {
    const inp  = document.getElementById('focusWeight');
    const btn  = document.getElementById('weightEditBtn');
    const hint = document.getElementById('weightLockedHint');
    if (inp)  { inp.readOnly = false; inp.classList.remove('weight-locked'); inp.focus(); }
    if (btn)  btn.classList.add('hidden');
    if (hint) hint.classList.add('hidden');
}

/* ════════════════ FOCUS MODE ════════════════ */
function buildBlockGroups() {
    const exercises = workoutData[currentPhase].exercises;
    const merged = [];
    let current = null;
    exercises.forEach((ex, idx) => {
        if (!current || current.type !== ex.type) {
            current = { type: ex.type, exercises: [idx] };
            merged.push(current);
        } else {
            current.exercises.push(idx);
        }
    });
    // Split any block toggled to straight-sets into individual sub-groups
    const result = [];
    merged.forEach(g => {
        if (straightSetsBlocks.has(g.type) && g.exercises.length > 1) {
            g.exercises.forEach((exIdx, i) =>
                result.push({ type: g.type, exercises: [exIdx], halved: true, subLabel: `${g.type.replace('Block ','')}${i + 1}` })
            );
        } else {
            result.push(g);
        }
    });
    return result;
}

function syncFocusState() {
    focusExIdx  = focusBlockGroups[focusGroupIdx].exercises[focusSubIdx];
    focusSetIdx = focusRoundIdx;
}

function enterFocusMode() {
    straightSetsBlocks   = new Set();
    localStorage.removeItem('wt-block-timer');
    focusBlockGroups     = buildBlockGroups();
    focusGroupIdx        = 0;
    focusSubIdx          = 0;
    focusRoundIdx        = 0;
    lastRenderedGroupIdx = -1;
    syncFocusState();
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
    clearIntervalTimer();
    document.getElementById('focusOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    startSessionTimer();
    renderBlockView();
}

function exitFocusMode() {
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
    clearIntervalTimer();
    clearBlockTimer();
    stopSessionTimer();
    const overlay = document.getElementById('focusOverlay');
    overlay.classList.add('hidden');
    overlay.classList.remove('block-mode');
    // Clean up video iframe when exiting
    const videoEmbed = document.getElementById('focusVideoEmbed');
    if (videoEmbed) { videoEmbed.innerHTML = ''; videoEmbed.classList.add('hidden'); }
    document.body.style.overflow = '';
    updateWorkout();
}

function toggleFocusVideo() {
    const embed  = document.getElementById('focusVideoEmbed');
    const toggle = document.getElementById('focusVideoToggle');
    const isOpen = !embed.classList.contains('hidden');
    if (isOpen) {
        embed.classList.add('hidden');
        embed.innerHTML = '';
        toggle.classList.remove('open');
        toggle.textContent = '▶ Watch form';
    } else {
        const ex       = workoutData[currentPhase].exercises[focusExIdx];
        const videoUrl = exerciseVideos[ex.name];
        if (!videoUrl) return;
        const videoId = new URL(videoUrl).searchParams.get('v');
        if (!videoId) return;
        embed.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?rel=0" allowfullscreen loading="lazy"></iframe>`;
        embed.classList.remove('hidden');
        toggle.classList.add('open');
        toggle.textContent = '✕ Hide video';
    }
}

/* ════════════════ PROGRESS SUMMARY ════════════════ */
function calcSessionStats() {
    const sk      = getSessionKey();
    const data    = workoutData[currentPhase];
    const curData = sessionData[sk] || {};

    // Count completed sets for this session
    let setsCompleted = 0;
    Object.keys(completedSets).forEach(key => {
        if (key.startsWith(sk + '-')) setsCompleted++;
    });

    // Total volume: sum weight × reps for all sets with data
    let totalVolume = 0;
    data.exercises.forEach((ex, exIdx) => {
        const actualSets = getActualSets(ex, currentPhase, currentSession);
        for (let s = 0; s < actualSets; s++) {
            const w = parseFloat(curData[`${sk}-${exIdx}-${s}-weight`]);
            const r = parseFloat(curData[`${sk}-${exIdx}-${s}-reps`]);
            if (!isNaN(w) && !isNaN(r)) totalVolume += w * r;
        }
    });

    // PRs: current session max weight > all previous sessions' max for that exercise
    const prs = [];
    data.exercises.forEach((ex, exIdx) => {
        const actualSets = getActualSets(ex, currentPhase, currentSession);
        let currentMax = 0;
        for (let s = 0; s < actualSets; s++) {
            const w = parseFloat(curData[`${sk}-${exIdx}-${s}-weight`]);
            if (!isNaN(w) && w > currentMax) currentMax = w;
        }
        if (currentMax <= 0) return;

        let histMax = 0;
        Object.entries(sessionData).forEach(([prevSk, prevData]) => {
            if (prevSk === sk) return;
            Object.keys(prevData).forEach(key => {
                if (key.startsWith(`${prevSk}-${exIdx}-`) && key.endsWith('-weight')) {
                    const pw = parseFloat(prevData[key]);
                    if (!isNaN(pw) && pw > histMax) histMax = pw;
                }
            });
        });

        if (currentMax > histMax) {
            prs.push({ name: ex.name, weight: currentMax });
        }
    });

    return { setsCompleted, totalVolume, prs };
}

function buildScoreboardHTML() {
    const exercises = workoutData[currentPhase].exercises;
    const prevSk    = currentSession >= 2 ? `${currentPhase}-${currentSession - 1}` : null;
    const prevData  = prevSk ? (sessionData[prevSk] || {}) : null;

    let totalCur = 0, totalPrev = 0, hasPrev = false;

    const rows = focusBlockGroups.map(group => {
        const headerRow = `<div class="sb-block-header">${group.type}</div>`;
        const exRows = group.exercises.map(exIdx => {
            const ex      = exercises[exIdx];
            const cur     = getBlockSets(exIdx);
            const prevVal = prevData ? (parseInt(prevData[`${prevSk}-${exIdx}-block-sets`]) || 0) : null;
            totalCur += cur;
            if (prevVal !== null) { totalPrev += prevVal; hasPrev = true; }

            let deltaHTML = '';
            if (prevVal !== null) {
                const d = cur - prevVal;
                const cls  = d > 0 ? 'up' : d < 0 ? 'down' : 'same';
                const sign = d > 0 ? '+' : '';
                deltaHTML = `<span class="sb-ex-delta block-set-delta-${cls}">${sign}${d} (was ${prevVal})</span>`;
            }
            return `<div class="sb-ex-row">
                <span class="sb-ex-name">${ex.name}</span>
                <span class="sb-ex-sets">${cur} sets${deltaHTML}</span>
            </div>`;
        }).join('');
        return headerRow + exRows;
    }).join('');

    const totalDelta = hasPrev
        ? (() => {
            const d = totalCur - totalPrev;
            const cls  = d > 0 ? 'up' : d < 0 ? 'down' : 'same';
            const sign = d > 0 ? '+' : '';
            return `<span class="sb-ex-delta block-set-delta-${cls}">${sign}${d} from last week (${totalPrev})</span>`;
        })()
        : '';

    return `<div class="summary-scoreboard">${rows}
        <div class="sb-total-row">
            <span>Total</span>
            <span>${totalCur} sets &nbsp;${totalDelta}</span>
        </div>
    </div>`;
}

function showSummary() {
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
    clearIntervalTimer();
    const sessionElapsed = stopSessionTimer();
    document.getElementById('focusOverlay').classList.add('hidden');
    document.body.style.overflow = '';
    updateWorkout();

    const data           = workoutData[currentPhase];
    const isLastSession  = currentSession >= data.totalSessions;
    const isLastPhase    = currentPhase >= 4;
    const stats          = calcSessionStats();

    document.getElementById('summaryPhaseSession').textContent =
        `Day ${currentPhase} · Week ${currentSession} of ${data.totalSessions}`;

    const durationText = sessionElapsed > 0 ? formatSessionDuration(sessionElapsed) : '—';
    document.getElementById('summaryDuration').textContent = durationText;
    if (sessionElapsed > 0) {
        try { sessionStorage.setItem('wt-last-duration', durationText); } catch (e) {}
    }
    // EDT scoreboard: total sets this week
    const totalSets = focusBlockGroups.reduce((sum, g) =>
        sum + g.exercises.reduce((s, ei) => s + getBlockSets(ei), 0), 0);
    document.getElementById('summarySets').textContent = totalSets;
    document.getElementById('summaryVolume').textContent = '—';
    document.getElementById('summaryPRCount').textContent = '—';

    // Scoreboard: per-block, per-exercise set count vs last week
    const prSection = document.getElementById('summaryPRSection');
    prSection.style.display = '';
    document.getElementById('summaryPRList').innerHTML = buildScoreboardHTML();

    // CTA
    const ctaBtn = document.getElementById('summaryCTA');
    if (isLastPhase && isLastSession) {
        document.getElementById('summaryEmoji').textContent  = '🏆';
        document.getElementById('summaryTitle').textContent  = 'Program Complete!';
        ctaBtn.textContent = 'View Full Summary';
        ctaBtn.className   = 'summary-cta-btn finish';
        ctaBtn.onclick     = hideSummary;
    } else if (isLastSession) {
        document.getElementById('summaryEmoji').textContent  = '🎉';
        document.getElementById('summaryTitle').textContent  = 'Day Complete!';
        ctaBtn.textContent = `Start Day ${currentPhase + 1} →`;
        ctaBtn.className   = 'summary-cta-btn';
        ctaBtn.onclick     = () => { hideSummary(); selectPhase(currentPhase + 1); };
    } else {
        document.getElementById('summaryEmoji').textContent  = '🎉';
        document.getElementById('summaryTitle').textContent  = 'Week Complete!';
        ctaBtn.textContent = `Continue to Week ${currentSession + 1} →`;
        ctaBtn.className   = 'summary-cta-btn';
        ctaBtn.onclick     = () => { hideSummary(); selectSession(currentSession + 1); };
    }

    document.getElementById('summaryOverlay').classList.remove('hidden');
}

function hideSummary() {
    document.getElementById('summaryOverlay').classList.add('hidden');
}

function tempoToCue(tempo) {
    if (!tempo || tempo.length !== 4) return null;
    const ecc   = parseInt(tempo[0]);  // eccentric (lowering)
    const pBot  = parseInt(tempo[1]);  // pause at bottom
    const con   = parseInt(tempo[2]);  // concentric (lifting)
    const pTop  = parseInt(tempo[3]);  // pause at top

    const parts = [];
    // Eccentric phase
    if (ecc >= 4)      parts.push(`${ecc}s down — slow negative`);
    else if (ecc >= 3) parts.push(`${ecc}s down — controlled`);
    else if (ecc >= 2) parts.push(`${ecc}s down`);

    // Bottom pause
    if (pBot >= 2)      parts.push(`${pBot}s pause at bottom`);
    else if (pBot === 1) parts.push('brief pause at bottom');

    // Concentric phase
    if (con === 0)      parts.push('explode up');
    else if (con === 1) parts.push('drive up');
    else if (con >= 2)  parts.push(`${con}s up — controlled`);

    // Top pause
    if (pTop >= 2)      parts.push(`${pTop}s squeeze at top`);
    else if (pTop === 1) parts.push('squeeze at top');

    return parts.join(', ');
}

function renderFocusSetDots(totalRounds) {
    const sk    = getSessionKey();
    const group = focusBlockGroups[focusGroupIdx];
    let html    = '';
    for (let r = 0; r < totalRounds; r++) {
        const allDone = group.exercises.every(ei => !!completedSets[`${sk}-${ei}-${r}`]);
        const current = r === focusRoundIdx;
        html += `<div class="focus-set-dot${allDone ? ' done' : current ? ' current' : ''}" onclick="jumpFocusSet(${r})"></div>`;
    }
    document.getElementById('focusSetDots').innerHTML = html;
}

function renderFocusOnDeck() {
    const el = document.getElementById('focusOnDeck');
    if (!el) return;
    const group       = focusBlockGroups[focusGroupIdx];
    const isSuperset  = group.exercises.length > 1;
    const firstEx     = workoutData[currentPhase].exercises[group.exercises[0]];
    const totalRounds = getActualSets(firstEx, currentPhase, currentSession);
    let nextEx = null, nextLabel = 'Up Next', nextPrev = null;

    if (isSuperset && focusSubIdx < group.exercises.length - 1) {
        // Next exercise in superset pair
        const nextExIdx = group.exercises[focusSubIdx + 1];
        nextEx    = workoutData[currentPhase].exercises[nextExIdx];
        nextLabel = 'Up Next';
        nextPrev  = getPrevData(nextExIdx, focusRoundIdx);
    } else if (focusRoundIdx < totalRounds - 1) {
        // More rounds — show what's coming (first exercise in next round)
        const nextExIdx = group.exercises[0];
        nextEx    = workoutData[currentPhase].exercises[nextExIdx];
        nextLabel = `Next: Round ${focusRoundIdx + 2} of ${totalRounds}`;
        nextPrev  = getPrevData(nextExIdx, focusRoundIdx + 1);
    } else if (focusGroupIdx < focusBlockGroups.length - 1) {
        // Next block
        const nextGroup = focusBlockGroups[focusGroupIdx + 1];
        const nextExIdx = nextGroup.exercises[0];
        nextEx    = workoutData[currentPhase].exercises[nextExIdx];
        nextLabel = `Next: ${nextGroup.type}`;
        nextPrev  = getPrevData(nextExIdx, 0);
    }

    if (!nextEx) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = `
        <div class="on-deck-label">${nextLabel}</div>
        <div class="on-deck-name">${nextEx.name}</div>
        ${nextPrev && nextPrev.weight !== '—' ? `<div class="on-deck-prev">${nextPrev.weight} lbs × ${nextPrev.reps}</div>` : ''}
    `;
}

function renderBlockProgress() {
    const el = document.getElementById('focusBlockProgress');
    if (!el) return;
    // Deduplicate by type so straight-sets split of Block A still shows one "A" node
    const seen = new Set();
    const deduped = focusBlockGroups.map((g, i) => ({ g, i })).filter(({ g }) => {
        if (seen.has(g.type)) return false;
        seen.add(g.type);
        return true;
    });
    el.innerHTML = deduped.map(({ g, i }) => {
        const label = g.type.replace('Block ', '').replace('Warm-Up', 'WU');
        // Mark done if all groups of this type are behind focusGroupIdx
        const allIdxForType = focusBlockGroups.reduce((acc, fg, fi) => {
            if (fg.type === g.type) acc.push(fi);
            return acc;
        }, []);
        const allDone    = allIdxForType.every(fi => fi < focusGroupIdx);
        const isCurrent  = allIdxForType.includes(focusGroupIdx);
        const cls = allDone ? 'bp-done' : isCurrent ? 'bp-current' : '';
        return `<div class="bp-node ${cls}">${label}</div>`;
    }).join('');
}

function renderFocusExercise(skipAutoStart) {
    // Switch to exercise screen
    document.getElementById('focusScreenExercise').classList.remove('hidden');
    document.getElementById('focusScreenRest').classList.add('hidden');
    const workScreen = document.getElementById('focusScreenWork');
    if (workScreen) workScreen.classList.add('hidden');

    // Detect block transition → reset block timer
    if (focusGroupIdx !== lastRenderedGroupIdx) {
        lastRenderedGroupIdx = focusGroupIdx;
        initBlockTimer();
    }

    const data        = workoutData[currentPhase];
    const exercises   = data.exercises;
    const group       = focusBlockGroups[focusGroupIdx];
    const isSuperset  = group.exercises.length > 1;
    const ex          = exercises[focusExIdx];
    const firstEx     = exercises[group.exercises[0]];
    const totalRounds = getActualSets(firstEx, currentPhase, currentSession);
    const sk          = getSessionKey();
    const curData     = sessionData[sk] || {};
    const wKey        = `${sk}-${focusExIdx}-${focusSetIdx}-weight`;
    const rKey        = `${sk}-${focusExIdx}-${focusSetIdx}-reps`;
    const prev        = getPrevData(focusExIdx, focusSetIdx);
    // Auto-fill: use saved data, then progression weight, then previous weight
    const cue         = getProgressionCue(focusExIdx, focusSetIdx);
    const progMatch   = cue && cue.type === 'up' ? cue.text.match(/([\d.]+)\s*lbs/) : null;
    const progWeight  = progMatch ? progMatch[1] : null;
    const savedW      = curData[wKey] || progWeight || (prev && prev.weight !== '—' ? prev.weight : '');
    const savedR      = curData[rKey] || (prev && prev.reps   !== '—' ? prev.reps   : '');
    const isDone      = !!completedSets[`${sk}-${focusExIdx}-${focusSetIdx}`];

    // Header text
    if (isSuperset) {
        document.getElementById('focusProgText').textContent =
            `${group.type} · Round ${focusRoundIdx + 1} of ${totalRounds}`;
    } else {
        document.getElementById('focusProgText').textContent =
            `${group.type} · ${ex.work ? 'Round' : 'Set'} ${focusRoundIdx + 1} of ${totalRounds}`;
    }

    // Block tag removed — redundant with header block progress indicator
    document.getElementById('focusBlockTag').style.display = 'none';
    document.getElementById('focusExName').textContent   = ex.name;

    const focusIsCardio = !!ex.work;
    if (isSuperset) {
        document.getElementById('focusSetCounter').textContent =
            `Exercise ${focusSubIdx + 1} of ${group.exercises.length} · Round ${focusRoundIdx + 1} · ${ex.reps} reps`;
    } else {
        document.getElementById('focusSetCounter').textContent =
            focusIsCardio
                ? `Round ${focusSetIdx + 1} of ${totalRounds}`
                : `Set ${focusSetIdx + 1} of ${totalRounds} · ${ex.reps} reps`;
    }

    // Show note, tempo, and previous data as separate lines
    const noteEl = document.getElementById('focusNote');
    const tempoCueText = tempoToCue(ex.tempo);
    const noteLines = [];
    if (ex.note) noteLines.push(ex.note);
    if (tempoCueText) noteLines.push(tempoCueText);
    // Fold "First time" / "Last time" into the note block
    if (prev && prev.weight !== '—') {
        noteLines.push(focusIsCardio
            ? `Last time: ${prev.weight}m · ${prev.reps} cal`
            : `Last time: ${prev.weight} lbs × ${prev.reps} reps`);
    } else {
        noteLines.push(focusIsCardio ? 'First time — go all out' : 'First time — start comfortable');
    }
    if (noteLines.length) {
        noteEl.innerHTML = noteLines.join('<br>');
        noteEl.style.display = '';
    } else {
        noteEl.style.display = 'none';
    }

    // Show video toggle in focus mode when a video exists
    const videoWrap = document.getElementById('focusVideo');
    const videoEmbed = document.getElementById('focusVideoEmbed');
    const videoToggle = document.getElementById('focusVideoToggle');
    const videoUrl = exerciseVideos[ex.name];
    if (videoUrl) {
        videoWrap.classList.remove('hidden');
        videoEmbed.classList.add('hidden');
        videoEmbed.innerHTML = '';
        videoToggle.classList.remove('open');
        videoToggle.textContent = '▶ Watch form';
    } else {
        videoWrap.classList.add('hidden');
        videoEmbed.innerHTML = '';
    }

    // Hide standalone tempo element (merged into note line above)
    const tempoEl = document.getElementById('focusTempo');
    if (tempoEl) tempoEl.style.display = 'none';

    // Previous data now shown in the note block above — hide the standalone element
    document.getElementById('focusPrev').textContent = '';

    // Progression cue
    const progCue = getProgressionCue(focusExIdx, focusSetIdx);
    const cueEl   = document.getElementById('focusCue');
    if (cueEl) {
        if (progCue) {
            cueEl.textContent = progCue.text;
            cueEl.className   = `focus-cue focus-cue-${progCue.type}`;
        } else {
            cueEl.className = 'focus-cue hidden';
        }
    }

    // Update input labels and placeholders for cardio vs lifting
    const focusInputs = document.getElementById('focusInputs');
    const labels = focusInputs.querySelectorAll('label');
    const weightInp = document.getElementById('focusWeight');
    const repsInp   = document.getElementById('focusReps');
    if (focusIsCardio) {
        labels[0].textContent = 'Distance (m)';
        labels[1].textContent = 'Calories';
        weightInp.placeholder = 'm';
        repsInp.placeholder   = 'cals';
    } else {
        labels[0].textContent = 'Weight (lbs)';
        labels[1].textContent = 'Reps';
        weightInp.placeholder = 'lbs';
        repsInp.placeholder   = 'reps';
    }

    // EDT weight-once: lock weight after Round 1 (unless cardio)
    const blockWeightKey = `${sk}-${focusExIdx}-block-weight`;
    const blockWeight    = curData[blockWeightKey] || savedW;
    const editBtn  = document.getElementById('weightEditBtn');
    const hint     = document.getElementById('weightLockedHint');
    if (!focusIsCardio && focusSetIdx > 0 && blockWeight) {
        weightInp.value    = blockWeight;
        weightInp.readOnly = true;
        weightInp.classList.add('weight-locked');
        if (editBtn) editBtn.classList.remove('hidden');
        if (hint)    hint.classList.remove('hidden');
    } else {
        weightInp.value    = blockWeight || savedW;
        weightInp.readOnly = false;
        weightInp.classList.remove('weight-locked');
        if (editBtn) editBtn.classList.add('hidden');
        if (hint)    hint.classList.add('hidden');
    }
    repsInp.value = savedR;

    renderFocusSetDots(totalRounds);
    renderBlockProgress();

    // Prev/next buttons
    const isFirst = focusGroupIdx === 0 && focusRoundIdx === 0 && focusSubIdx === 0;
    const isLast  = focusGroupIdx === focusBlockGroups.length - 1 &&
                    focusRoundIdx === totalRounds - 1 &&
                    focusSubIdx === group.exercises.length - 1;
    const prevBtn = document.getElementById('focusPrevBtn');
    const nextBtn = document.getElementById('focusNextBtn');
    prevBtn.disabled    = isFirst;
    nextBtn.textContent = isLast ? 'Finish ✓' : 'Next →';
    nextBtn.className   = `focus-nav-btn${isLast ? ' finish' : ''}`;

    const doneBtn = document.getElementById('focusDoneBtn');
    doneBtn.textContent = isDone ? '✓ Done' : '✓ Done';

    // Auto-start interval for cardio exercises
    if (focusIsCardio && !skipAutoStart && !isDone && intervalPhase !== 'rest') {
        if (focusRoundIdx === 0) {
            // First round: show ready screen with START button
            showReadyScreen();
        } else {
            // Subsequent rounds: auto-countdown (user is already on the bike)
            showReadyScreen();
            runCountdown();
        }
    }
}

function confirmFocusSet() {
    const ex          = workoutData[currentPhase].exercises[focusExIdx];
    const group       = focusBlockGroups[focusGroupIdx];
    const firstEx     = workoutData[currentPhase].exercises[group.exercises[0]];
    const totalRounds = getActualSets(firstEx, currentPhase, currentSession);
    const isSuperset  = group.exercises.length > 1;
    const sk          = getSessionKey();
    const wVal        = document.getElementById('focusWeight').value;
    const rVal        = document.getElementById('focusReps').value;

    if (!sessionData[sk]) sessionData[sk] = {};
    if (wVal) {
        sessionData[sk][`${sk}-${focusExIdx}-${focusSetIdx}-weight`] = wVal;
        if (!ex.work) sessionData[sk][`${sk}-${focusExIdx}-block-weight`] = wVal;  // EDT: lock for block
    }
    if (rVal) sessionData[sk][`${sk}-${focusExIdx}-${focusSetIdx}-reps`] = rVal;

    completedSets[`${sk}-${focusExIdx}-${focusSetIdx}`] = true;
    saveToStorage();
    recordWorkoutDate();

    renderFocusSetDots(totalRounds);

    // Use this exercise's rest value
    let restSeconds = 0;
    if (ex.rest !== '—' && ex.rest !== '0') {
        restSeconds = parseInt(ex.rest.split('-')[0]) || 0;
    }

    // For cardio, mark that we're in rest phase of the interval cycle
    if (ex.work) intervalPhase = 'rest';

    showRestScreen(restSeconds);
}

function showRestScreen(seconds) {
    // Switch screens
    document.getElementById('focusScreenExercise').classList.add('hidden');
    document.getElementById('focusScreenRest').classList.remove('hidden');

    // Hide cardio KPI inputs (this is the non-cardio rest screen path)
    const kpiContainer = document.getElementById('cardioKpiInputs');
    if (kpiContainer) kpiContainer.classList.add('hidden');

    // Only show RPE on the final set of the current exercise
    const sk = getSessionKey();
    const group       = focusBlockGroups[focusGroupIdx];
    const firstEx     = workoutData[currentPhase].exercises[group.exercises[0]];
    const totalRounds = getActualSets(firstEx, currentPhase, currentSession);
    const isLastSet   = focusRoundIdx === totalRounds - 1;
    const rpeEl       = document.getElementById('focusRPE');
    if (rpeEl) rpeEl.style.display = isLastSet ? '' : 'none';

    // RPE button state for this set
    const currentRpe = rpeData[`${sk}-${focusExIdx}-${focusSetIdx}`];
    document.querySelectorAll('.focus-rpe-btn').forEach(b => b.classList.remove('selected'));
    if (currentRpe) {
        const rpeBtn = document.querySelector(`.focus-rpe-btn.${currentRpe}`);
        if (rpeBtn) rpeBtn.classList.add('selected');
    }

    // Populate on-deck preview
    renderFocusOnDeck();

    const restDisplay  = document.getElementById('focusRestDisplay');
    const continueBtn  = document.getElementById('focusContinueBtn');

    if (seconds > 0) {
        // Timed rest mode
        restDisplay.classList.remove('hidden');
        continueBtn.classList.add('hidden');

        if (focusRestInterval) clearInterval(focusRestInterval);
        focusRestLeft  = seconds;
        focusRestTotal = seconds;

        const restTimeEl = document.getElementById('focusRestTime');
        const restFillEl = document.getElementById('focusRestBarFill');

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

            // Warning beeps at 3, 2, 1 for cardio (next round incoming)
            const ex = workoutData[currentPhase].exercises[focusExIdx];
            if (ex.work && focusRestLeft <= 3 && focusRestLeft > 0) {
                playBeep(660, 0.08, 1);
            }

            if (focusRestLeft <= 0) {
                clearInterval(focusRestInterval);
                focusRestInterval = null;
                if (restTimeEl) restTimeEl.textContent = 'Done!';
                intervalPhase = null;
                setTimeout(() => advanceFocusSet(), 600);
            }
        }, 1000);
    } else {
        // No-timer review mode (mid-superset or no-rest exercises)
        restDisplay.classList.add('hidden');
        continueBtn.classList.remove('hidden');
    }
}

function skipFocusRest() {
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
    // Save cardio KPIs if present before skipping
    const ex = workoutData[currentPhase].exercises[focusExIdx];
    if (ex.work) {
        saveCardioKPIs();
        intervalPhase = null;
        const kpiContainer = document.getElementById('cardioKpiInputs');
        if (kpiContainer) kpiContainer.classList.add('hidden');
    }
    advanceFocusSet();
}

function advanceFocusSet() {
    const group       = focusBlockGroups[focusGroupIdx];
    const firstEx     = workoutData[currentPhase].exercises[group.exercises[0]];
    const totalRounds = getActualSets(firstEx, currentPhase, currentSession);

    if (group.exercises.length > 1) {
        // SUPERSET — advance within round, then to next round, then next group
        if (focusSubIdx < group.exercises.length - 1) {
            focusSubIdx++;
        } else if (focusRoundIdx < totalRounds - 1) {
            focusRoundIdx++;
            focusSubIdx = 0;
        } else if (focusGroupIdx < focusBlockGroups.length - 1) {
            focusGroupIdx++;
            focusSubIdx   = 0;
            focusRoundIdx = 0;
        } else {
            showSummary();
            return;
        }
    } else {
        // SOLO — advance set, then next group
        if (focusRoundIdx < totalRounds - 1) {
            focusRoundIdx++;
        } else if (focusGroupIdx < focusBlockGroups.length - 1) {
            focusGroupIdx++;
            focusSubIdx   = 0;
            focusRoundIdx = 0;
        } else {
            showSummary();
            return;
        }
    }
    syncFocusState();
    renderFocusExercise();
}

function focusNavPrev() {
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
    clearIntervalTimer();

    const group = focusBlockGroups[focusGroupIdx];
    if (group.exercises.length > 1) {
        if (focusSubIdx > 0) {
            focusSubIdx--;
        } else if (focusRoundIdx > 0) {
            focusRoundIdx--;
            focusSubIdx = group.exercises.length - 1;
        } else if (focusGroupIdx > 0) {
            focusGroupIdx--;
            const pg = focusBlockGroups[focusGroupIdx];
            focusSubIdx   = pg.exercises.length - 1;
            const pfe     = workoutData[currentPhase].exercises[pg.exercises[0]];
            focusRoundIdx = getActualSets(pfe, currentPhase, currentSession) - 1;
        }
    } else {
        if (focusRoundIdx > 0) {
            focusRoundIdx--;
        } else if (focusGroupIdx > 0) {
            focusGroupIdx--;
            const pg = focusBlockGroups[focusGroupIdx];
            focusSubIdx   = pg.exercises.length - 1;
            const pfe     = workoutData[currentPhase].exercises[pg.exercises[0]];
            focusRoundIdx = getActualSets(pfe, currentPhase, currentSession) - 1;
        }
    }
    syncFocusState();
    renderFocusExercise();
}

function focusNavNext() {
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
    clearIntervalTimer();
    advanceFocusSet();
}

function jumpFocusSet(r) {
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
    clearIntervalTimer();
    focusRoundIdx = r;
    focusSubIdx   = 0;
    syncFocusState();
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

/* ════════════════ PROGRESSION CUE ════════════════ */
function getProgressionCue(exIdx, setIdx) {
    if (currentSession < 2) return null;

    const prev1 = getPrevData(exIdx, setIdx);
    if (!prev1 || prev1.weight === '—') return null;

    const w1 = parseFloat(prev1.weight);
    if (isNaN(w1) || w1 <= 0) return null;

    // Check two sessions back for same-weight pattern
    let w2 = null;
    if (currentSession >= 3) {
        const prevKey2  = `${currentPhase}-${currentSession - 2}`;
        const prevData2 = sessionData[prevKey2];
        if (prevData2) {
            const w2val = prevData2[`${prevKey2}-${exIdx}-${setIdx}-weight`];
            if (w2val) w2 = parseFloat(w2val);
        }
    }

    if (w2 !== null && !isNaN(w2)) {
        if (Math.abs(w1 - w2) < 0.5) {
            // Same weight two sessions in a row → push harder
            return { text: `↑ Ready for ${w1 + 5} lbs`, type: 'up' };
        }
        if (w1 < w2) {
            // Weight dropped — encourage holding
            return { text: `Hold at ${w1} lbs`, type: 'hold' };
        }
        // Weight went up — keep climbing
        return { text: `↑ Try ${w1 + 2.5} lbs`, type: 'up' };
    }

    // Only one session of history
    return { text: `Try ${w1 + 2.5} lbs`, type: 'neutral' };
}

/* ════════════════ RPE ════════════════ */
function saveRPE(exIdx, setIdx, rpe) {
    const key = `${getSessionKey()}-${exIdx}-${setIdx}`;
    rpeData[key] = rpe;
    saveToStorage();
}

function setSetRPE(exIdx, setIdx, rpe) {
    saveRPE(exIdx, setIdx, rpe);
    const rpeDiv = document.getElementById(`rpe-${exIdx}-${setIdx}`);
    if (!rpeDiv) return;
    rpeDiv.querySelectorAll('.rpe-mini-btn').forEach(b => b.classList.remove('sel'));
    const btn = rpeDiv.querySelector(`.rpe-mini-btn.${rpe}`);
    if (btn) btn.classList.add('sel');
}

function setFocusRPE(rpe) {
    saveRPE(focusExIdx, focusSetIdx, rpe);
    document.querySelectorAll('.focus-rpe-btn').forEach(b => b.classList.remove('selected'));
    const btn = document.querySelector(`.focus-rpe-btn.${rpe}`);
    if (btn) btn.classList.add('selected');
}

/* ════════════════ SHARE WITH COACH ════════════════ */
function generateShareText() {
    const data  = workoutData[currentPhase];
    const stats = calcSessionStats();
    const prog  = data.progression[currentSession - 1];
    const date  = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    // Retrieve last session duration
    const lastDuration = sessionStorage.getItem('wt-last-duration');

    const totalSets = focusBlockGroups.reduce((sum, g) =>
        sum + g.exercises.reduce((s, ei) => s + getBlockSets(ei), 0), 0);

    let text = `💪 Day ${currentPhase} · Week ${currentSession} of ${data.totalSessions} — Done!\n`;
    text += `📅 ${date}`;
    if (lastDuration) text += ` · ${lastDuration}`;
    text += `\n\n`;
    text += `📊 ${totalSets} total sets\n`;

    // Block scoreboard
    focusBlockGroups.forEach(group => {
        text += `\n${group.type}\n`;
        group.exercises.forEach(exIdx => {
            const ex   = workoutData[currentPhase].exercises[exIdx];
            const sets = getBlockSets(exIdx);
            const prev = getPrevBlockSets(exIdx);
            const delta = prev !== null ? ` (${sets >= prev ? '+' : ''}${sets - prev} vs last wk)` : '';
            text += `  • ${ex.name}: ${sets} sets${delta}\n`;
        });
    });

    // RPE summary
    const sk         = getSessionKey();
    const rpeEntries = Object.entries(rpeData).filter(([k]) => k.startsWith(sk + '-'));
    if (rpeEntries.length > 0) {
        const hardCount = rpeEntries.filter(([, v]) => v === 'hard').length;
        const easyCount = rpeEntries.filter(([, v]) => v === 'easy').length;
        const parts = [];
        if (hardCount > 0) parts.push(`${hardCount} hard set${hardCount > 1 ? 's' : ''}`);
        if (easyCount > 0) parts.push(`${easyCount} easy set${easyCount > 1 ? 's' : ''}`);
        if (parts.length > 0) text += `\n💭 Feel: ${parts.join(', ')}\n`;
    }

    text += `\n📋 "${prog.note}"\n`;

    // Streak
    let streak = 0;
    const check = new Date();
    while (workoutDates.includes(localDateStr(check))) {
        streak++;
        check.setDate(check.getDate() - 1);
    }
    if (streak > 1) text += `🔥 ${streak}-day streak\n`;

    return text.trim();
}

function copyShareText() {
    const text = generateShareText();
    const btn  = document.getElementById('shareCoachBtn');

    const markCopied = () => {
        if (btn) { btn.textContent = '✓ Copied!'; btn.classList.add('copied'); }
        setTimeout(() => {
            if (btn) { btn.textContent = '📋 Share with Coach'; btn.classList.remove('copied'); }
        }, 2500);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(markCopied).catch(() => fallbackCopy(text, markCopied));
    } else {
        fallbackCopy(text, markCopied);
    }
}

function fallbackCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    cb();
}

/* ════════════════ NAVIGATION ════════════════ */
function selectPhase(phase) {
    if (!document.getElementById('focusOverlay').classList.contains('hidden')) exitFocusMode();
    currentPhase   = phase;
    currentSession = 1;
    cardCollapsed  = {};
    document.querySelectorAll('.phase-btn').forEach((btn, i) => {
        btn.classList.toggle('active', (i + 1) === phase);
    });
    updateWorkout();
}

function selectSession(session) {
    if (!document.getElementById('focusOverlay').classList.contains('hidden')) exitFocusMode();
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
        const weekLabel = s === 3 ? `Week ${s} — Deload` : `Week ${s}`;
        item.innerHTML = `
            <span class="sess-icon">${s === currentSession ? '📋' : '📄'}</span>
            <span>${weekLabel}</span>
        `;
        item.onclick = () => selectSession(s);
        nav.appendChild(item);
    }
}

function getStreakCount() {
    let streak = 0;
    const check = new Date();
    while (workoutDates.includes(localDateStr(check))) {
        streak++;
        check.setDate(check.getDate() - 1);
    }
    return streak;
}

function toggleSidebarDetails() {
    const btn  = document.getElementById('sbToggleDetails');
    const body = document.getElementById('sbCollapsible');
    if (!btn || !body) return;
    const isOpen = body.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
}

function updateSidebar() {
    const data = workoutData[currentPhase];
    const prog = data.progression[currentSession - 1];

    const noteEl = document.getElementById('sessionNote');
    if (noteEl) noteEl.textContent = `📋 ${prog.note}`;

    // Hero streak
    const streak = getStreakCount();
    const heroEl = document.getElementById('sbHeroStreak');
    if (heroEl) heroEl.textContent = streak;

    renderSessionNav();
    updateCompletionProgress();

    const prevContainer = document.getElementById('prevContent');
    if (!prevContainer) return;

    if (currentSession === 1) {
        prevContainer.innerHTML = `<p style="font-size:12px;color:var(--text-muted);font-style:italic;">First week — establish baseline</p>`;
    } else {
        const prevKey  = `${currentPhase}-${currentSession - 1}`;
        const prevData = sessionData[prevKey];
        if (!prevData || Object.keys(prevData).length === 0) {
            prevContainer.innerHTML = `<p style="font-size:12px;color:var(--text-muted);font-style:italic;">No data from previous week</p>`;
        } else {
            // EDT scoreboard: sets per block
            const groups = buildBlockGroups();
            const html = groups.map(group => {
                const setNums = group.exercises.map(exIdx => {
                    const val = parseInt(prevData[`${prevKey}-${exIdx}-block-sets`]);
                    return isNaN(val) ? '—' : String(val);
                }).join(' / ');
                return `<div class="prev-item">
                    <div class="prev-name">${group.type}</div>
                    <div class="prev-data">${setNums} sets</div>
                </div>`;
            }).join('');
            prevContainer.innerHTML = html;
        }
    }
}

/* ════════════════ MAIN RENDER ════════════════ */
function updateWorkout() {
    const data = workoutData[currentPhase];

    document.getElementById('pageTitle').textContent = data.name;
    document.getElementById('pageSubtitle').textContent = data.frequency;

    const prog = data.progression[currentSession - 1];
    document.getElementById('propSession').innerHTML =
        `<span class="prop-tag">Week ${currentSession} of ${data.totalSessions}</span>`;
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
        const isCardio = !!ex.work;
        let setRowsHtml = '';
        for (let s = 0; s < actualSets; s++) {
            const wKey      = `${sk}-${idx}-${s}-weight`;
            const rKey      = `${sk}-${idx}-${s}-reps`;
            const curData   = sessionData[sk] || {};
            const prev      = getPrevData(idx, s);
            // Show current session data as value; previous session data as placeholder
            const wVal      = curData[wKey] || '';
            const rVal      = curData[rKey] || '';
            const wPlaceholder = isCardio ? 'm' : (prev && prev.weight !== '—' ? prev.weight : 'lbs');
            const rPlaceholder = isCardio ? 'cals'   : (prev && prev.reps   !== '—' ? prev.reps   : 'reps');
            const hasRest   = ex.rest !== '—' && ex.rest !== '0';
            const setDone   = !!completedSets[`${sk}-${idx}-${s}`];
            const cue       = getProgressionCue(idx, s);
            const currentRpe = rpeData[`${sk}-${idx}-${s}`];

            const rpeSel = (rpe) => currentRpe === rpe ? ` sel ${rpe}` : '';

            setRowsHtml += `
                <tr class="set-row${setDone ? ' confirmed' : ''}" id="setrow-${idx}-${s}">
                    <td class="set-lbl">
                        ${isCardio ? `Round ${s + 1}` : `Set ${s + 1}`}
                        ${cue ? `<div class="prog-cue prog-cue-${cue.type}">${cue.text}</div>` : ''}
                    </td>
                    <td>
                        <input class="num-inp" id="winp-${idx}-${s}" type="number" placeholder="${wPlaceholder}" value="${wVal}"
                               ${isCardio ? '' : `oninput="checkPR(${idx}, this.value, 'pr-${idx}-${s}')"`}
                               onchange="updateWeight(${idx}, ${s}, this.value)">
                        ${isCardio ? '' : `<span class="pr-badge" id="pr-${idx}-${s}" style="display:none">🏆 PR</span>`}
                    </td>
                    <td><input class="num-inp" id="rinp-${idx}-${s}" type="number" placeholder="${rPlaceholder}" value="${rVal}"
                               onchange="updateReps(${idx}, ${s}, this.value)"></td>
                    <td>${hasRest ? `<button class="rest-btn" onclick="startRest('${ex.rest}')">⏱ Rest</button>` : ''}</td>
                    <td>
                        <div class="set-action-stack">
                            <button class="set-done-btn${setDone ? ' confirmed' : ''}" id="setbtn-${idx}-${s}"
                                    onclick="confirmSet(${idx}, ${s})">${setDone ? '✓ Done' : 'Done'}</button>
                            <div class="rpe-mini${setDone ? '' : ' hidden'}" id="rpe-${idx}-${s}">
                                <button class="rpe-mini-btn easy${rpeSel('easy')}" onclick="setSetRPE(${idx}, ${s}, 'easy')" title="Easy">E</button>
                                <button class="rpe-mini-btn solid${rpeSel('solid')}" onclick="setSetRPE(${idx}, ${s}, 'solid')" title="Solid">S</button>
                                <button class="rpe-mini-btn hard${rpeSel('hard')}" onclick="setSetRPE(${idx}, ${s}, 'hard')" title="Hard">H</button>
                            </div>
                        </div>
                    </td>
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
                    ${isCardio ? `
                    <div class="xprop"><span class="xprop-lbl">Rounds</span><span class="xprop-val">${actualSets}</span></div>
                    <div class="xprop"><span class="xprop-lbl">Work</span><span class="xprop-val">${ex.work}</span></div>
                    <div class="xprop"><span class="xprop-lbl">Rest</span><span class="xprop-val">${ex.rest}s</span></div>
                    ` : `
                    <div class="xprop">
                        <span class="xprop-lbl">Sets</span>
                        <span class="xprop-val">${actualSets}</span>
                        ${setsChanged ? `<span class="sets-changed">↑ from ${ex.sets}</span>` : ''}
                    </div>
                    <div class="xprop"><span class="xprop-lbl">Reps</span><span class="xprop-val">${ex.reps}</span></div>
                    <div class="xprop"><span class="xprop-lbl">Tempo</span><span class="xprop-val">${ex.tempo}</span></div>
                    <div class="xprop"><span class="xprop-lbl">Rest</span><span class="xprop-val">${ex.rest}</span></div>
                    `}
                </div>
                <div class="callout">
                    <span class="callout-ico">💡</span>
                    <span class="callout-txt">${ex.note}</span>
                </div>
                <div class="sets-lbl">${isCardio ? 'Round Tracking' : 'Set Tracking'}</div>
                <table class="sets-tbl">
                    <thead>
                        <tr>
                            <th></th>
                            <th>${isCardio ? 'Distance (m)' : 'Weight'}</th>
                            <th>${isCardio ? 'Calories' : 'Reps'}</th>
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

// Re-sync block timer on app re-entry (handles browser tab throttling on mobile)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const saved = localStorage.getItem('wt-block-timer');
    if (!saved || !blockTimerActive) return;
    const { startWall, total } = JSON.parse(saved);
    blockTimerStartWallTime = startWall;
    blockTimeLeft = Math.max(0, total - Math.floor((Date.now() - startWall) / 1000));
    if (blockTimeLeft === 0) {
        blockTimerDone();
    } else {
        updateBlockTimerDisplay();
    }
});
