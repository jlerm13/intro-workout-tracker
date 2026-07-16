/* ════════════════ DATA ════════════════ */
// v2 program: 7 weeks, alternating full-body Workouts A/B, fixed set counts
// per phase-block with double progression (reps -> load) instead of
// escalating sets every session.
//
// INVARIANT: the exercise order inside workouts.A (and workouts.B) is
// IDENTICAL across all 4 phase-blocks below. All logged data is keyed by
// exIdx (position in the array), and history lookups match sessions by
// workout letter + exIdx across the whole program. Reordering an exercise
// within one block's A/B list corrupts prev-data, PRs, and charts for
// every other block.
const workoutData = {
    1: {
        name: "Weeks 1-2 — Foundation",
        frequency: "2x per week · 2 sets per exercise · 3 reps in reserve",
        totalSessions: 4,
        sessionsPlan: ['A', 'B', 'A', 'B'],
        progression: [
            { session: 1, workout: 'A', rir: '3 RIR', note: "Workout A baseline — learn the movements, stop 3 reps shy of failure" },
            { session: 2, workout: 'B', rir: '3 RIR', note: "Workout B baseline — same rule: leave 3 solid reps in the tank on every set" },
            { session: 3, workout: 'A', rir: '3 RIR', note: "Repeat Workout A — same sets, add a rep or two where form allows" },
            { session: 4, workout: 'B', rir: '3 RIR', note: "Repeat Workout B — same sets, push toward the top of each rep range" }
        ],
        workouts: {
            A: [
                { name: "Warm-Up: Easy Cycling + Ramp-Up Sets", type: "Warm-Up", sets: 1, reps: "—", rest: "0", noLog: true,
                  note: "3-5 min easy cycling, then 2-4 ramp-up sets on your first lift (light → working weight). No sprints." },
                { name: "DB Goblet Squat → Leg Press", type: "Block A", sets: 2, priority: true, reps: "6-10", rest: "120-180",
                  cue: "Controlled descent, drive up through the heels", note: "Start with goblet squat; move to leg press or barbell/hack squat once dumbbells feel limiting" },
                { name: "DB Bench Press", type: "Block B", sets: 2, priority: true, reps: "6-10", rest: "120-180",
                  cue: "Controlled lowering to the chest, press hard", note: "Slight arch, drive through the sticking point" },
                { name: "Lat Pulldown", type: "Block C", sets: 2, reps: "8-12", rest: "90-120",
                  cue: "Pull to upper chest, squeeze the lats", note: "Bands or ring rows work if no cable machine is available" },
                { name: "Romanian Deadlift", type: "Block D", sets: 2, priority: true, reps: "6-10", rest: "120-180",
                  cue: "Hinge at the hips, soft knees", note: "Feel the hamstring stretch, keep the bar/DBs close to the legs" },
                { name: "DB Lateral Raise", type: "Block E", sets: 2, reps: "12-15", rest: "60-90",
                  cue: "Lead with the elbows, no swing", note: "Raise to ear height, slow controlled descent" },
                { name: "Pallof Press", type: "Block F", sets: 2, reps: "10/side", rest: "60",
                  cue: "Press straight out, resist rotation", note: "Anchor at chest height, core stays square" },
                { name: "Optional: Zone-2 Conditioning", type: "Conditioning", sets: 1, reps: "20-30 min", rest: "0", noLog: true,
                  note: "Optional — after lifting or on an off day: easy bike/walk at a conversational pace" }
            ],
            B: [
                { name: "Warm-Up: Easy Cycling + Ramp-Up Sets", type: "Warm-Up", sets: 1, reps: "—", rest: "0", noLog: true,
                  note: "3-5 min easy cycling, then 2-4 ramp-up sets on your first lift (light → working weight). No sprints." },
                { name: "Trap-Bar Deadlift", type: "Block A", sets: 2, priority: true, reps: "5-8", rest: "150-180",
                  cue: "Push the floor away, flat back", note: "Hack squat or leg press if no trap bar is available" },
                { name: "Incline DB Press", type: "Block B", sets: 2, priority: true, reps: "8-12", rest: "120-180",
                  cue: "Elbows ~45° from the torso", note: "30-45° bench angle" },
                { name: "Chest-Supported DB Row", type: "Block C", sets: 2, priority: true, reps: "8-12", rest: "90-120",
                  cue: "Pull elbows back, squeeze at the top", note: "Chest on an incline bench, arms hang fully at the start" },
                { name: "Bulgarian Split Squat", type: "Block D", sets: 2, reps: "8-12/leg", rest: "90-120",
                  cue: "Front leg does the work", note: "Rear foot up on a bench" },
                { name: "Lying/Seated Leg Curl", type: "Block E", sets: 2, reps: "10-15", rest: "60-90",
                  cue: "Full stretch to full contraction", note: "Slider or stability-ball curl if no machine is available" },
                { name: "Optional: DB Curl", type: "Block F", sets: 2, reps: "10-15", rest: "60",
                  cue: "No swing, full range", note: "Optional finisher — skip if short on time" },
                { name: "Optional: Standing Calf Raise", type: "Block F", sets: 2, reps: "12-20", rest: "60",
                  cue: "Full stretch at the bottom, pause at the top", note: "Optional finisher — skip if short on time" },
                { name: "Optional: Zone-2 Conditioning", type: "Conditioning", sets: 1, reps: "20-30 min", rest: "0", noLog: true,
                  note: "Optional — after lifting or on an off day: easy bike/walk at a conversational pace" }
            ]
        }
    },
    2: {
        name: "Weeks 3-4 — Build",
        frequency: "3x per week · priority lifts get a 3rd set · 2-3 reps in reserve",
        totalSessions: 6,
        sessionsPlan: ['A', 'B', 'A', 'B', 'A', 'B'],
        progression: [
            { session: 1, workout: 'A', rir: '2-3 RIR', note: "New rep ranges, priority lifts add a 3rd set — same rule: stop 2-3 reps shy" },
            { session: 2, workout: 'B', rir: '2-3 RIR', note: "Workout B gains its 3rd set on priority lifts too" },
            { session: 3, workout: 'A', rir: '2-3 RIR', note: "Second week of Build — beat last Workout A's reps or load" },
            { session: 4, workout: 'B', rir: '2-3 RIR', note: "Second week of Build — beat last Workout B's reps or load" },
            { session: 5, workout: 'A', rir: '2-3 RIR', note: "Keep climbing — add load once every set hits the top of its rep range" },
            { session: 6, workout: 'B', rir: '2-3 RIR', note: "Last session of Build — set up for a harder push next block" }
        ],
        workouts: {
            A: [
                { name: "Warm-Up: Easy Cycling + Ramp-Up Sets", type: "Warm-Up", sets: 1, reps: "—", rest: "0", noLog: true,
                  note: "3-5 min easy cycling, then 2-4 ramp-up sets on your first lift (light → working weight). No sprints." },
                { name: "DB Goblet Squat → Leg Press", type: "Block A", sets: 3, priority: true, reps: "6-10", rest: "120-180",
                  cue: "Controlled descent, drive up through the heels", note: "Start with goblet squat; move to leg press or barbell/hack squat once dumbbells feel limiting" },
                { name: "DB Bench Press", type: "Block B", sets: 3, priority: true, reps: "6-10", rest: "120-180",
                  cue: "Controlled lowering to the chest, press hard", note: "Slight arch, drive through the sticking point" },
                { name: "Lat Pulldown", type: "Block C", sets: 2, reps: "8-12", rest: "90-120",
                  cue: "Pull to upper chest, squeeze the lats", note: "Bands or ring rows work if no cable machine is available" },
                { name: "Romanian Deadlift", type: "Block D", sets: 3, priority: true, reps: "6-10", rest: "120-180",
                  cue: "Hinge at the hips, soft knees", note: "Feel the hamstring stretch, keep the bar/DBs close to the legs" },
                { name: "DB Lateral Raise", type: "Block E", sets: 2, reps: "12-15", rest: "60-90",
                  cue: "Lead with the elbows, no swing", note: "Raise to ear height, slow controlled descent" },
                { name: "Pallof Press", type: "Block F", sets: 2, reps: "10/side", rest: "60",
                  cue: "Press straight out, resist rotation", note: "Anchor at chest height, core stays square" },
                { name: "Optional: Zone-2 Conditioning", type: "Conditioning", sets: 1, reps: "20-30 min", rest: "0", noLog: true,
                  note: "Optional — after lifting or on an off day: easy bike/walk at a conversational pace" }
            ],
            B: [
                { name: "Warm-Up: Easy Cycling + Ramp-Up Sets", type: "Warm-Up", sets: 1, reps: "—", rest: "0", noLog: true,
                  note: "3-5 min easy cycling, then 2-4 ramp-up sets on your first lift (light → working weight). No sprints." },
                { name: "Trap-Bar Deadlift", type: "Block A", sets: 3, priority: true, reps: "5-8", rest: "150-180",
                  cue: "Push the floor away, flat back", note: "Hack squat or leg press if no trap bar is available" },
                { name: "Incline DB Press", type: "Block B", sets: 3, priority: true, reps: "8-12", rest: "120-180",
                  cue: "Elbows ~45° from the torso", note: "30-45° bench angle" },
                { name: "Chest-Supported DB Row", type: "Block C", sets: 3, priority: true, reps: "8-12", rest: "90-120",
                  cue: "Pull elbows back, squeeze at the top", note: "Chest on an incline bench, arms hang fully at the start" },
                { name: "Bulgarian Split Squat", type: "Block D", sets: 2, reps: "8-12/leg", rest: "90-120",
                  cue: "Front leg does the work", note: "Rear foot up on a bench" },
                { name: "Lying/Seated Leg Curl", type: "Block E", sets: 2, reps: "10-15", rest: "60-90",
                  cue: "Full stretch to full contraction", note: "Slider or stability-ball curl if no machine is available" },
                { name: "Optional: DB Curl", type: "Block F", sets: 2, reps: "10-15", rest: "60",
                  cue: "No swing, full range", note: "Optional finisher — skip if short on time" },
                { name: "Optional: Standing Calf Raise", type: "Block F", sets: 2, reps: "12-20", rest: "60",
                  cue: "Full stretch at the bottom, pause at the top", note: "Optional finisher — skip if short on time" },
                { name: "Optional: Zone-2 Conditioning", type: "Conditioning", sets: 1, reps: "20-30 min", rest: "0", noLog: true,
                  note: "Optional — after lifting or on an off day: easy bike/walk at a conversational pace" }
            ]
        }
    },
    3: {
        name: "Weeks 5-6 — Progress",
        frequency: "3x per week · same sets, push load & reps · 1-2 reps in reserve on final sets",
        totalSessions: 6,
        sessionsPlan: ['A', 'B', 'A', 'B', 'A', 'B'],
        progression: [
            { session: 1, workout: 'A', rir: '2-3 RIR', note: "Sets hold steady — keep pushing load and reps on priority lifts" },
            { session: 2, workout: 'B', rir: '2-3 RIR', note: "Sets hold steady — keep pushing load and reps on priority lifts" },
            { session: 3, workout: 'A', rir: '1-2 RIR (final set)', note: "Take the last set of each priority lift closer to failure" },
            { session: 4, workout: 'B', rir: '1-2 RIR (final set)', note: "Take the last set of each priority lift closer to failure" },
            { session: 5, workout: 'A', rir: '1-2 RIR (final set)', note: "Peak week — push for a rep or load PR on priority lifts" },
            { session: 6, workout: 'B', rir: '1-2 RIR (final set)', note: "Peak week — push for a rep or load PR on priority lifts" }
        ],
        workouts: {
            A: [
                { name: "Warm-Up: Easy Cycling + Ramp-Up Sets", type: "Warm-Up", sets: 1, reps: "—", rest: "0", noLog: true,
                  note: "3-5 min easy cycling, then 2-4 ramp-up sets on your first lift (light → working weight). No sprints." },
                { name: "DB Goblet Squat → Leg Press", type: "Block A", sets: 3, priority: true, reps: "6-10", rest: "120-180",
                  cue: "Controlled descent, drive up through the heels", note: "Start with goblet squat; move to leg press or barbell/hack squat once dumbbells feel limiting" },
                { name: "DB Bench Press", type: "Block B", sets: 3, priority: true, reps: "6-10", rest: "120-180",
                  cue: "Controlled lowering to the chest, press hard", note: "Slight arch, drive through the sticking point" },
                { name: "Lat Pulldown", type: "Block C", sets: 2, reps: "8-12", rest: "90-120",
                  cue: "Pull to upper chest, squeeze the lats", note: "Bands or ring rows work if no cable machine is available" },
                { name: "Romanian Deadlift", type: "Block D", sets: 3, priority: true, reps: "6-10", rest: "120-180",
                  cue: "Hinge at the hips, soft knees", note: "Feel the hamstring stretch, keep the bar/DBs close to the legs" },
                { name: "DB Lateral Raise", type: "Block E", sets: 2, reps: "12-15", rest: "60-90",
                  cue: "Lead with the elbows, no swing", note: "Raise to ear height, slow controlled descent" },
                { name: "Pallof Press", type: "Block F", sets: 2, reps: "10/side", rest: "60",
                  cue: "Press straight out, resist rotation", note: "Anchor at chest height, core stays square" },
                { name: "Optional: Zone-2 Conditioning", type: "Conditioning", sets: 1, reps: "20-30 min", rest: "0", noLog: true,
                  note: "Optional — after lifting or on an off day: easy bike/walk at a conversational pace" }
            ],
            B: [
                { name: "Warm-Up: Easy Cycling + Ramp-Up Sets", type: "Warm-Up", sets: 1, reps: "—", rest: "0", noLog: true,
                  note: "3-5 min easy cycling, then 2-4 ramp-up sets on your first lift (light → working weight). No sprints." },
                { name: "Trap-Bar Deadlift", type: "Block A", sets: 3, priority: true, reps: "5-8", rest: "150-180",
                  cue: "Push the floor away, flat back", note: "Hack squat or leg press if no trap bar is available" },
                { name: "Incline DB Press", type: "Block B", sets: 3, priority: true, reps: "8-12", rest: "120-180",
                  cue: "Elbows ~45° from the torso", note: "30-45° bench angle" },
                { name: "Chest-Supported DB Row", type: "Block C", sets: 3, priority: true, reps: "8-12", rest: "90-120",
                  cue: "Pull elbows back, squeeze at the top", note: "Chest on an incline bench, arms hang fully at the start" },
                { name: "Bulgarian Split Squat", type: "Block D", sets: 2, reps: "8-12/leg", rest: "90-120",
                  cue: "Front leg does the work", note: "Rear foot up on a bench" },
                { name: "Lying/Seated Leg Curl", type: "Block E", sets: 2, reps: "10-15", rest: "60-90",
                  cue: "Full stretch to full contraction", note: "Slider or stability-ball curl if no machine is available" },
                { name: "Optional: DB Curl", type: "Block F", sets: 2, reps: "10-15", rest: "60",
                  cue: "No swing, full range", note: "Optional finisher — skip if short on time" },
                { name: "Optional: Standing Calf Raise", type: "Block F", sets: 2, reps: "12-20", rest: "60",
                  cue: "Full stretch at the bottom, pause at the top", note: "Optional finisher — skip if short on time" },
                { name: "Optional: Zone-2 Conditioning", type: "Conditioning", sets: 1, reps: "20-30 min", rest: "0", noLog: true,
                  note: "Optional — after lifting or on an off day: easy bike/walk at a conversational pace" }
            ]
        }
    },
    4: {
        name: "Week 7 — Deload",
        frequency: "3 easy sessions · sets cut roughly in half · 3-4 reps in reserve",
        totalSessions: 3,
        sessionsPlan: ['A', 'B', 'A'],
        progression: [
            { session: 1, workout: 'A', rir: '3-4 RIR', note: "Deload — sets cut roughly in half, moderate load, focus on crisp technique" },
            { session: 2, workout: 'B', rir: '3-4 RIR', note: "Deload — same easy effort, let the joints and nervous system recover" },
            { session: 3, workout: 'A', rir: '3-4 RIR', note: "Final session — program complete after this. Finish feeling fresh, not fried" }
        ],
        workouts: {
            A: [
                { name: "Warm-Up: Easy Cycling + Ramp-Up Sets", type: "Warm-Up", sets: 1, reps: "—", rest: "0", noLog: true,
                  note: "3-5 min easy cycling, then 2-4 ramp-up sets on your first lift (light → working weight). No sprints." },
                { name: "DB Goblet Squat → Leg Press", type: "Block A", sets: 2, priority: true, reps: "6-10", rest: "120-180",
                  cue: "Controlled descent, drive up through the heels", note: "Moderate load — about 80% of last week's top set" },
                { name: "DB Bench Press", type: "Block B", sets: 2, priority: true, reps: "6-10", rest: "120-180",
                  cue: "Controlled lowering to the chest, press hard", note: "Moderate load — about 80% of last week's top set" },
                { name: "Lat Pulldown", type: "Block C", sets: 1, reps: "8-12", rest: "90-120",
                  cue: "Pull to upper chest, squeeze the lats", note: "Bands or ring rows work if no cable machine is available" },
                { name: "Romanian Deadlift", type: "Block D", sets: 2, priority: true, reps: "6-10", rest: "120-180",
                  cue: "Hinge at the hips, soft knees", note: "Moderate load — about 80% of last week's top set" },
                { name: "DB Lateral Raise", type: "Block E", sets: 1, reps: "12-15", rest: "60-90",
                  cue: "Lead with the elbows, no swing", note: "Raise to ear height, slow controlled descent" },
                { name: "Pallof Press", type: "Block F", sets: 1, reps: "10/side", rest: "60",
                  cue: "Press straight out, resist rotation", note: "Anchor at chest height, core stays square" },
                { name: "Optional: Zone-2 Conditioning", type: "Conditioning", sets: 1, reps: "20-30 min", rest: "0", noLog: true,
                  note: "Optional — easy bike/walk at a conversational pace" }
            ],
            B: [
                { name: "Warm-Up: Easy Cycling + Ramp-Up Sets", type: "Warm-Up", sets: 1, reps: "—", rest: "0", noLog: true,
                  note: "3-5 min easy cycling, then 2-4 ramp-up sets on your first lift (light → working weight). No sprints." },
                { name: "Trap-Bar Deadlift", type: "Block A", sets: 2, priority: true, reps: "5-8", rest: "150-180",
                  cue: "Push the floor away, flat back", note: "Moderate load — about 80% of last week's top set" },
                { name: "Incline DB Press", type: "Block B", sets: 2, priority: true, reps: "8-12", rest: "120-180",
                  cue: "Elbows ~45° from the torso", note: "Moderate load — about 80% of last week's top set" },
                { name: "Chest-Supported DB Row", type: "Block C", sets: 2, priority: true, reps: "8-12", rest: "90-120",
                  cue: "Pull elbows back, squeeze at the top", note: "Moderate load — about 80% of last week's top set" },
                { name: "Bulgarian Split Squat", type: "Block D", sets: 1, reps: "8-12/leg", rest: "90-120",
                  cue: "Front leg does the work", note: "Rear foot up on a bench" },
                { name: "Lying/Seated Leg Curl", type: "Block E", sets: 1, reps: "10-15", rest: "60-90",
                  cue: "Full stretch to full contraction", note: "Slider or stability-ball curl if no machine is available" },
                { name: "Optional: DB Curl", type: "Block F", sets: 1, reps: "10-15", rest: "60",
                  cue: "No swing, full range", note: "Optional finisher — skip if short on time" },
                { name: "Optional: Standing Calf Raise", type: "Block F", sets: 1, reps: "12-20", rest: "60",
                  cue: "Full stretch at the bottom, pause at the top", note: "Optional finisher — skip if short on time" },
                { name: "Optional: Zone-2 Conditioning", type: "Conditioning", sets: 1, reps: "20-30 min", rest: "0", noLog: true,
                  note: "Optional — easy bike/walk at a conversational pace" }
            ]
        }
    }
};

const exerciseVideos = {
    'DB Goblet Squat → Leg Press':      'https://www.youtube.com/watch?v=XY8p9ijlsSQ',
    'DB Bench Press':                   'https://www.youtube.com/watch?v=vfcYF6_yFAs',
    'Romanian Deadlift':                'https://www.youtube.com/watch?v=jEy_czb3RKA',
    'Bulgarian Split Squat':            'https://www.youtube.com/watch?v=2C-uNgKwPLE',
};
