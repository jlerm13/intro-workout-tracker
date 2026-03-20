/* ════════════════ DATA ════════════════ */
const workoutData = {
    1: {
        name: "Workout 1 — Upper Body A",
        frequency: "EDT Upper/Lower Split · 4 Day Program",
        totalSessions: 4,
        progression: [
            { session: 1, note: "Week 1 — Block A: 20 min · Block B: 15 min · Block C: 10 min" },
            { session: 2, note: "Week 2 — Block A: 20 min · Block B: 15 min · Block C: 10 min" },
            { session: 3, note: "Week 3 Deload — Block A: 8 min · Block B: 6 min · Block C: 4 min" },
            { session: 4, note: "Week 4 — Block A: 20 min · Block B: 15 min · Block C: 10 min" }
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
            { session: 1, note: "Week 1 — Block A: 20 min · Block B: 15 min · Block C: 10 min" },
            { session: 2, note: "Week 2 — Block A: 20 min · Block B: 15 min · Block C: 10 min" },
            { session: 3, note: "Week 3 Deload — Block A: 8 min · Block B: 6 min · Block C: 4 min" },
            { session: 4, note: "Week 4 — Block A: 20 min · Block B: 15 min · Block C: 10 min" }
        ],
        exercises: [
            { name: "Front Squat",                                   type: "Block A", sets: 5, reps: "4",  tempo: "30X0", rest: "0", note: "Use ~8RM load. A1–A2 superset: cycle between exercises with minimal rest for the full block time window." },
            { name: "Lying Leg Curl - toes DF and NEUT",            type: "Block A", sets: 5, reps: "4",  tempo: "30X1", rest: "0", note: "Use ~8RM load. A2 of superset — go straight from A1 with minimal rest." },
            { name: "Hack Squat Machine",                            type: "Block B", sets: 5, reps: "8",  tempo: "20X0", rest: "0", note: "Use ~16RM load. B1–B2 superset: cycle between exercises with minimal rest for the full block time window." },
            { name: "Snatch Grip Barbell 45 Degree Back Extension",  type: "Block B", sets: 5, reps: "8",  tempo: "2010", rest: "0", note: "Use ~16RM load. B2 of superset — go straight from B1 with minimal rest." },
            { name: "Standing Calf Raise",                           type: "Block C", sets: 5, reps: "10", tempo: "2010", rest: "0", note: "Use ~20RM load. C1–C2 superset: cycle between exercises with minimal rest for the full block time window." },
            { name: "Hanging Garhammer Raise",                       type: "Block C", sets: 5, reps: "10", tempo: "2011", rest: "0", note: "Bodyweight or ~20RM load held between feet. C2 of superset — go straight from C1 with minimal rest." }
        ]
    },
    3: {
        name: "Workout 3 — Upper Body B",
        frequency: "EDT Upper/Lower Split · 4 Day Program",
        totalSessions: 4,
        progression: [
            { session: 1, note: "Week 1 — Block A: 20 min · Block B: 15 min · Block C: 10 min" },
            { session: 2, note: "Week 2 — Block A: 20 min · Block B: 15 min · Block C: 10 min" },
            { session: 3, note: "Week 3 Deload — Block A: 8 min · Block B: 6 min · Block C: 4 min" },
            { session: 4, note: "Week 4 — Block A: 20 min · Block B: 15 min · Block C: 10 min" }
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
            { session: 1, note: "Week 1 — Block A: 20 min · Block B: 20 min · Block C: 10 min" },
            { session: 2, note: "Week 2 — Block A: 20 min · Block B: 20 min · Block C: 10 min" },
            { session: 3, note: "Week 3 Deload — Block A: 8 min · Block B: 8 min · Block C: 4 min" },
            { session: 4, note: "Week 4 — Block A: 20 min · Block B: 20 min · Block C: 10 min" }
        ],
        exercises: [
            { name: "Snatch Grip Deadlift on Podium",   type: "Block A", sets: 5, reps: "3", tempo: "22X0", rest: "0", note: "Use ~6RM load. Solo block — complete as many quality sets as possible within the time window." },
            { name: "Inertia Back Squat from Pins",     type: "Block B", sets: 5, reps: "3", tempo: "22X0", rest: "0", note: "Use ~6RM load. Set pins at belly button height. B1–B2 superset: cycle between exercises with minimal rest for the full block time window." },
            { name: "Seated Leg Curl",                  type: "Block B", sets: 5, reps: "5", tempo: "30X0", rest: "0", note: "Use ~14RM load. B2 of superset — go straight from B1 with minimal rest." },
            { name: "Leg Press",                        type: "Block C", sets: 5, reps: "5", tempo: "2010", rest: "0", note: "Use ~10RM load. C1–C2 superset: cycle between exercises with minimal rest for the full block time window." },
            { name: "Dumbbell Romanian Deadlift (RDL)", type: "Block C", sets: 5, reps: "7", tempo: "3010", rest: "0", note: "Use ~14RM load. C2 of superset — go straight from C1 with minimal rest." }
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
    'Front Squat':                                      'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Lying Leg Curl - toes DF and NEUT':               'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Hack Squat Machine':                               'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Snatch Grip Barbell 45 Degree Back Extension':     'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Standing Calf Raise':                              'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Hanging Garhammer Raise':                          'https://www.youtube.com/watch?v=PLACEHOLDER',

    // Workout 3 — Upper Body B
    'Inertia Bench Press from Pins':                    'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Mid-Neutral Grip Lean Away Pull Up':               'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Dips':                                             'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Seated Supinated Grip Cable Row':                  'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Seated DB Hammer Curl':                            'https://www.youtube.com/watch?v=PLACEHOLDER',
    'EZ Bar French Press':                              'https://www.youtube.com/watch?v=PLACEHOLDER',

    // Workout 4 — Lower Body B
    'Snatch Grip Deadlift on Podium':                   'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Inertia Back Squat from Pins':                     'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Seated Leg Curl':                                  'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Leg Press':                                        'https://www.youtube.com/watch?v=PLACEHOLDER',
    'Dumbbell Romanian Deadlift (RDL)':                 'https://www.youtube.com/watch?v=PLACEHOLDER',
};
