/**
 * Move coach scripts — illustration + YAJ voice lines + hold countdowns.
 * Illustration stays on screen while lines play, then auto-advances.
 */

export type MoveIllustrationId =
  | "shoulders_roll"
  | "neck_left"
  | "neck_right"
  | "arms_overhead"
  | "forward_fold"
  | "hip_circles"
  | "stand_tall"
  | "walk"
  | "arm_swing"
  | "brisk_walk"
  | "cool_down"
  | "seated_march"
  | "seated_twist"
  | "ankle_circles"
  | "side_reach"
  | "sit_to_stand"
  | "march_place"
  | "wall_pushup"
  | "squat"
  | "side_steps"
  | "cool_stretch";

export type CoachStep = {
  id: string;
  title: string;
  illustration: MoveIllustrationId;
  /** Spoken coaching lines, in order. */
  lines: string[];
  /** After lines, visual+spoken countdown (e.g. hold 5). */
  holdSeconds?: number;
  /** Short bridge before the next card. */
  afterLine?: string;
  /** On-card breathing cue. */
  breathCue?: string;
  /** On-card safety tip. */
  safetyTip?: string;
};

export type CoachRoutine = {
  id: string;
  title: string;
  minutes: number;
  level: "gentle" | "beginner";
  kind: "stretch" | "walk" | "chair" | "bodyweight";
  blurb: string;
  steps: CoachStep[];
  /** Rough kcal for celebration screen. */
  caloriesPerMinute: number;
};

export const COACH_ROUTINES: CoachRoutine[] = [
  {
    id: "stretch-5",
    title: "5-minute stretch",
    minutes: 5,
    level: "gentle",
    kind: "stretch",
    blurb: "Shoulders, neck, reach, and fold — YAJ coaches every step.",
    caloriesPerMinute: 3.5,
    steps: [
      {
        id: "shoulders",
        title: "Roll shoulders",
        illustration: "shoulders_roll",
        // Keep lines short — one cue each — so voice and card stay aligned.
        lines: [
          "Feet under your hips. Arms hang loose.",
          "Roll the shoulders: forward, up, then back and down. Keep that circle going.",
        ],
        breathCue: "Easy nasal breaths — no holding",
        safetyTip: "Keep the neck soft; never force the roll",
        afterLine: "Nice. Neck next.",
      },
      {
        id: "neck-left",
        title: "Neck tilt left",
        illustration: "neck_left",
        lines: [
          "Shoulders stay down. Slowly tilt your left ear toward your left shoulder.",
        ],
        holdSeconds: 5,
        breathCue: "Slow exhale as you tilt",
        safetyTip: "Stop if you feel sharp neck pain or dizziness",
        afterLine: "Other side.",
      },
      {
        id: "neck-right",
        title: "Neck tilt right",
        illustration: "neck_right",
        lines: [
          "Now tilt your right ear toward your right shoulder. Soft and easy.",
        ],
        holdSeconds: 5,
        breathCue: "Inhale center · exhale into the tilt",
        safetyTip: "Shoulders stay down — don't hike them up",
        afterLine: "Arms next.",
      },
      {
        id: "arms-up",
        title: "Reach arms overhead",
        illustration: "arms_overhead",
        lines: [
          "Reach both arms overhead. Soft knees. Feel length through your sides.",
        ],
        holdSeconds: 8,
        breathCue: "Inhale to reach · exhale to settle",
        safetyTip: "Soft ribs — avoid arching the low back",
        afterLine: "Forward fold when you're ready.",
      },
      {
        id: "fold",
        title: "Forward fold",
        illustration: "forward_fold",
        lines: [
          "Hinge from the hips with soft knees. Let the head hang heavy — only as far as feels easy.",
        ],
        holdSeconds: 10,
        breathCue: "Long exhales as you fold",
        safetyTip: "Hinge from hips; soft knees — never lock or bounce",
        afterLine: "Wonderful work.",
      },
    ],
  },
  {
    id: "walk-10",
    title: "Easy walking plan",
    minutes: 10,
    level: "beginner",
    kind: "walk",
    blurb: "Conversational pace with posture and arm cues from YAJ.",
    caloriesPerMinute: 4.5,
    steps: [
      {
        id: "stand",
        title: "Stand tall",
        illustration: "stand_tall",
        lines: [
          "Stand tall with soft knees and relaxed shoulders.",
          "Imagine a string lifting the crown of your head.",
          "Take one easy breath in and out.",
        ],
        breathCue: "One easy breath in and out",
        safetyTip: "Soft knees — never lock the joints",
        afterLine: "When you're ready, we'll start walking.",
      },
      {
        id: "walk",
        title: "Easy walk",
        illustration: "walk",
        lines: [
          "Begin walking at a conversational pace.",
          "You should still be able to talk comfortably.",
          "Keep going — I'll check back in about a minute.",
        ],
        holdSeconds: 60,
        afterLine: "Looking good. Let's add a soft arm swing.",
      },
      {
        id: "arms",
        title: "Swing arms",
        illustration: "arm_swing",
        lines: [
          "Let your arms swing naturally opposite your legs.",
          "Keep the shoulders loose — no stiff elbows.",
          "Stay with this easy rhythm.",
        ],
        holdSeconds: 45,
        afterLine: "Optional brisk finish coming up. No sprinting.",
      },
      {
        id: "brisk",
        title: "Brisk finish",
        illustration: "brisk_walk",
        lines: [
          "Pick up the pace just a little.",
          "Still comfortable — not a race.",
          "Keep breathing steadily for about a minute.",
        ],
        holdSeconds: 60,
        afterLine: "Ease it down. Cool-down time.",
      },
      {
        id: "cool",
        title: "Cool down",
        illustration: "cool_down",
        lines: [
          "Slow your steps gradually.",
          "Roll the shoulders once or twice.",
          "Finish with one deep, easy breath.",
        ],
        holdSeconds: 20,
      },
    ],
  },
  {
    id: "chair-8",
    title: "Chair mobility",
    minutes: 8,
    level: "gentle",
    kind: "chair",
    blurb: "Seated-friendly mobility with clear holds and cues.",
    caloriesPerMinute: 3,
    steps: [
      {
        id: "marches",
        title: "Seated marches",
        illustration: "seated_march",
        lines: [
          "Sit tall near the front of your chair.",
          "Gently lift one knee, then the other — like a soft march.",
          "Keep going for about thirty seconds.",
        ],
        holdSeconds: 30,
        breathCue: "Steady breathing with each lift",
        safetyTip: "Hold the chair if you need balance",
        afterLine: "Nice rhythm. Twists next.",
      },
      {
        id: "twist",
        title: "Torso twist",
        illustration: "seated_twist",
        lines: [
          "Cross your arms loosely or rest hands on your shoulders.",
          "Rotate gently to one side, then the other.",
          "Hold each side for five seconds. Never force the spine.",
        ],
        holdSeconds: 10,
        breathCue: "Exhale into each twist",
        safetyTip: "Keep hips facing forward — never force the spine",
        afterLine: "Ankles next — small circles.",
      },
      {
        id: "ankles",
        title: "Ankle circles",
        illustration: "ankle_circles",
        lines: [
          "Lift one foot and draw slow circles with your ankle.",
          "Both directions. Then switch feet.",
          "Keep the movement smooth and easy.",
        ],
        holdSeconds: 15,
        breathCue: "Relaxed, even breaths",
        safetyTip: "Small circles only — no forcing the ankle",
        afterLine: "Side reaches coming up.",
      },
      {
        id: "side",
        title: "Side reaches",
        illustration: "side_reach",
        lines: [
          "Reach one arm overhead and lean gently to the side.",
          "Feel a soft stretch along your ribcage.",
          "Hold five seconds, then switch sides.",
        ],
        holdSeconds: 10,
        breathCue: "Inhale length · exhale into the side",
        safetyTip: "Stay seated tall — no collapsing the ribs",
        afterLine: "If you're able, sit-to-stand next. Use the chair for support.",
      },
      {
        id: "sitstand",
        title: "Sit to stand",
        illustration: "sit_to_stand",
        lines: [
          "Scoot forward, feet flat, then stand up with control.",
          "Sit back down slowly. That's one.",
          "Aim for six easy reps. Stop if anything hurts.",
        ],
        holdSeconds: 25,
        breathCue: "Exhale as you stand",
        safetyTip: "Use the chair for support; stop if anything hurts",
      },
    ],
  },
  {
    id: "beginner-12",
    title: "Beginner no-equipment",
    minutes: 12,
    level: "beginner",
    kind: "bodyweight",
    blurb: "March, wall push-ups, squats, and a gentle cool-down.",
    caloriesPerMinute: 5,
    steps: [
      {
        id: "march",
        title: "March in place",
        illustration: "march_place",
        lines: [
          "March gently in place with soft knees.",
          "Swing the arms naturally.",
          "One easy minute to warm up.",
        ],
        holdSeconds: 60,
        breathCue: "Easy breathing with the rhythm",
        safetyTip: "Land softly — no pounding the joints",
        afterLine: "Warm. Wall push-ups next — quality over speed.",
      },
      {
        id: "push",
        title: "Wall push-ups",
        illustration: "wall_pushup",
        lines: [
          "Place hands on a wall at shoulder height.",
          "Bend the elbows and press away with control.",
          "Eight comfortable reps. Breathe out as you push.",
        ],
        holdSeconds: 40,
        breathCue: "Exhale as you press away",
        safetyTip: "Keep a long spine; stop if wrists or shoulders hurt",
        afterLine: "Squats coming — shallow range is totally fine.",
      },
      {
        id: "squat",
        title: "Bodyweight squats",
        illustration: "squat",
        lines: [
          "Feet about hip-width. Chest tall.",
          "Sit back as if toward a chair — shallow is OK.",
          "Eight easy reps. No rush.",
        ],
        holdSeconds: 40,
        breathCue: "Exhale as you stand",
        safetyTip: "Shallow range is fine — knees track over toes",
        afterLine: "Side steps to keep the blood moving.",
      },
      {
        id: "side",
        title: "Side steps",
        illustration: "side_steps",
        lines: [
          "Step side to side with soft knees.",
          "Keep the chest open and arms relaxed.",
          "About forty-five seconds.",
        ],
        holdSeconds: 45,
        breathCue: "Steady conversational breaths",
        safetyTip: "Soft knees — clear space around you",
        afterLine: "Cool-down stretch to finish.",
      },
      {
        id: "cool",
        title: "Cool-down stretch",
        illustration: "cool_stretch",
        lines: [
          "Reach the arms overhead, then fold softly if it feels good.",
          "Breathe in length, breathe out ease.",
          "Hold gently for ten seconds.",
        ],
        holdSeconds: 10,
        breathCue: "Inhale length · exhale ease",
        safetyTip: "Gentle only — never bounce into a stretch",
      },
    ],
  },
];

export function getCoachRoutine(id: string | null | undefined): CoachRoutine | null {
  if (!id) return null;
  return COACH_ROUTINES.find((r) => r.id === id) ?? null;
}

export function estimateCalories(routine: CoachRoutine, minutesDone: number): number {
  return Math.max(1, Math.round(routine.caloriesPerMinute * Math.max(1, minutesDone)));
}

const STREAK_KEY = "yaj_wellness_move_streak_v1";

export function readMoveStreak(): { streak: number; lastDate: string | null } {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return { streak: 0, lastDate: null };
    const parsed = JSON.parse(raw) as { streak?: number; lastDate?: string };
    return { streak: parsed.streak ?? 0, lastDate: parsed.lastDate ?? null };
  } catch {
    return { streak: 0, lastDate: null };
  }
}

export function bumpMoveStreak(today = new Date().toISOString().slice(0, 10)): number {
  const cur = readMoveStreak();
  if (cur.lastDate === today) return cur.streak || 1;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = yesterday.toISOString().slice(0, 10);
  const next = cur.lastDate === yKey ? (cur.streak || 0) + 1 : 1;
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify({ streak: next, lastDate: today }));
  } catch {
    /* ignore */
  }
  return next;
}

export const COACH_VOICE_SPEEDS = [
  { id: "slow", label: "Slower", rate: 0.88 },
  { id: "normal", label: "Normal", rate: 1 },
  { id: "fast", label: "Faster", rate: 1.12 },
] as const;

export type CoachVoiceSpeedId = (typeof COACH_VOICE_SPEEDS)[number]["id"];
