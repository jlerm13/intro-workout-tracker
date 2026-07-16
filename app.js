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

// Session timer state
let sessionStartTime    = null;
let sessionTimerInterval = null;
let sessionTimerVisible  = false;  // hidden by default

/* ════════════════ LOCALSTORAGE ════════════════ */
// v2 program uses a clean 'wt2-' prefix so old-program logs (wt-*) are left
// untouched. Only workout-dates is seeded once from the old prefix so the
// streak/heatmap survives the switch.
function saveToStorage() {
    try {
        localStorage.setItem('wt2-sessionData',    JSON.stringify(sessionData));
        localStorage.setItem('wt2-completed',      JSON.stringify(completedExercises));
        localStorage.setItem('wt2-phase',          String(currentPhase));
        localStorage.setItem('wt2-session',        String(currentSession));
        localStorage.setItem('wt2-completed-sets', JSON.stringify(completedSets));
        localStorage.setItem('wt2-workout-dates',  JSON.stringify(workoutDates));
        localStorage.setItem('wt2-rpe-data',       JSON.stringify(rpeData));
    } catch (e) { /* ignore quota errors */ }
}

function loadFromStorage() {
    try {
        const sd = localStorage.getItem('wt2-sessionData');
        const ce = localStorage.getItem('wt2-completed');
        const ph = localStorage.getItem('wt2-phase');
        const se = localStorage.getItem('wt2-session');
        const cs = localStorage.getItem('wt2-completed-sets');
        const wd = localStorage.getItem('wt2-workout-dates');
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
        if (wd) {
            workoutDates = JSON.parse(wd);
        } else {
            const legacyWd = localStorage.getItem('wt-workout-dates');
            if (legacyWd) {
                try { workoutDates = JSON.parse(legacyWd); } catch (e2) {}
            }
        }
        const rd = localStorage.getItem('wt2-rpe-data');
        if (rd) rpeData = JSON.parse(rd);
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

/* ════════════════ SESSION / LETTER HELPERS ════════════════ */
// exIdx only identifies one exercise WITHIN a workout letter (A or B) — the
// same index means a different exercise depending on which letter is
// active. Every history lookup below must restrict its scan to sessions
// sharing the current letter, or it will mix Workout A and B data.
function getSessionLetter(phase, session) { return workoutData[phase].sessionsPlan[session - 1]; }
function getSessionExercises(phase, session) { return workoutData[phase].workouts[getSessionLetter(phase, session)]; }
function getCurrentExercises() { return getSessionExercises(currentPhase, currentSession); }

// Chronological list of every session in the program, in phase order.
function getAllSessionRefs() {
    const refs = [];
    Object.keys(workoutData).map(Number).sort((a, b) => a - b).forEach(p => {
        for (let s = 1; s <= workoutData[p].totalSessions; s++) {
            refs.push({ phase: p, session: s, letter: getSessionLetter(p, s), sk: `${p}-${s}` });
        }
    });
    return refs;
}

// The n-th previous session sharing the same workout letter (n=1 = most
// recent). Crosses phase-block boundaries. Returns null if none exists.
function getPrevSameLetterKey(phase, session, n) {
    n = n || 1;
    const refs = getAllSessionRefs();
    const idx = refs.findIndex(r => r.phase === phase && r.session === session);
    if (idx === -1) return null;
    const letter = refs[idx].letter;
    let count = 0;
    for (let i = idx - 1; i >= 0; i--) {
        if (refs[i].letter === letter && ++count === n) return refs[i].sk;
    }
    return null;
}

function sessionKeysForLetter(letter) {
    return getAllSessionRefs().filter(r => r.letter === letter).map(r => r.sk);
}

/* ════════════════ PERSONAL RECORD DETECTION ════════════════ */
function getExercisePR(exIdx) {
    let maxWeight = 0;
    const letter = getSessionLetter(currentPhase, currentSession);
    sessionKeysForLetter(letter).forEach(sk => {
        const data = sessionData[sk];
        if (!data) return;
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
        const ex = getCurrentExercises()[exIdx];
        if (ex.rest !== '—' && ex.rest !== '0') startRest(ex.rest);
    }
    saveToStorage();
}

/* ════════════════ HEATMAP ════════════════ */
function renderHeatmap() {
    const grid = document.getElementById('heatmapGrid');
    if (!grid) return;

    const today    = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const days = [];
    for (let i = 27; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }

    grid.innerHTML = days.map(d => {
        const isActive = workoutDates.includes(d);
        const isToday  = d === todayStr;
        return `<div class="heatmap-day${isActive ? ' active' : ''}${isToday ? ' today' : ''}" title="${d}"></div>`;
    }).join('');
}

/* ════════════════ SET PROGRESSION ════════════════ */
// Set counts are baked into each phase-block's copy of the exercise data —
// double progression (reps, then load) drives change within a block instead
// of adding sets every session.
function getActualSets(exercise) { return exercise.sets; }

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
    const ex = getCurrentExercises()[focusExIdx];
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
    const ex = getCurrentExercises()[focusExIdx];
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

    const ex = getCurrentExercises()[focusExIdx];
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
    const firstEx     = getCurrentExercises()[group.exercises[0]];
    const totalRounds = getActualSets(firstEx);

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

/* ════════════════ FOCUS MODE ════════════════ */
function buildBlockGroups() {
    const exercises = getCurrentExercises();
    const groups = [];
    let current = null;
    exercises.forEach((ex, idx) => {
        if (!current || current.type !== ex.type) {
            current = { type: ex.type, exercises: [idx] };
            groups.push(current);
        } else {
            current.exercises.push(idx);
        }
    });
    return groups;
}

function syncFocusState() {
    focusExIdx  = focusBlockGroups[focusGroupIdx].exercises[focusSubIdx];
    focusSetIdx = focusRoundIdx;
}

function enterFocusMode() {
    focusBlockGroups = buildBlockGroups();
    focusGroupIdx = 0;
    focusSubIdx   = 0;
    focusRoundIdx = 0;
    syncFocusState();
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
    clearIntervalTimer();
    document.getElementById('focusOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    startSessionTimer();
    renderFocusExercise();
}

function exitFocusMode() {
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
    clearIntervalTimer();
    stopSessionTimer();
    document.getElementById('focusOverlay').classList.add('hidden');
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
        const ex       = getCurrentExercises()[focusExIdx];
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
    const sk        = getSessionKey();
    const exercises = getCurrentExercises();
    const letter    = getSessionLetter(currentPhase, currentSession);
    const curData   = sessionData[sk] || {};

    // Count completed sets for this session
    let setsCompleted = 0;
    Object.keys(completedSets).forEach(key => {
        if (key.startsWith(sk + '-')) setsCompleted++;
    });

    // Total volume: sum weight × reps for all sets with data
    let totalVolume = 0;
    exercises.forEach((ex, exIdx) => {
        if (ex.noLog) return;
        const actualSets = getActualSets(ex);
        for (let s = 0; s < actualSets; s++) {
            const w = parseFloat(curData[`${sk}-${exIdx}-${s}-weight`]);
            const r = parseFloat(curData[`${sk}-${exIdx}-${s}-reps`]);
            if (!isNaN(w) && !isNaN(r)) totalVolume += w * r;
        }
    });

    // PRs: current session max weight > all previous SAME-LETTER sessions' max
    const prs = [];
    const letterKeys = sessionKeysForLetter(letter);
    exercises.forEach((ex, exIdx) => {
        if (ex.noLog) return;
        const actualSets = getActualSets(ex);
        let currentMax = 0;
        for (let s = 0; s < actualSets; s++) {
            const w = parseFloat(curData[`${sk}-${exIdx}-${s}-weight`]);
            if (!isNaN(w) && w > currentMax) currentMax = w;
        }
        if (currentMax <= 0) return;

        let histMax = 0;
        letterKeys.forEach(prevSk => {
            if (prevSk === sk) return;
            const prevData = sessionData[prevSk];
            if (!prevData) return;
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

function showSummary() {
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
    clearIntervalTimer();
    const sessionElapsed = stopSessionTimer();
    document.getElementById('focusOverlay').classList.add('hidden');
    document.body.style.overflow = '';
    updateWorkout();

    const data           = workoutData[currentPhase];
    const isLastSession  = currentSession >= data.totalSessions;
    const maxPhase       = Math.max(...Object.keys(workoutData).map(Number));
    const isLastPhase    = currentPhase >= maxPhase;
    const stats          = calcSessionStats();

    document.getElementById('summaryPhaseSession').textContent =
        `Phase ${currentPhase} · Session ${currentSession} of ${data.totalSessions}`;

    const durationText = sessionElapsed > 0 ? formatSessionDuration(sessionElapsed) : '—';
    document.getElementById('summaryDuration').textContent = durationText;
    if (sessionElapsed > 0) {
        try { sessionStorage.setItem('wt-last-duration', durationText); } catch (e) {}
    }
    document.getElementById('summarySets').textContent   = stats.setsCompleted;
    document.getElementById('summaryVolume').textContent =
        stats.totalVolume > 0 ? stats.totalVolume.toLocaleString() + ' lbs' : '—';
    document.getElementById('summaryPRCount').textContent = stats.prs.length;

    // PRs section
    const prSection = document.getElementById('summaryPRSection');
    if (stats.prs.length > 0) {
        document.getElementById('summaryPRList').innerHTML =
            stats.prs.map(p => `<div class="summary-pr-item">🏆 ${p.name} — ${p.weight} lbs</div>`).join('');
        prSection.style.display = '';
    } else {
        prSection.style.display = 'none';
    }

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
        document.getElementById('summaryTitle').textContent  = 'Phase Complete!';
        ctaBtn.textContent = `Start Phase ${currentPhase + 1} →`;
        ctaBtn.className   = 'summary-cta-btn';
        ctaBtn.onclick     = () => { hideSummary(); selectPhase(currentPhase + 1); };
    } else {
        document.getElementById('summaryEmoji').textContent  = '🎉';
        document.getElementById('summaryTitle').textContent  = 'Session Complete!';
        ctaBtn.textContent = `Continue to Session ${currentSession + 1} →`;
        ctaBtn.className   = 'summary-cta-btn';
        ctaBtn.onclick     = () => { hideSummary(); selectSession(currentSession + 1); };
    }

    document.getElementById('summaryOverlay').classList.remove('hidden');
}

function hideSummary() {
    document.getElementById('summaryOverlay').classList.add('hidden');
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
    const exercises   = getCurrentExercises();
    const group       = focusBlockGroups[focusGroupIdx];
    const isSuperset  = group.exercises.length > 1;
    const firstEx     = exercises[group.exercises[0]];
    const totalRounds = getActualSets(firstEx);
    let nextEx = null, nextLabel = 'Up Next', nextPrev = null;

    if (isSuperset && focusSubIdx < group.exercises.length - 1) {
        // Next exercise in superset pair
        const nextExIdx = group.exercises[focusSubIdx + 1];
        nextEx    = exercises[nextExIdx];
        nextLabel = 'Up Next';
        nextPrev  = getPrevData(nextExIdx, focusRoundIdx);
    } else if (focusRoundIdx < totalRounds - 1) {
        // More rounds — show what's coming (first exercise in next round)
        const nextExIdx = group.exercises[0];
        nextEx    = exercises[nextExIdx];
        nextLabel = `Next: Round ${focusRoundIdx + 2} of ${totalRounds}`;
        nextPrev  = getPrevData(nextExIdx, focusRoundIdx + 1);
    } else if (focusGroupIdx < focusBlockGroups.length - 1) {
        // Next block
        const nextGroup = focusBlockGroups[focusGroupIdx + 1];
        const nextExIdx = nextGroup.exercises[0];
        nextEx    = exercises[nextExIdx];
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
    el.innerHTML = focusBlockGroups.map((g, i) => {
        const label = g.type.replace('Block ', '').replace('Warm-Up', 'WU');
        const cls   = i < focusGroupIdx ? 'bp-done' : i === focusGroupIdx ? 'bp-current' : '';
        return `<div class="bp-node ${cls}">${label}</div>`;
    }).join('');
}

function renderFocusExercise(skipAutoStart) {
    // Switch to exercise screen
    document.getElementById('focusScreenExercise').classList.remove('hidden');
    document.getElementById('focusScreenRest').classList.add('hidden');
    const workScreen = document.getElementById('focusScreenWork');
    if (workScreen) workScreen.classList.add('hidden');

    const data        = workoutData[currentPhase];
    const exercises   = getCurrentExercises();
    const group       = focusBlockGroups[focusGroupIdx];
    const isSuperset  = group.exercises.length > 1;
    const ex          = exercises[focusExIdx];
    const firstEx     = exercises[group.exercises[0]];
    const totalRounds = getActualSets(firstEx);
    const rirText     = (data.progression[currentSession - 1] || {}).rir || '';
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
    if (ex.noLog) {
        document.getElementById('focusSetCounter').textContent = ex.reps && ex.reps !== '—' ? ex.reps : '';
    } else if (isSuperset) {
        document.getElementById('focusSetCounter').textContent =
            `Exercise ${focusSubIdx + 1} of ${group.exercises.length} · Round ${focusRoundIdx + 1} · ${ex.reps} reps` +
            (rirText ? ` · ${rirText}` : '');
    } else {
        document.getElementById('focusSetCounter').textContent =
            (focusIsCardio
                ? `Round ${focusSetIdx + 1} of ${totalRounds}`
                : `Set ${focusSetIdx + 1} of ${totalRounds} · ${ex.reps} reps`) +
            (rirText ? ` · ${rirText}` : '');
    }

    // Show note, cue, and previous data as separate lines
    const noteEl = document.getElementById('focusNote');
    const noteLines = [];
    if (ex.note) noteLines.push(ex.note);
    if (ex.cue) noteLines.push(ex.cue);
    // Fold "First time" / "Last time" into the note block
    if (ex.noLog) {
        // Warm-up / conditioning cards carry no set history
    } else if (prev && prev.weight !== '—') {
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
    focusInputs.classList.toggle('hidden', !!ex.noLog);
    const doneBtnEl = document.getElementById('focusDoneBtn');
    if (doneBtnEl) doneBtnEl.textContent = ex.noLog ? '✓ Mark Done' : '✓ Done';
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

    weightInp.value = savedW;
    repsInp.value   = savedR;

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
    const exercises   = getCurrentExercises();
    const ex          = exercises[focusExIdx];
    const group       = focusBlockGroups[focusGroupIdx];
    const firstEx     = exercises[group.exercises[0]];
    const totalRounds = getActualSets(firstEx);
    const isSuperset  = group.exercises.length > 1;
    const sk          = getSessionKey();
    const wVal        = document.getElementById('focusWeight').value;
    const rVal        = document.getElementById('focusReps').value;

    if (!sessionData[sk]) sessionData[sk] = {};
    if (wVal) sessionData[sk][`${sk}-${focusExIdx}-${focusSetIdx}-weight`] = wVal;
    if (rVal) sessionData[sk][`${sk}-${focusExIdx}-${focusSetIdx}-reps`]   = rVal;

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

    // Only show RPE on the final set of the current exercise (never for noLog cards)
    const sk = getSessionKey();
    const group       = focusBlockGroups[focusGroupIdx];
    const firstEx     = getCurrentExercises()[group.exercises[0]];
    const totalRounds = getActualSets(firstEx);
    const isLastSet   = focusRoundIdx === totalRounds - 1;
    const rpeEl       = document.getElementById('focusRPE');
    if (rpeEl) rpeEl.style.display = (isLastSet && !firstEx.noLog) ? '' : 'none';

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
            const ex = getCurrentExercises()[focusExIdx];
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
    const ex = getCurrentExercises()[focusExIdx];
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
    const firstEx     = getCurrentExercises()[group.exercises[0]];
    const totalRounds = getActualSets(firstEx);

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
            const pfe     = getCurrentExercises()[pg.exercises[0]];
            focusRoundIdx = getActualSets(pfe) - 1;
        }
    } else {
        if (focusRoundIdx > 0) {
            focusRoundIdx--;
        } else if (focusGroupIdx > 0) {
            focusGroupIdx--;
            const pg = focusBlockGroups[focusGroupIdx];
            focusSubIdx   = pg.exercises.length - 1;
            const pfe     = getCurrentExercises()[pg.exercises[0]];
            focusRoundIdx = getActualSets(pfe) - 1;
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
                  'Block C': 'tag-c', 'Block D': 'tag-d', 'Block E': 'tag-e',
                  'Block F': 'tag-f', 'Conditioning': 'tag-cond' };
    return map[type] || 'tag-e';
}

function getPrevData(exIdx, setIdx) {
    const prevKey = getPrevSameLetterKey(currentPhase, currentSession, 1);
    if (!prevKey) return null;
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

/* ════════════════ PROGRESSION CUE (double progression) ════════════════ */
// Parses a rep-range string ("6-10", "10/side", "12-15/side") into [lo, hi].
function parseRepRange(reps) {
    if (!reps) return null;
    const m = reps.match(/(\d+)(?:-(\d+))?/);
    if (!m) return null;
    const lo = parseInt(m[1]);
    const hi = m[2] ? parseInt(m[2]) : lo;
    return [lo, hi];
}

function getProgressionCue(exIdx, setIdx) {
    const prevKey = getPrevSameLetterKey(currentPhase, currentSession, 1);
    if (!prevKey) return null;
    const prevData = sessionData[prevKey];
    if (!prevData) return null;

    const w1 = parseFloat(prevData[`${prevKey}-${exIdx}-${setIdx}-weight`]);
    const r1 = parseInt(prevData[`${prevKey}-${exIdx}-${setIdx}-reps`]);
    if (isNaN(w1) || w1 <= 0) return null;

    const ex    = getCurrentExercises()[exIdx];
    const range = ex ? parseRepRange(ex.reps) : null;

    // Hit the top of the rep range last time → add load, drop back to the bottom
    if (range && !isNaN(r1) && r1 >= range[1]) {
        const newW = Math.round(w1 * 1.0375 * 2) / 2; // ~2.5-5% bump, rounded to nearest 0.5 lb
        return { text: `↑ Try ${newW} lbs × ${range[0]}`, type: 'up' };
    }
    // Otherwise: same weight, one more rep
    if (!isNaN(r1)) {
        return { text: `Try ${w1} lbs × ${r1 + 1}`, type: 'neutral' };
    }
    return { text: `Try ${w1} lbs`, type: 'neutral' };
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
    const data   = workoutData[currentPhase];
    const stats  = calcSessionStats();
    const prog   = data.progression[currentSession - 1];
    const letter = getSessionLetter(currentPhase, currentSession);
    const date   = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    // Retrieve last session duration
    const lastDuration = sessionStorage.getItem('wt-last-duration');

    let text = `💪 ${data.name} · Workout ${letter} · Session ${currentSession} of ${data.totalSessions} — Done!\n`;
    text += `📅 ${date}`;
    if (lastDuration) text += ` · ${lastDuration}`;
    if (prog.rir) text += ` · ${prog.rir}`;
    text += `\n\n`;
    text += `📊 ${stats.setsCompleted} sets`;
    if (stats.totalVolume > 0) text += ` · ${stats.totalVolume.toLocaleString()} lbs volume`;
    text += ` · ${stats.prs.length} PR${stats.prs.length !== 1 ? 's' : ''}\n`;

    if (stats.prs.length > 0) {
        text += `\n🏆 PRs\n`;
        stats.prs.forEach(p => { text += `  • ${p.name} — ${p.weight} lbs\n`; });
    }

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
    while (workoutDates.includes(check.toISOString().split('T')[0])) {
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
    const exercises = getCurrentExercises();
    const total = exercises.length;
    let done = 0;
    exercises.forEach((_, i) => {
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
        const letter = getSessionLetter(currentPhase, s);
        const item = document.createElement('div');
        item.className = `sess-item${s === currentSession ? ' active' : ''}`;
        item.innerHTML = `
            <span class="sess-icon">${s === currentSession ? '📋' : '📄'}</span>
            <span>Session ${s} · ${letter}</span>
        `;
        item.onclick = () => selectSession(s);
        nav.appendChild(item);
    }
}

function getStreakCount() {
    let streak = 0;
    const check = new Date();
    while (workoutDates.includes(check.toISOString().split('T')[0])) {
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
    const data   = workoutData[currentPhase];
    const prog   = data.progression[currentSession - 1];
    const letter = getSessionLetter(currentPhase, currentSession);

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

    const prevKey = getPrevSameLetterKey(currentPhase, currentSession, 1);
    if (!prevKey) {
        prevContainer.innerHTML = `<p style="font-size:12px;color:var(--text-muted);font-style:italic;">First Workout ${letter} — establish baseline</p>`;
    } else {
        const prevData = sessionData[prevKey];
        let html = '';
        const exercises = getCurrentExercises();
        if (prevData && Object.keys(prevData).length > 0) {
            exercises.slice(0, 5).forEach((ex, idx) => {
                if (ex.noLog) return;
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
            `<p style="font-size:12px;color:var(--text-muted);font-style:italic;">No data from last Workout ${letter}</p>`;
    }
}

/* ════════════════ JOURNEY NARRATIVE ════════════════ */
function generateJourneyNarrative() {
    const sk = getSessionKey();
    const candidates = [];
    const letter = getSessionLetter(currentPhase, currentSession);

    // Priority 1: PR hit in the last same-letter session
    const prevSk = getPrevSameLetterKey(currentPhase, currentSession, 1);
    if (prevSk) {
        const prevData = sessionData[prevSk];
        if (prevData) {
            const [pp, ps] = prevSk.split('-').map(Number);
            const exercises = getSessionExercises(pp, ps);
            const letterKeys = sessionKeysForLetter(letter);
            exercises.forEach((ex, exIdx) => {
                if (ex.noLog) return;
                let prevMax = 0;
                Object.keys(prevData).forEach(key => {
                    if (key.startsWith(`${prevSk}-${exIdx}-`) && key.endsWith('-weight')) {
                        const w = parseFloat(prevData[key]);
                        if (!isNaN(w) && w > prevMax) prevMax = w;
                    }
                });
                if (prevMax <= 0) return;

                // Check all earlier same-letter sessions
                let histMax = 0;
                letterKeys.forEach(s => {
                    if (s === prevSk) return;
                    const d = sessionData[s];
                    if (!d) return;
                    Object.keys(d).forEach(key => {
                        if (key.startsWith(`${s}-${exIdx}-`) && key.endsWith('-weight')) {
                            const w = parseFloat(d[key]);
                            if (!isNaN(w) && w > histMax) histMax = w;
                        }
                    });
                });

                if (prevMax > histMax && histMax > 0) {
                    candidates.push({
                        priority: 1,
                        text: `You set a PR on ${ex.name} at ${prevMax} lbs — up from ${histMax} lbs.`,
                        icon: '🏆',
                        isPR: true
                    });
                }
            });
        }
    }

    // Priority 2: Volume milestone
    const totalVolume = getTotalVolumeForPhase(currentPhase);
    const milestones = [25000, 10000, 5000];
    for (const m of milestones) {
        if (totalVolume >= m) {
            candidates.push({
                priority: 2,
                text: `You've moved over ${m.toLocaleString()} lbs this phase.`,
                icon: '📊'
            });
            break;
        }
    }

    // Priority 3: Streak
    const streak = getStreakCount();
    if (streak >= 3) {
        candidates.push({
            priority: 3,
            text: `${streak} days in a row. Consistency is the real superpower.`,
            icon: '🔥'
        });
    }

    // Priority 4: Session count milestone
    let totalSessions = 0;
    Object.keys(sessionData).forEach(sk => { if (Object.keys(sessionData[sk]).length > 0) totalSessions++; });
    const sessionMilestones = [15, 10, 5];
    for (const m of sessionMilestones) {
        if (totalSessions >= m) {
            const totalProgramSessions = Object.keys(workoutData).reduce((sum, p) => sum + workoutData[p].totalSessions, 0);
            candidates.push({
                priority: 4,
                text: `This is session ${totalSessions}+. ${totalSessions >= totalProgramSessions / 2 ? 'Past the halfway mark.' : 'Building momentum.'}`,
                icon: '💪'
            });
            break;
        }
    }

    // Priority 5: Phase transition
    if (currentSession === 1 && currentPhase > 1) {
        const isDeload = currentPhase === Math.max(...Object.keys(workoutData).map(Number));
        candidates.push({
            priority: 5,
            text: `Welcome to ${workoutData[currentPhase].name}. ${isDeload ? 'Ease off and let your body catch up.' : 'Time to push a little harder.'}`,
            icon: '⚡'
        });
    }

    // Priority 6: Weight increase streak
    if (currentSession >= 1) {
        const exercises = getCurrentExercises();
        exercises.forEach((ex, exIdx) => {
            if (ex.noLog) return;
            const increases = getConsecutiveWeightIncreases(currentPhase, exIdx);
            if (increases >= 3) {
                candidates.push({
                    priority: 6,
                    text: `${ex.name} has climbed for ${increases} sessions straight.`,
                    icon: '📈'
                });
            }
        });
    }

    // Priority 7: Inactivity
    if (workoutDates.length > 0) {
        const lastDate = new Date(workoutDates[workoutDates.length - 1]);
        const daysSince = Math.floor((new Date() - lastDate) / 86400000);
        if (daysSince >= 3) {
            candidates.push({
                priority: 7,
                text: `Pick up where you left off — last session was ${daysSince} days ago.`,
                icon: '👋'
            });
        }
    }

    // Priority 8: Default first session
    if (candidates.length === 0) {
        if (totalSessions === 0 || (currentPhase === 1 && currentSession === 1 && !sessionData['1-1'])) {
            candidates.push({
                priority: 8,
                text: "Session 1. Let's see what you're working with.",
                icon: '🎯'
            });
        }
    }

    if (candidates.length === 0) return null;

    // Pick highest priority (lowest number)
    candidates.sort((a, b) => a.priority - b.priority);

    // Avoid repeating same narrative within browser session
    const hash = candidates[0].text.length + candidates[0].priority;
    const lastHash = sessionStorage.getItem('wt-narrative-hash');
    if (lastHash === String(hash) && candidates.length > 1) {
        return candidates[1];
    }
    try { sessionStorage.setItem('wt-narrative-hash', String(hash)); } catch (e) {}
    return candidates[0];
}

function getTotalVolumeForPhase(phase) {
    let total = 0;
    const data = workoutData[phase];
    for (let s = 1; s <= data.totalSessions; s++) {
        const sk = `${phase}-${s}`;
        const d = sessionData[sk];
        if (!d) continue;
        const exercises = getSessionExercises(phase, s);
        exercises.forEach((ex, exIdx) => {
            if (ex.noLog) return;
            const sets = getActualSets(ex);
            for (let si = 0; si < sets; si++) {
                const w = parseFloat(d[`${sk}-${exIdx}-${si}-weight`]);
                const r = parseFloat(d[`${sk}-${exIdx}-${si}-reps`]);
                if (!isNaN(w) && !isNaN(r)) total += w * r;
            }
        });
    }
    return total;
}

// Walks backward through the same-letter session chain (crosses phase-block
// boundaries) counting consecutive sessions where this exercise's max weight rose.
function getConsecutiveWeightIncreases(phase, exIdx) {
    const letter = getSessionLetter(phase, currentSession);
    const keys   = sessionKeysForLetter(letter);
    const idx    = keys.indexOf(`${phase}-${currentSession}`);
    if (idx <= 0) return 0;

    let count = 0;
    for (let i = idx; i > 0; i--) {
        const sk = keys[i], prevSk = keys[i - 1];
        const d = sessionData[sk];
        const pd = sessionData[prevSk];
        if (!d || !pd) break;

        let maxCur = 0, maxPrev = 0;
        Object.keys(d).forEach(k => {
            if (k.startsWith(`${sk}-${exIdx}-`) && k.endsWith('-weight')) {
                const w = parseFloat(d[k]);
                if (!isNaN(w) && w > maxCur) maxCur = w;
            }
        });
        Object.keys(pd).forEach(k => {
            if (k.startsWith(`${prevSk}-${exIdx}-`) && k.endsWith('-weight')) {
                const w = parseFloat(pd[k]);
                if (!isNaN(w) && w > maxPrev) maxPrev = w;
            }
        });

        if (maxCur > maxPrev && maxPrev > 0) {
            count++;
        } else {
            break;
        }
    }
    return count;
}

function renderJourneyNarrative() {
    const el = document.getElementById('journeyNarrative');
    if (!el) return;
    const narrative = generateJourneyNarrative();
    if (!narrative) { el.classList.add('hidden'); return; }

    el.classList.remove('hidden');
    el.className = 'journey-narrative' + (narrative.isPR ? ' journey-pr' : '');
    document.getElementById('journeyIcon').textContent = narrative.icon;
    document.getElementById('journeyText').textContent = narrative.text;
}

/* ════════════════ SMART SHARE (Auto-Share to Coach) ════════════════ */
function showToast(message, duration) {
    duration = duration || 2500;
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.animationDuration = `${duration}ms`;
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, duration);
}

function getCoachContact() {
    try {
        const stored = localStorage.getItem('wt-coach-contact');
        return stored ? JSON.parse(stored) : null;
    } catch (e) { return null; }
}

function saveCoachContact() {
    const type = document.getElementById('coachType').value;
    const value = document.getElementById('coachValue').value.trim();

    if (type === 'none') {
        localStorage.removeItem('wt-coach-contact');
        showToast('Clipboard mode saved');
    } else if (value) {
        localStorage.setItem('wt-coach-contact', JSON.stringify({ type, value }));
        showToast('Coach contact saved');
    } else {
        showToast('Enter a phone or email');
        return;
    }
    const setup = document.getElementById('coachSetup');
    if (setup) setup.classList.add('hidden');
}

function showCoachSetup() {
    const setup = document.getElementById('coachSetup');
    if (!setup) return;
    const contact = getCoachContact();
    if (contact) {
        document.getElementById('coachType').value = contact.type;
        document.getElementById('coachValue').value = contact.value;
    }
    setup.classList.remove('hidden');
}

function smartShare() {
    const text = generateShareText();
    const contact = getCoachContact();

    // Try Web Share API first (mobile)
    if (navigator.share) {
        navigator.share({ text: text }).then(() => {
            showToast('Shared!');
        }).catch(() => {
            // User cancelled or error — fall through to clipboard
            clipboardShare(text);
        });
        return;
    }

    // Stored contact — direct link
    if (contact) {
        if (contact.type === 'whatsapp') {
            const phone = contact.value.replace(/\D/g, '');
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
            showToast('Opening WhatsApp');
            return;
        }
        if (contact.type === 'email') {
            window.open(`mailto:${contact.value}?subject=${encodeURIComponent('Workout Complete!')}&body=${encodeURIComponent(text)}`, '_blank');
            showToast('Opening email');
            return;
        }
    }

    // Clipboard fallback
    clipboardShare(text);

    // Show coach setup if no contact stored
    if (!contact) {
        showCoachSetup();
    }
}

function clipboardShare(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!')).catch(() => {
            fallbackCopy(text, () => showToast('Copied to clipboard!'));
        });
    } else {
        fallbackCopy(text, () => showToast('Copied to clipboard!'));
    }
}

/* ════════════════ PROGRESS CHARTS ════════════════ */
// History across same-letter sessions only (crosses phase-block boundaries).
// `session` in the returned points is the letter ordinal (1st A, 2nd A, ...).
function getExerciseWeightHistory(letter, exIdx) {
    const keys = sessionKeysForLetter(letter);
    const points = [];
    keys.forEach((sk, i) => {
        const d = sessionData[sk];
        if (!d) return;
        const [p, s] = sk.split('-').map(Number);
        const ex = workoutData[p].workouts[letter][exIdx];
        let maxWeight = 0;
        const sets = getActualSets(ex);
        for (let si = 0; si < sets; si++) {
            const w = parseFloat(d[`${sk}-${exIdx}-${si}-weight`]);
            if (!isNaN(w) && w > maxWeight) maxWeight = w;
        }
        if (maxWeight > 0) {
            points.push({ session: i + 1, value: maxWeight });
        }
    });
    return points;
}

function getVolumeHistory() {
    const points = [];
    let sessionCount = 0;
    const phases = Object.keys(workoutData).map(Number).sort((a, b) => a - b);
    phases.forEach(phase => {
        const data = workoutData[phase];
        for (let s = 1; s <= data.totalSessions; s++) {
            const sk = `${phase}-${s}`;
            const d = sessionData[sk];
            if (!d || Object.keys(d).length === 0) continue;
            const exercises = getSessionExercises(phase, s);
            let vol = 0;
            exercises.forEach((ex, exIdx) => {
                if (ex.noLog) return;
                const sets = getActualSets(ex);
                for (let si = 0; si < sets; si++) {
                    const w = parseFloat(d[`${sk}-${exIdx}-${si}-weight`]);
                    const r = parseFloat(d[`${sk}-${exIdx}-${si}-reps`]);
                    if (!isNaN(w) && !isNaN(r)) vol += w * r;
                }
            });
            if (vol > 0) {
                sessionCount++;
                points.push({ session: sessionCount, label: `P${phase}S${s}`, value: vol });
            }
        }
    });
    return points;
}

function renderSVGLineChart(containerId, seriesData, options) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const W = 800, H = 240;
    const pad = { top: 20, right: 20, bottom: 30, left: 50 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    // Find global min/max
    let allPoints = [];
    seriesData.forEach(s => allPoints.push(...s.points));
    if (allPoints.length === 0) { container.innerHTML = ''; return; }

    const xMin = Math.min(...allPoints.map(p => p.x));
    const xMax = Math.max(...allPoints.map(p => p.x));
    const yMin = 0;
    const yMax = Math.max(...allPoints.map(p => p.y)) * 1.1 || 1;

    const xScale = xMax > xMin ? chartW / (xMax - xMin) : chartW;
    const yScale = chartH / (yMax - yMin);

    const toX = v => pad.left + (v - xMin) * xScale;
    const toY = v => pad.top + chartH - (v - yMin) * yScale;

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="font-family:inherit">`;

    // Grid lines
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
        const val = yMin + (yMax - yMin) * (i / yTicks);
        const y = toY(val);
        svg += `<line x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
        svg += `<text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--text-muted)" font-size="10">${options.formatY ? options.formatY(val) : Math.round(val)}</text>`;
    }

    // X axis labels
    const xLabels = options.xLabels || [];
    xLabels.forEach(l => {
        svg += `<text x="${toX(l.x)}" y="${H - 5}" text-anchor="middle" fill="var(--text-muted)" font-size="10">${l.label}</text>`;
    });

    // Lines + dots
    seriesData.forEach(series => {
        if (series.points.length < 2) {
            // Single point — just draw dot
            if (series.points.length === 1) {
                const p = series.points[0];
                svg += `<circle cx="${toX(p.x)}" cy="${toY(p.y)}" r="5" fill="${series.color}"/>`;
            }
            return;
        }
        const pathData = series.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`).join(' ');
        svg += `<polyline points="" fill="none" stroke="${series.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="${pathData}"/>`;
        series.points.forEach(p => {
            svg += `<circle cx="${toX(p.x).toFixed(1)}" cy="${toY(p.y).toFixed(1)}" r="4" fill="${series.color}" stroke="var(--background)" stroke-width="2"/>`;
        });
    });

    svg += '</svg>';

    // Legend
    let legend = '';
    if (seriesData.length > 1) {
        legend = '<div class="chart-legend">';
        seriesData.forEach(s => {
            if (s.points.length > 0) {
                legend += `<div class="chart-legend-item"><div class="chart-legend-dot" style="background:${s.color}"></div>${s.label}</div>`;
            }
        });
        legend += '</div>';
    }

    container.innerHTML = svg + legend;
}

const chartColors = ['#2383e2', '#7c3aed', '#059669', '#d97706', '#e11d48', '#0891b2', '#4f46e5', '#dc2626', '#0d9488', '#c026d3', '#ea580c'];

function renderProgressCharts() {
    const section = document.getElementById('chartSection');
    if (!section) return;

    const letter = getSessionLetter(currentPhase, currentSession);
    const letterKeys = sessionKeysForLetter(letter);

    // Check if we have 2+ same-letter sessions with data
    let sessionsWithData = 0;
    letterKeys.forEach(sk => {
        if (sessionData[sk] && Object.keys(sessionData[sk]).length > 0) sessionsWithData++;
    });

    if (sessionsWithData < 2) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');

    // Weight chart: per-exercise lines, across all same-letter sessions
    const exercises = getCurrentExercises();
    const weightSeries = [];
    exercises.forEach((ex, exIdx) => {
        if (ex.noLog) return;
        const history = getExerciseWeightHistory(letter, exIdx);
        if (history.length > 0) {
            weightSeries.push({
                label: ex.name,
                color: chartColors[exIdx % chartColors.length],
                points: history.map(h => ({ x: h.session, y: h.value }))
            });
        }
    });

    const xLabels = letterKeys.map((sk, i) => ({ x: i + 1, label: `${letter}${i + 1}` }));

    renderSVGLineChart('chartWeightContainer', weightSeries, {
        xLabels,
        formatY: v => v + ' lbs'
    });

    // Volume chart: aggregate across all phases
    const volHistory = getVolumeHistory();
    if (volHistory.length >= 2) {
        const volSeries = [{
            label: 'Total Volume',
            color: '#2383e2',
            points: volHistory.map(h => ({ x: h.session, y: h.value }))
        }];
        const volLabels = volHistory.map(h => ({ x: h.session, label: h.label }));
        renderSVGLineChart('chartVolumeContainer', volSeries, {
            xLabels: volLabels,
            formatY: v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v)
        });
    }
}

function showChartTab(tab) {
    const weightC = document.getElementById('chartWeightContainer');
    const volumeC = document.getElementById('chartVolumeContainer');
    const tabs = document.querySelectorAll('.chart-tab');

    if (tab === 'weight') {
        weightC.classList.remove('hidden');
        volumeC.classList.add('hidden');
    } else {
        weightC.classList.add('hidden');
        volumeC.classList.remove('hidden');
    }

    tabs.forEach(t => t.classList.toggle('active', t.textContent.toLowerCase() === tab));
}

/* ════════════════ MAIN RENDER ════════════════ */
function updateWorkout() {
    const data   = workoutData[currentPhase];
    const letter = getSessionLetter(currentPhase, currentSession);

    document.getElementById('pageTitle').innerHTML =
        data.name + ' <span style="font-size:13px;color:var(--text-muted);font-weight:400;">v5</span>';
    document.getElementById('pageSubtitle').textContent = data.frequency;

    const prog = data.progression[currentSession - 1];
    document.getElementById('propSession').innerHTML =
        `<span class="prop-tag">Session ${currentSession} of ${data.totalSessions} · Workout ${letter}</span>`;
    document.getElementById('propFocus').textContent = prog.note;
    const rirEl = document.getElementById('propRIR');
    if (rirEl) rirEl.innerHTML = prog.rir ? `<span class="rir-pill">🔋 ${prog.rir}</span>` : '';

    const list = document.getElementById('exerciseList');
    list.innerHTML = '';

    let lastType = null;
    const exercises = getCurrentExercises();

    exercises.forEach((ex, idx) => {
        const sk       = getSessionKey();
        const isDone   = !!completedExercises[getExerciseKey(idx)];
        const isOpen   = !cardCollapsed[idx];
        const videoUrl = exerciseVideos[ex.name];
        const actualSets = getActualSets(ex);

        // Section heading on block type change
        if (ex.type !== lastType) {
            const heading = document.createElement('div');
            heading.className   = 'blk-heading';
            heading.textContent = ex.type;
            list.appendChild(heading);
            lastType = ex.type;
        }

        const block = document.createElement('div');
        block.className = 'ex-block';
        block.id        = `block-${idx}`;
        if (isDone) block.style.opacity = '0.65';

        if (ex.noLog) {
            // Warm-up / conditioning card: no set tracking, just a single check-off
            const setDone = !!completedSets[`${sk}-${idx}-0`];
            block.innerHTML = `
                <div class="ex-row">
                    <div class="ex-toggle${isOpen ? ' open' : ''}" id="toggle-${idx}" onclick="toggleCard(${idx})">
                        <span class="arr">▶</span>
                    </div>
                    <div class="ex-title">
                        <span class="ex-name${isDone ? ' done' : ''}" id="name-${idx}">${ex.name}</span>
                        <span class="ex-tag ${getTagClass(ex.type)}">${ex.type}</span>
                    </div>
                    <div class="ex-actions"></div>
                </div>
                <div class="ex-body${isOpen ? '' : ' hidden'}" id="body-${idx}">
                    <div class="callout">
                        <span class="callout-ico">💡</span>
                        <span class="callout-txt">${ex.note}</span>
                    </div>
                    <button class="set-done-btn nolog-done-btn${setDone ? ' confirmed' : ''}" id="setbtn-${idx}-0"
                            onclick="confirmSet(${idx}, 0)">${setDone ? '✓ Done' : 'Mark Done'}</button>
                </div>`;
            list.appendChild(block);
            return;
        }

        // Build set rows
        let setRowsHtml = '';
        for (let s = 0; s < actualSets; s++) {
            const wKey      = `${sk}-${idx}-${s}-weight`;
            const rKey      = `${sk}-${idx}-${s}-reps`;
            const curData   = sessionData[sk] || {};
            const prev      = getPrevData(idx, s);
            // Show current session data as value; previous session data as placeholder
            const wVal      = curData[wKey] || '';
            const rVal      = curData[rKey] || '';
            const wPlaceholder = prev && prev.weight !== '—' ? prev.weight : 'lbs';
            const rPlaceholder = prev && prev.reps   !== '—' ? prev.reps   : 'reps';
            const hasRest   = ex.rest !== '—' && ex.rest !== '0';
            const setDone   = !!completedSets[`${sk}-${idx}-${s}`];
            const cue       = getProgressionCue(idx, s);
            const currentRpe = rpeData[`${sk}-${idx}-${s}`];

            const rpeSel = (rpe) => currentRpe === rpe ? ` sel ${rpe}` : '';

            setRowsHtml += `
                <tr class="set-row${setDone ? ' confirmed' : ''}" id="setrow-${idx}-${s}">
                    <td class="set-lbl">
                        Set ${s + 1}
                        ${cue ? `<div class="prog-cue prog-cue-${cue.type}">${cue.text}</div>` : ''}
                    </td>
                    <td>
                        <input class="num-inp" id="winp-${idx}-${s}" type="number" placeholder="${wPlaceholder}" value="${wVal}"
                               oninput="checkPR(${idx}, this.value, 'pr-${idx}-${s}')"
                               onchange="updateWeight(${idx}, ${s}, this.value)">
                        <span class="pr-badge" id="pr-${idx}-${s}" style="display:none">🏆 PR</span>
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
                    <div class="xprop"><span class="xprop-lbl">Sets</span><span class="xprop-val">${actualSets}</span></div>
                    <div class="xprop"><span class="xprop-lbl">Reps</span><span class="xprop-val">${ex.reps}</span></div>
                    <div class="xprop"><span class="xprop-lbl">Cue</span><span class="xprop-val">${ex.cue || '—'}</span></div>
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
    renderJourneyNarrative();
    renderProgressCharts();
    saveToStorage();
}

/* ════════════════ BODY COMP TRACKING ════════════════ */
let bodyweightData = {}; // { 'YYYY-MM-DD': lbs }
let waistData       = {}; // { 'YYYY-MM-DD': inches }

function todayISO() { return new Date().toISOString().split('T')[0]; }

function loadBodyComp() {
    try {
        const bw = localStorage.getItem('wt2-bodyweight');
        const ws = localStorage.getItem('wt2-waist');
        if (bw) bodyweightData = JSON.parse(bw);
        if (ws) waistData = JSON.parse(ws);
    } catch (e) { /* ignore parse errors */ }
}

function saveBodyCompStorage() {
    try {
        localStorage.setItem('wt2-bodyweight', JSON.stringify(bodyweightData));
        localStorage.setItem('wt2-waist', JSON.stringify(waistData));
    } catch (e) { /* ignore quota errors */ }
}

// Average of dataObj's values over the `days` calendar days ending on endDateStr.
function rollingAvg(dataObj, endDateStr, days) {
    const end = new Date(endDateStr);
    let sum = 0, count = 0;
    for (let i = 0; i < days; i++) {
        const d = new Date(end);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        if (dataObj[key] != null) { sum += dataObj[key]; count++; }
    }
    return count > 0 ? sum / count : null;
}

function saveBodyweight() {
    const dateInp = document.getElementById('bwDate');
    const valInp  = document.getElementById('bwInput');
    const date = (dateInp && dateInp.value) || todayISO();
    const val  = parseFloat(valInp.value);
    if (isNaN(val) || val <= 0) return;
    bodyweightData[date] = val;
    saveBodyCompStorage();
    valInp.value = '';
    renderBodyComp();
    showToast('Weight saved');
}

function saveWaist() {
    const dateInp = document.getElementById('waistDate');
    const valInp  = document.getElementById('waistInput');
    const date = (dateInp && dateInp.value) || todayISO();
    const val  = parseFloat(valInp.value);
    if (isNaN(val) || val <= 0) return;
    waistData[date] = val;
    saveBodyCompStorage();
    valInp.value = '';
    renderBodyComp();
    showToast('Waist saved');
}

function renderBodyComp() {
    const section = document.getElementById('bodyCompSection');
    if (!section) return;

    const today = todayISO();
    const dates = Object.keys(bodyweightData).sort();
    const latestDate = dates.length ? dates[dates.length - 1] : null;
    const todayVal = bodyweightData[today];

    const todayEl = document.getElementById('bwToday');
    const avgEl   = document.getElementById('bwAvg7');
    const trendEl = document.getElementById('bwTrend');

    if (todayEl) todayEl.textContent = todayVal != null ? `${todayVal} lbs` : '—';

    const avgLatest = latestDate ? rollingAvg(bodyweightData, latestDate, 7) : null;
    if (avgEl) avgEl.textContent = avgLatest != null ? `${avgLatest.toFixed(1)} lbs` : '—';

    if (trendEl) {
        if (latestDate && dates.length >= 8) {
            const weekAgo = new Date(latestDate);
            weekAgo.setDate(weekAgo.getDate() - 7);
            const avgPrior = rollingAvg(bodyweightData, weekAgo.toISOString().split('T')[0], 7);
            if (avgLatest != null && avgPrior != null) {
                const delta = avgLatest - avgPrior;
                const arrow = delta < -0.05 ? '↓' : delta > 0.05 ? '↑' : '→';
                trendEl.textContent = `${arrow} ${Math.abs(delta).toFixed(1)} lbs/wk`;
            } else {
                trendEl.textContent = 'Need more data';
            }
        } else {
            trendEl.textContent = 'Need more data';
        }
    }

    // Waist
    const waistDates = Object.keys(waistData).sort();
    const waistLatest = waistDates.length ? waistDates[waistDates.length - 1] : null;
    const waistPrev   = waistDates.length > 1 ? waistDates[waistDates.length - 2] : null;
    const waistEl      = document.getElementById('waistLatest');
    const waistDeltaEl = document.getElementById('waistDelta');
    if (waistEl) waistEl.textContent = waistLatest ? `${waistData[waistLatest]} in` : '—';
    if (waistDeltaEl) {
        if (waistLatest && waistPrev) {
            const d = waistData[waistLatest] - waistData[waistPrev];
            waistDeltaEl.textContent = `${d <= 0 ? '↓' : '↑'} ${Math.abs(d).toFixed(1)} in vs last entry`;
        } else {
            waistDeltaEl.textContent = '';
        }
    }

    // Sparkline
    if (dates.length >= 2) {
        renderSVGLineChart('bwSparkline', [{
            label: 'Weight',
            color: '#2383e2',
            points: dates.map((d, i) => ({ x: i + 1, y: bodyweightData[d] }))
        }], { xLabels: [], formatY: v => v.toFixed(0) });
    } else {
        const sparkContainer = document.getElementById('bwSparkline');
        if (sparkContainer) sparkContainer.innerHTML = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();
    updateWorkout();
    renderHeatmap();

    loadBodyComp();
    const bwDate = document.getElementById('bwDate');
    const waistDate = document.getElementById('waistDate');
    if (bwDate) bwDate.value = todayISO();
    if (waistDate) waistDate.value = todayISO();
    renderBodyComp();
});
