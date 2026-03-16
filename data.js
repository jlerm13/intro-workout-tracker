/* ════════════════ DATA ════════════════ */
const workoutData = {
    1: {
        name: "Phase 1 — Accumulation",
        frequency: "2x per week for 2 weeks",
        totalSessions: 4,
        progression: [
            { session: 1, note: "Baseline — Learn the movements" },
            { session: 2, note: "Add +1 set to all exercises" },
            { session: 3, note: "Add +1 more set (up to 4 sets on main lifts)" },
            { session: 4, note: "Taper — Keep mains at 4 sets, accessories at 3" }
        ],
        exercises: [
            { name: "Air Dyne / Assault Bike",            type: "Warm-Up", sets: 1, reps: "5",          work: "30s",   rest: "30",     note: "Max effort sprint for 30s" },
            { name: "DB Goblet Squat",                  type: "Block A",  sets: 2, reps: "8-12",      tempo: "4010", rest: "60", note: "Hold at chest, squat to comfortable depth" },
            { name: "DB Bench Press",                   type: "Block A",  sets: 2, reps: "8-12",      tempo: "3010", rest: "30",      note: "Control on the way down" },
            { name: "Ring Rows",                        type: "Block B",  sets: 2, reps: "8-12",      tempo: "3010", rest: "90",      note: "Start easy angle, pull chest to rings" },
            { name: "Elevated Single Leg Glute Bridge", type: "Block B",  sets: 2, reps: "10-12/leg", tempo: "3011", rest: "30",      note: "Shoulders on Bench. Non-working leg extended straight" },
            { name: "Reverse Lunge",                    type: "Block C",  sets: 2, reps: "10/leg",    tempo: "3010", rest: "90",      note: "Step back, knee to 90°, drive through front heel" },
            { name: "DB Overhead Press",                type: "Block C",  sets: 2, reps: "8-12",      tempo: "3010", rest: "30",      note: "Back supported against wall if possible" },
            { name: "DB RDL + Row",                     type: "Block C",  sets: 2, reps: "8-12",      tempo: "3011", rest: "90",      note: "Hinge at hips, pull to lower ribs" },
            { name: "Sit Up",                           type: "Block D",  sets: 2, reps: "12-15/side",tempo: "3011", rest: "0",       note: "Keep lower back pressed to floor" },
            { name: "Band Pull-Apart",                  type: "Block E",  sets: 2, reps: "12-15",     tempo: "3011", rest: "0",       note: "Arms straight, squeeze shoulder blades" },
            { name: "Side Lying Lateral Leg Raise",     type: "Block E",  sets: 2, reps: "15-20",     tempo: "2010", rest: "0",       note: "Keep front slightly behind body, lead with heel" }
        ]
    },
    2: {
        name: "Phase 2 — Intensification",
        frequency: "3x per week for 2 weeks",
        totalSessions: 6,
        progression: [
            { session: 1, note: "Introduction to higher intensity" },
            { session: 2, note: "Main lifts to 4 sets, accessories stay at 3" },
            { session: 3, note: "Accessories to 4 sets, core stays at base" },
            { session: 4, note: "Maintain 4 sets all except core" },
            { session: 5, note: "Peak — compounds to 5 sets, accessories 4" },
            { session: 6, note: "Taper — accessories to 3, compounds to 4" }
        ],
        exercises: [
            { name: "Air Dyne / Assault Bike",   type: "Warm-Up", sets: 1, reps: "8",         work: "20s",   rest: "40",     note: "Max effort sprint for 20s" },
            { name: "Bulgarian Split Squat",        type: "Block A",  sets: 3, reps: "5-8/leg",  tempo: "4010", rest: "60", note: "Rear foot on bench, front leg does work" },
            { name: "DB Bench Press (neutral grip)",type: "Block B",  sets: 3, reps: "5-8",      tempo: "3010", rest: "30",      note: "Palms face each other" },
            { name: "Ring Rows",                   type: "Block B",  sets: 3, reps: "5-8",      tempo: "3010", rest: "90",      note: "Harder angle for strength focus" },
            { name: "Single Leg Glute Bridge",     type: "Block C",  sets: 3, reps: "8-12/leg", tempo: "3011", rest: "30",      note: "Add weight for progression" },
            { name: "Romanian Deadlift",           type: "Block C",  sets: 3, reps: "8-12",     tempo: "3010", rest: "90",      note: "Hinge at hips, feel hamstring stretch" },
            { name: "Single Arm DB Press",         type: "Block D",  sets: 3, reps: "8-12/arm", tempo: "3010", rest: "30",      note: "Engage core for stability" },
            { name: "Single Arm DB Row",           type: "Block D",  sets: 3, reps: "8-12/arm", tempo: "3011", rest: "90",      note: "Opposite hand/knee on bench" },
            { name: "Dead Bug",                    type: "Block E",  sets: 2, reps: "12-15/side",tempo: "3011", rest: "0",      note: "Keep lower back pressed to floor" },
            { name: "Band Pull-Apart",             type: "Block E",  sets: 2, reps: "12-15",    tempo: "3011", rest: "0",       note: "Arms straight, squeeze shoulder blades" },
            { name: "Standing Lateral Leg Raise",  type: "Block E",  sets: 2, reps: "15-20",    tempo: "2010", rest: "0",       note: "Knee bent, squeeze at top" }
        ]
    },
    3: {
        name: "Phase 3 — Strength / Hypertrophy",
        frequency: "3x per week for 3 weeks",
        totalSessions: 9,
        progression: [
            { session: 1, note: "New movements — establish form at heavier loads, 3 sets all" },
            { session: 2, note: "Strength lifts (Block A) to 4 sets — quality reps over weight" },
            { session: 3, note: "All compounds to 4 sets — note your target weights for next week" },
            { session: 4, note: "Maintain 4 sets — add weight where form allows" },
            { session: 5, note: "Strength lifts peak to 5 sets — hypertrophy work at 4 sets" },
            { session: 6, note: "Maintain peak sets — push for PR effort on Block A" },
            { session: 7, note: "Max volume week — all compounds at 5 sets. Push hard" },
            { session: 8, note: "Peak intensity — 5 sets Block A, 4 sets B/C. Go heavier" },
            { session: 9, note: "Taper — reduce volume, maintain intensity. Program complete!" }
        ],
        exercises: [
            { name: "Air Dyne / Assault Bike",    type: "Warm-Up", sets: 1, reps: "10",        work: "10s",   rest: "50",     note: "Max effort sprint for 10s" },
            { name: "Heel-Elevated DB Squat",     type: "Block A",  sets: 3, reps: "4-6",      tempo: "4010", rest: "180",     note: "Heels elevated 1-2 inches on a plate. Knees track over toes, drive through full range" },
            { name: "Weighted Ring Row",          type: "Block A",  sets: 3, reps: "4-6",      tempo: "3011", rest: "90",      note: "Use weight vest or hold DB on chest. Body parallel to floor — full scapular retraction at top" },
            { name: "DB Bench Press",             type: "Block B",  sets: 3, reps: "6-10",     tempo: "3010", rest: "30",      note: "Controlled descent to chest, slight arch. Drive through sticking point" },
            { name: "Single Leg Hip Thrust",      type: "Block B",  sets: 3, reps: "8-12/leg", tempo: "3011", rest: "90",      note: "Shoulders on bench, DB across hip. Full extension at top — pause and squeeze glute" },
            { name: "DB Deadlift",                type: "Block C",  sets: 3, reps: "5-8",      tempo: "3010", rest: "30",      note: "Push floor away, keep DBs close to legs. Full hip extension at top, control descent" },
            { name: "Chest-Supported DB Row",     type: "Block C",  sets: 3, reps: "8-12",     tempo: "3011", rest: "90",      note: "Chest on incline bench, arms hang. Pull elbows back, squeeze shoulder blades hard at top" },
            { name: "DB Overhead Press",          type: "Block D",  sets: 3, reps: "8-10",     tempo: "3010", rest: "30",      note: "Strict press — no leg drive. Core braced, press directly overhead" },
            { name: "DB Lateral Raise",           type: "Block D",  sets: 3, reps: "12-15",    tempo: "2010", rest: "60",      note: "Slight forward lean, lead with elbows to ear height. Slow controlled descent" },
            { name: "Pallof Press",               type: "Block E",  sets: 3, reps: "10/side",  tempo: "3010", rest: "0",       note: "Anchor band at chest height. Press straight out and resist rotation — core stays square" },
            { name: "Band Pull-Apart",            type: "Block E",  sets: 3, reps: "12-15",    tempo: "3011", rest: "0",       note: "Arms straight, squeeze shoulder blades at full extension" },
            { name: "Side Lying Hip Abduction",   type: "Block E",  sets: 3, reps: "15-20",    tempo: "2010", rest: "0",       note: "Keep top hip slightly forward, lead with heel. Squeeze glute at top" }
        ]
    }
};

const exerciseVideos = {
    'Glute Bridge':                     'https://www.youtube.com/watch?v=OUgsJ8-Vi0E',
    'DB Goblet Squat':                  'https://www.youtube.com/watch?v=XY8p9ijlsSQ',
    'DB Bench Press':                   'https://www.youtube.com/watch?v=vfcYF6_yFAs',
    'DB Bench Press (neutral grip)':    'https://www.youtube.com/watch?v=KeUF3cx1n_o',
    'Ring Rows':                        'https://www.youtube.com/watch?v=DTtdIfsh9lE',
    'Single Leg Glute Bridge':          'https://www.youtube.com/watch?v=AVAXhy6pl7o',
    'Reverse Lunge':                    'https://www.youtube.com/watch?v=Q2k3kYbtOcI',
    'DB Overhead Press':                'https://www.youtube.com/watch?v=qEwKCR5JCog',
    'DB Bent Over Row':                 'https://www.youtube.com/watch?v=pYcpY20QaE8',
    'Dead Bug':                         'https://www.youtube.com/watch?v=hGeKSiZReiE',
    'Band Pull-Apart':                  'https://www.youtube.com/watch?v=JTCBVbeWYP4',
    'Side Lying Lateral Leg Raise':     'https://www.youtube.com/watch?v=v7VmrcipWGk',
    'Standing Lateral Leg Raise':       'https://www.youtube.com/watch?v=rW5yoJqclEg',
    'Bulgarian Split Squat':            'https://www.youtube.com/watch?v=2C-uNgKwPLE',
    'Romanian Deadlift':                'https://www.youtube.com/watch?v=jEy_czb3RKA',
    'Single Arm DB Press':              'https://www.youtube.com/watch?v=B-aVuyhvLHU',
    'Single Arm DB Row':                'https://www.youtube.com/watch?v=dFzUjzfih7k'
};

