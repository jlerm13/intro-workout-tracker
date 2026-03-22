/* ════════════════ DATA ════════════════ */
const workoutData = {
    1: {
        name: "Workout 1 — Upper Body A",
        frequency: "EDT Upper/Lower Split · 4 Day Program",
        totalSessions: 4,
        progression: [
            { session: 1, note: "Week 1 — Block A: 13 min · Block B: 10 min · Block C: 7 min" },
            { session: 2, note: "Week 2 — Block A: 13 min · Block B: 10 min · Block C: 7 min" },
            { session: 3, note: "Week 3 Deload — Block A: 5 min · Block B: 6 min · Block C: 3 min" },
            { session: 4, note: "Week 4 — Block A: 13 min · Block B: 10 min · Block C: 7 min" }
        ],
        exercises: [
            { name: "15 Degree Incline Barbell Press",    type: "Block A", sets: 5, reps: "4",  tempo: "30X0", rest: "0", note: "Use ~8RM load. A1–A2 superset: cycle between exercises with minimal rest for the full block time window." },
            { name: "Narrow Supinated Chin Up",           type: "Block A", sets: 5, reps: "4",  tempo: "30X1", rest: "0", note: "Use ~8RM load. A2 of superset — go straight from A1 with minimal rest." },
            { name: "Standing Barbell Shoulder Press",    type: "Block B", sets: 5, reps: "8",  tempo: "20X0", rest: "0", note: "Use ~16RM load. B1–B2 superset: cycle between exercises with minimal rest for the full block time window." },
            { name: "Bent Over Supinated Barbell Row",    type: "Block B", sets: 5, reps: "8",  tempo: "2010", rest: "0", note: "Use ~16RM load. B2 of superset — go straight from B1 with minimal rest." },
            { name: "Standing Mid Reverse Grip EZ Curl",  type: "Block C", sets: 5, reps: "10", tempo: "2010", rest: "0", note: "Use ~20RM load. C1–C2 superset: cycle between exercises with minimal rest for the full block time window." },
            { name: "Triceps Pressdown with Rope",        type: "Block C", sets: 5, reps: "10", tempo: "2011", rest: "0", note: "Use ~20RM load. C2 of superset — go straight from C1 with minimal rest." }
        ]
    },
    2: {
        name: "Workout 2 — Lower Body A",
        frequency: "EDT Upper/Lower Split · 4 Day Program",
        totalSessions: 4,
        progression: [
            { session: 1, note: "Week 1 — Block A: 13 min · Block B: 10 min · Block C: 7 min" },
            { session: 2, note: "Week 2 — Block A: 13 min · Block B: 10 min · Block C: 7 min" },
            { session: 3, note: "Week 3 Deload — Block A: 5 min · Block B: 6 min · Block C: 3 min" },
            { session: 4, note: "Week 4 — Block A: 13 min · Block B: 10 min · Block C: 7 min" }
        ],
        exercises: [
            { name: "Straight Bar Box Squat",                        type: "Block A", sets: 5, reps: "4",  tempo: "30X0", rest: "0", note: "Use ~8RM load. Box height keeps you out of anterior hip pinch — sit back under control, pause lightly on box, drive up. A1–A2 superset." },
            { name: "Lying Leg Curl - toes DF and NEUT",             type: "Block A", sets: 5, reps: "4",  tempo: "30X1", rest: "0", note: "Use ~8RM load. Keep pelvis anchored, avoid lumbar extension. A2 of superset — go straight from A1 with minimal rest." },
            { name: "Front-Foot Elevated Split Squat",               type: "Block B", sets: 5, reps: "8/leg", tempo: "20X0", rest: "0", note: "Use ~16RM load. Small front-foot elevation, pelvis square, torso slightly forward. B1–B2 superset." },
            { name: "Snatch Grip Barbell 45 Degree Back Extension",  type: "Block B", sets: 5, reps: "8",  tempo: "2010", rest: "0", note: "Use ~16RM load. Stop at neutral — do not hyperextend lumbar spine. Finish with glutes, not back. B2 of superset." },
            { name: "Dead Bug",                                      type: "Block C", sets: 5, reps: "10/side", tempo: "2010", rest: "0", note: "Bodyweight. Full exhale, rib control, quiet pelvis — train trunk control without overloading hip flexors. C1–C2 superset." },
            { name: "Suitcase Carry",                                type: "Block C", sets: 5, reps: "30s/side", tempo: "—",  rest: "0", note: "Moderate load. Anti-lateral-flexion and asymmetry control — maintain upright trunk, quiet pelvis. C2 of superset." }
        ]
    },
    3: {
        name: "Workout 3 — Upper Body B",
        frequency: "EDT Upper/Lower Split · 4 Day Program",
        totalSessions: 4,
        progression: [
            { session: 1, note: "Week 1 — Block A: 13 min · Block B: 10 min · Block C: 7 min" },
            { session: 2, note: "Week 2 — Block A: 13 min · Block B: 10 min · Block C: 7 min" },
            { session: 3, note: "Week 3 Deload — Block A: 5 min · Block B: 6 min · Block C: 3 min" },
            { session: 4, note: "Week 4 — Block A: 13 min · Block B: 10 min · Block C: 7 min" }
        ],
        exercises: [
            { name: "Inertia Bench Press from Pins",         type: "Block A", sets: 5, reps: "3", tempo: "22X0", rest: "0", note: "Use ~6RM load. Set pins so bar is 1–2\" off chest. A1–A2 superset: cycle between exercises with minimal rest for the full block time window." },
            { name: "Mid-Neutral Grip Lean Away Pull Up",    type: "Block A", sets: 5, reps: "3", tempo: "40X0", rest: "0", note: "Use ~6RM load. A2 of superset — go straight from A1 with minimal rest." },
            { name: "Dips",                                  type: "Block B", sets: 5, reps: "5", tempo: "30X0", rest: "0", note: "Use ~10RM load. B1–B2 superset: cycle between exercises with minimal rest for the full block time window." },
            { name: "Seated Supinated Grip Cable Row",       type: "Block B", sets: 5, reps: "5", tempo: "2010", rest: "0", note: "Use ~10RM load. B2 of superset — go straight from B1 with minimal rest." },
            { name: "Seated DB Hammer Curl",                 type: "Block C", sets: 5, reps: "7", tempo: "2010", rest: "0", note: "Use ~14RM load. C1–C2 superset: cycle between exercises with minimal rest for the full block time window." },
            { name: "EZ Bar French Press",                   type: "Block C", sets: 5, reps: "7", tempo: "21X0", rest: "0", note: "Use ~14RM load. C2 of superset — go straight from C1 with minimal rest." }
        ]
    },
    4: {
        name: "Workout 4 — Lower Body B",
        frequency: "EDT Upper/Lower Split · 4 Day Program",
        totalSessions: 4,
        progression: [
            { session: 1, note: "Week 1 — Block A: 13 min · Block B: 13 min · Block C: 7 min" },
            { session: 2, note: "Week 2 — Block A: 13 min · Block B: 13 min · Block C: 7 min" },
            { session: 3, note: "Week 3 Deload — Block A: 5 min · Block A: 4 min · Block C: 3 min" },
            { session: 4, note: "Week 4 — Block A: 13 min · Block B: 13 min · Block C: 7 min" }
        ],
        exercises: [
            { name: "Barbell Deadlift from Blocks",  type: "Block A", sets: 5, reps: "3",      tempo: "22X0", rest: "0", note: "Use ~6RM load. Set blocks high enough to avoid excessive hip flexion — conventional stance. A1–A2 superset." },
            { name: "Lateral Step-Down",             type: "Block A", sets: 5, reps: "5/leg",   tempo: "3010", rest: "0", note: "Bodyweight or light load. Frontal-plane control and deceleration — control the lowering phase. A2 of superset." },
            { name: "Barbell RDL",                   type: "Block B", sets: 5, reps: "5",       tempo: "3010", rest: "0", note: "Use ~10RM load. Chase hamstring load, not the floor — limit range where spinal position stays clean. B1–B2 superset." },
            { name: "Seated Leg Curl",               type: "Block B", sets: 5, reps: "5",       tempo: "30X0", rest: "0", note: "Use ~14RM load. Keep pelvis anchored, avoid lumbar extension. B2 of superset." },
            { name: "Low Box Step-Up",               type: "Block C", sets: 5, reps: "5/leg",   tempo: "2010", rest: "0", note: "Use ~10RM load. Clean force acceptance without pelvic shift — minimize push-off from trail leg. C1–C2 superset." },
            { name: "Copenhagen Plank",              type: "Block C", sets: 5, reps: "20s/side", tempo: "—",   rest: "0", note: "Bodyweight. Short lever first — adductor strength, frontal-plane control, pelvis stability. C2 of superset." }
        ]
    }
};

const exerciseVideos = {
    // Workout 1 — Upper Body A
    '15 Degree Incline Barbell Press':                  'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Narrow Supinated Chin Up':                         'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Standing Barbell Shoulder Press':                  'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Bent Over Supinated Barbell Row':                  'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Standing Mid Reverse Grip EZ Curl':                'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Triceps Pressdown with Rope':                      'https://www.youtube.com/watch?v=PLACEHOLDER',

    // Workout 2 — Lower Body A
    'Straight Bar Box Squat':                           'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Lying Leg Curl - toes DF and NEUT':               'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Front-Foot Elevated Split Squat':                  'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Snatch Grip Barbell 45 Degree Back Extension':     'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Dead Bug':                                         'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Suitcase Carry':                                   'https://www.youtube.com/watch?v=PLACEHOLDER',

    // Workout 3 — Upper Body B
    'Inertia Bench Press from Pins':                    'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Mid-Neutral Grip Lean Away Pull Up':               'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Dips':                                             'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Seated Supinated Grip Cable Row':                  'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Seated DB Hammer Curl':                            'https://www.youtube.com/watch?v=PLACEHOLDER',
    'EZ Bar French Press':                              'https://www.youtube.com/watch?v=PLACEHOLDER',

    // Workout 4 — Lower Body B
    'Barbell Deadlift from Blocks':                     'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Lateral Step-Down':                                'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Barbell RDL':                                      'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Seated Leg Curl':                                  'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Low Box Step-Up':                                  'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Copenhagen Plank':                                 'https://www.youtube.com/watch?v=PLACEHOLDER',
};
