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

// Superset-aware focus state
let focusBlockGroups  = [];  // [{type, exercises: [indices]}]
let focusGroupIdx     = 0;   // current block group
let focusSubIdx       = 0;   // exercise within group
let focusRoundIdx     = 0;   // current round (= set index)

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
        const rd = localStorage.getItem('wt-rpe-data');
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
function buildBlockGroups() {
    const exercises = workoutData[currentPhase].exercises;
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
    document.getElementById('focusOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    renderFocusExercise();
}

function exitFocusMode() {
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
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

function showSummary() {
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
    document.getElementById('focusOverlay').classList.add('hidden');
    document.body.style.overflow = '';
    updateWorkout();

    const data           = workoutData[currentPhase];
    const isLastSession  = currentSession >= data.totalSessions;
    const isLastPhase    = currentPhase >= 3;
    const stats          = calcSessionStats();

    document.getElementById('summaryPhaseSession').textContent =
        `Phase ${currentPhase} · Session ${currentSession} of ${data.totalSessions}`;

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
    el.innerHTML = focusBlockGroups.map((g, i) => {
        const label = g.type.replace('Block ', '').replace('Warm-Up', 'WU');
        const cls   = i < focusGroupIdx ? 'bp-done' : i === focusGroupIdx ? 'bp-current' : '';
        return `<div class="bp-node ${cls}">${label}</div>`;
    }).join('');
}

function renderFocusExercise() {
    // Switch to exercise screen
    document.getElementById('focusScreenExercise').classList.remove('hidden');
    document.getElementById('focusScreenRest').classList.add('hidden');

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
    const progWeight  = cue && cue.type === 'up' ? cue.text.match(/([\d.]+)\s*lbs/)?.[1] : null;
    const savedW      = curData[wKey] || progWeight || (prev && prev.weight !== '—' ? prev.weight : '');
    const savedR      = curData[rKey] || (prev && prev.reps   !== '—' ? prev.reps   : '');
    const isDone      = !!completedSets[`${sk}-${focusExIdx}-${focusSetIdx}`];

    // Header text
    if (isSuperset) {
        document.getElementById('focusProgText').textContent =
            `${group.type} · Round ${focusRoundIdx + 1} of ${totalRounds}`;
    } else {
        document.getElementById('focusProgText').textContent =
            `${group.type} · Set ${focusRoundIdx + 1} of ${totalRounds}`;
    }

    // Block tag removed — redundant with header block progress indicator
    document.getElementById('focusBlockTag').style.display = 'none';
    document.getElementById('focusExName').textContent   = ex.name;

    if (isSuperset) {
        document.getElementById('focusSetCounter').textContent =
            `Exercise ${focusSubIdx + 1} of ${group.exercises.length} · Round ${focusRoundIdx + 1}`;
    } else {
        document.getElementById('focusSetCounter').textContent =
            `Set ${focusSetIdx + 1} of ${totalRounds}`;
    }

    // Collapse note + tempo into a single compact coaching line
    const noteEl = document.getElementById('focusNote');
    const tempoCueText = tempoToCue(ex.tempo);
    const parts = [];
    if (ex.note) parts.push(ex.note);
    if (tempoCueText) parts.push(tempoCueText);
    if (parts.length) {
        noteEl.textContent = parts.join(' · ');
        noteEl.style.display = '';
    } else {
        noteEl.style.display = 'none';
    }

    // Hide video embed in focus mode (available in pre-workout review)
    const videoWrap = document.getElementById('focusVideo');
    const videoEmbed = document.getElementById('focusVideoEmbed');
    videoWrap.classList.add('hidden');
    videoEmbed.innerHTML = '';

    // Hide standalone tempo element (merged into note line above)
    const tempoEl = document.getElementById('focusTempo');
    if (tempoEl) tempoEl.style.display = 'none';

    if (prev && prev.weight !== '—') {
        document.getElementById('focusPrev').textContent = `Last time: ${prev.weight} lbs × ${prev.reps} reps`;
    } else {
        document.getElementById('focusPrev').textContent = 'First time — start comfortable';
    }

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

    document.getElementById('focusWeight').value = savedW;
    document.getElementById('focusReps').value   = savedR;

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

    showRestScreen(restSeconds);
}

function showRestScreen(seconds) {
    // Switch screens
    document.getElementById('focusScreenExercise').classList.add('hidden');
    document.getElementById('focusScreenRest').classList.remove('hidden');

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
            if (focusRestLeft <= 0) {
                clearInterval(focusRestInterval);
                focusRestInterval = null;
                if (restTimeEl) restTimeEl.textContent = 'Done!';
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
    advanceFocusSet();
}

function jumpFocusSet(r) {
    if (focusRestInterval) { clearInterval(focusRestInterval); focusRestInterval = null; }
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

    let text = `💪 Phase ${currentPhase} · Session ${currentSession} of ${data.totalSessions} — Done!\n`;
    text += `📅 ${date}\n\n`;
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
        prevContainer.innerHTML = `<p style="font-size:12px;color:var(--text-muted);font-style:italic;">First session — establish baseline</p>`;
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
            `<p style="font-size:12px;color:var(--text-muted);font-style:italic;">No data from previous session</p>`;
    }
}

/* ════════════════ MAIN RENDER ════════════════ */
function updateWorkout() {
    const data = workoutData[currentPhase];

    document.getElementById('pageTitle').innerHTML =
        data.name + ' <span style="font-size:13px;color:var(--text-muted);font-weight:400;">v4</span>';
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
