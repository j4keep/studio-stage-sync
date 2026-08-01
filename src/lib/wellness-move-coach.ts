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

export type MoveCategoryId =
  | "stretch"
  | "walking"
  | "strength"
  | "mobility"
  | "balance"
  | "cardio"
  | "recovery"
  | "seniors"
  | "office"
  | "chair";

export type MuscleTarget =
  | "Neck"
  | "Shoulders"
  | "Upper Back"
  | "Core"
  | "Hips"
  | "Legs"
  | "Glutes"
  | "Ankles"
  | "Wrists"
  | "Full Body"
  | "Cardio";

export type CoachRoutine = {
  id: string;
  title: string;
  minutes: number;
  level: "gentle" | "beginner" | "moderate";
  kind: "stretch" | "walk" | "chair" | "bodyweight";
  blurb: string;
  steps: CoachStep[];
  /** Rough kcal for celebration screen. */
  caloriesPerMinute: number;
  categories: MoveCategoryId[];
  targets: MuscleTarget[];
  equipment: string[];
  tags: string[];
  /** Thumbnail illustration for library cards. */
  preview: MoveIllustrationId;
};

/** Clone a step with a unique id (for composing expanded workouts). */
export function cloneStep(step: CoachStep, idSuffix: string, patch?: Partial<CoachStep>): CoachStep {
  return { ...step, ...patch, id: `${step.id}-${idSuffix}` };
}

export const COACH_ROUTINES: CoachRoutine[] = [
  {
    id: "stretch-5",
    title: "5-Minute Stretch",
    minutes: 5,
    level: "gentle",
    kind: "stretch",
    blurb: "Shoulders, neck, reach, and fold — YAJ coaches every step.",
    caloriesPerMinute: 3.5,
    categories: ["stretch", "recovery"],
    targets: ["Neck", "Shoulders", "Upper Back"],
    equipment: ["None"],
    tags: ["morning", "full body", "neck", "shoulders", "back"],
    preview: "shoulders_roll",
    steps: [
      {
        id: "shoulders",
        title: "Roll shoulders",
        illustration: "shoulders_roll",
        // Keep lines short — one cue each — so voice and card stay aligned.
        lines: [
          "Feet under your hips. Arms hang loose by your sides.",
          "Roll both shoulders up, then back, then down in a slow circle. A few easy rolls.",
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
    title: "10-Minute Walk",
    minutes: 10,
    level: "beginner",
    kind: "walk",
    blurb: "Conversational pace with posture and arm cues from YAJ.",
    caloriesPerMinute: 4.5,
    categories: ["walking", "cardio"],
    targets: ["Legs", "Cardio", "Full Body"],
    equipment: ["None"],
    tags: ["walking", "outdoor", "indoor", "cardio", "heart"],
    preview: "walk",
    steps: [
      {
        id: "stand",
        title: "Stand tall",
        illustration: "stand_tall",
        lines: [
          "Stand tall with soft knees and relaxed shoulders.",
          "Imagine a string lifting the crown of your head.",
          "Take one easy breath in and out.",
          "When you're ready, we'll start walking.",
        ],
        breathCue: "One easy breath in and out",
        safetyTip: "Soft knees — never lock the joints",
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
    title: "Chair Mobility",
    minutes: 8,
    level: "gentle",
    kind: "chair",
    blurb: "Seated-friendly mobility with clear holds and cues.",
    caloriesPerMinute: 3,
    categories: ["chair", "mobility", "seniors", "office"],
    targets: ["Hips", "Ankles", "Core", "Shoulders"],
    equipment: ["Chair"],
    tags: ["chair", "seated", "seniors", "office", "mobility"],
    preview: "seated_march",
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
    title: "Beginner Strength",
    minutes: 12,
    level: "beginner",
    kind: "bodyweight",
    blurb: "March, wall push-ups, squats, and a gentle cool-down.",
    caloriesPerMinute: 5,
    categories: ["strength", "cardio"],
    targets: ["Full Body", "Legs", "Core", "Shoulders"],
    equipment: ["Wall"],
    tags: ["strength", "bodyweight", "beginner", "no equipment"],
    preview: "squat",
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

/** Shared step templates for composing the expanded library. */
const S = {
  shoulders: (): CoachStep => ({
    id: "shoulders",
    title: "Roll shoulders",
    illustration: "shoulders_roll",
    lines: [
      "Feet under your hips. Arms hang loose by your sides.",
      "Roll both shoulders up, then back, then down in a slow circle.",
    ],
    breathCue: "Easy nasal breaths — no holding",
    safetyTip: "Keep your shoulders relaxed.",
    afterLine: "Nice. Keep following my voice.",
  }),
  neckLeft: (): CoachStep => ({
    id: "neck-left",
    title: "Neck tilt left",
    illustration: "neck_left",
    lines: ["Shoulders stay down. Slowly tilt your left ear toward your left shoulder."],
    holdSeconds: 5,
    breathCue: "Slow exhale as you tilt",
    safetyTip: "Move only within a comfortable range.",
    afterLine: "Other side.",
  }),
  neckRight: (): CoachStep => ({
    id: "neck-right",
    title: "Neck tilt right",
    illustration: "neck_right",
    lines: ["Now tilt your right ear toward your right shoulder. Soft and easy."],
    holdSeconds: 5,
    breathCue: "Inhale center · exhale into the tilt",
    safetyTip: "Don't lock your neck — soft and easy.",
    afterLine: "Good.",
  }),
  arms: (): CoachStep => ({
    id: "arms-up",
    title: "Reach arms overhead",
    illustration: "arms_overhead",
    lines: ["Reach both arms overhead. Soft knees. Feel length through your sides."],
    holdSeconds: 8,
    breathCue: "Inhale to reach · exhale to settle",
    safetyTip: "Soft ribs — avoid arching the low back.",
  }),
  fold: (): CoachStep => ({
    id: "fold",
    title: "Forward fold",
    illustration: "forward_fold",
    lines: [
      "Hinge from the hips with soft knees. Let the head hang heavy — only as far as feels easy.",
    ],
    holdSeconds: 10,
    breathCue: "Long exhales as you fold",
    safetyTip: "Don't lock your knees.",
  }),
  hips: (): CoachStep => ({
    id: "hips",
    title: "Hip circles",
    illustration: "hip_circles",
    lines: [
      "Hands on hips. Soft knees. Draw slow circles with your hips.",
      "Both directions. Keep it smooth.",
    ],
    holdSeconds: 20,
    breathCue: "Easy breaths with each circle",
    safetyTip: "Small range is fine — no forcing.",
  }),
  stand: (): CoachStep => ({
    id: "stand",
    title: "Stand tall",
    illustration: "stand_tall",
    lines: [
      "Stand tall with soft knees and relaxed shoulders.",
      "Imagine a string lifting the crown of your head.",
    ],
    breathCue: "One easy breath in and out",
    safetyTip: "Don't lock your knees.",
  }),
  walk: (hold = 60): CoachStep => ({
    id: "walk",
    title: "Easy walk",
    illustration: "walk",
    lines: [
      "Begin walking at a conversational pace.",
      "You should still be able to talk comfortably.",
    ],
    holdSeconds: hold,
    afterLine: "Looking good.",
  }),
  armsSwing: (hold = 45): CoachStep => ({
    id: "arms-swing",
    title: "Swing arms",
    illustration: "arm_swing",
    lines: [
      "Let your arms swing naturally opposite your legs.",
      "Keep the shoulders loose — no stiff elbows.",
    ],
    holdSeconds: hold,
  }),
  brisk: (hold = 60): CoachStep => ({
    id: "brisk",
    title: "Brisk finish",
    illustration: "brisk_walk",
    lines: [
      "Pick up the pace just a little.",
      "Still comfortable — not a race.",
    ],
    holdSeconds: hold,
  }),
  coolWalk: (): CoachStep => ({
    id: "cool-walk",
    title: "Cool down",
    illustration: "cool_down",
    lines: [
      "Slow your steps gradually.",
      "Roll the shoulders once or twice.",
      "Finish with one deep, easy breath.",
    ],
    holdSeconds: 20,
  }),
  seatedMarch: (): CoachStep => ({
    id: "seated-march",
    title: "Seated marches",
    illustration: "seated_march",
    lines: [
      "Sit tall near the front of your chair.",
      "Gently lift one knee, then the other — like a soft march.",
    ],
    holdSeconds: 30,
    safetyTip: "Hold the chair if you need balance.",
  }),
  twist: (): CoachStep => ({
    id: "twist",
    title: "Torso twist",
    illustration: "seated_twist",
    lines: [
      "Rotate gently to one side, then the other.",
      "Never force the spine.",
    ],
    holdSeconds: 10,
    safetyTip: "Keep hips facing forward.",
  }),
  ankles: (): CoachStep => ({
    id: "ankles",
    title: "Ankle circles",
    illustration: "ankle_circles",
    lines: [
      "Lift one foot and draw slow circles with your ankle.",
      "Both directions. Then switch feet.",
    ],
    holdSeconds: 15,
    safetyTip: "Small circles only.",
  }),
  sideReach: (): CoachStep => ({
    id: "side",
    title: "Side reaches",
    illustration: "side_reach",
    lines: [
      "Reach one arm overhead and lean gently to the side.",
      "Hold, then switch sides.",
    ],
    holdSeconds: 10,
    safetyTip: "Stay tall — no collapsing the ribs.",
  }),
  sitStand: (): CoachStep => ({
    id: "sitstand",
    title: "Sit to stand",
    illustration: "sit_to_stand",
    lines: [
      "Feet flat, then stand up with control.",
      "Sit back down slowly. Aim for a few easy reps.",
    ],
    holdSeconds: 25,
    safetyTip: "Use the chair for support.",
  }),
  march: (hold = 45): CoachStep => ({
    id: "march",
    title: "March in place",
    illustration: "march_place",
    lines: ["March gently in place with soft knees.", "Swing the arms naturally."],
    holdSeconds: hold,
    safetyTip: "Land softly — no pounding the joints.",
  }),
  wallPush: (): CoachStep => ({
    id: "push",
    title: "Wall push-ups",
    illustration: "wall_pushup",
    lines: [
      "Hands on a wall at shoulder height.",
      "Bend the elbows and press away with control.",
    ],
    holdSeconds: 35,
    safetyTip: "Stop if wrists or shoulders hurt.",
  }),
  squat: (): CoachStep => ({
    id: "squat",
    title: "Bodyweight squats",
    illustration: "squat",
    lines: [
      "Feet about hip-width. Chest tall.",
      "Sit back as if toward a chair — shallow is OK.",
    ],
    holdSeconds: 35,
    safetyTip: "Don't lock your knees at the top.",
  }),
  sideSteps: (): CoachStep => ({
    id: "side-steps",
    title: "Side steps",
    illustration: "side_steps",
    lines: ["Step side to side with soft knees.", "Keep the chest open and arms relaxed."],
    holdSeconds: 40,
    safetyTip: "Clear space around you.",
  }),
  coolStretch: (): CoachStep => ({
    id: "cool-stretch",
    title: "Cool-down stretch",
    illustration: "cool_stretch",
    lines: [
      "Reach the arms overhead, then fold softly if it feels good.",
      "Hold gently.",
    ],
    holdSeconds: 10,
    safetyTip: "Gentle only — never bounce into a stretch.",
  }),
  balance: (): CoachStep => ({
    id: "balance",
    title: "Single-leg balance",
    illustration: "stand_tall",
    lines: [
      "Shift weight onto one foot. Soft knee.",
      "Lift the other foot slightly. Hold near a wall or chair if you need.",
    ],
    holdSeconds: 20,
    safetyTip: "Use support — stability over pride.",
    afterLine: "Switch sides when you're ready.",
  }),
};

function R(
  partial: Omit<CoachRoutine, "steps"> & { steps: CoachStep[] },
): CoachRoutine {
  return partial;
}

function withIds(suffix: string, steps: CoachStep[]): CoachStep[] {
  return steps.map((step, i) => cloneStep(step, `${suffix}${i}`));
}

/** Expanded guided library — reuses YAJ illustrations and coaching style. */
export const EXTRA_COACH_ROUTINES: CoachRoutine[] = [
  R({
    id: "morning-stretch",
    title: "Morning Stretch",
    minutes: 6,
    level: "gentle",
    kind: "stretch",
    blurb: "Wake up the spine, shoulders, and hips.",
    caloriesPerMinute: 3.2,
    categories: ["stretch"],
    targets: ["Shoulders", "Neck", "Hips", "Upper Back"],
    equipment: ["None"],
    tags: ["morning", "stretch", "wake up"],
    preview: "arms_overhead",
    steps: withIds("ms", [S.stand(), S.shoulders(), S.neckLeft(), S.neckRight(), S.arms(), S.hips()]),
  }),
  R({
    id: "evening-stretch",
    title: "Evening Stretch",
    minutes: 7,
    level: "gentle",
    kind: "stretch",
    blurb: "Unwind the day with soft folds and releases.",
    caloriesPerMinute: 3,
    categories: ["stretch", "recovery"],
    targets: ["Upper Back", "Hips", "Shoulders", "Legs"],
    equipment: ["None"],
    tags: ["evening", "stretch", "wind down"],
    preview: "forward_fold",
    steps: withIds("es", [S.shoulders(), S.arms(), S.sideReach(), S.hips(), S.fold(), S.coolStretch()]),
  }),
  R({
    id: "desk-stretch",
    title: "Desk Stretch",
    minutes: 5,
    level: "gentle",
    kind: "chair",
    blurb: "Reset after sitting — neck, shoulders, and sides.",
    caloriesPerMinute: 2.8,
    categories: ["stretch", "office", "chair"],
    targets: ["Neck", "Shoulders", "Upper Back"],
    equipment: ["Chair"],
    tags: ["desk", "office", "neck", "shoulders"],
    preview: "seated_twist",
    steps: withIds("ds", [S.seatedMarch(), S.shoulders(), S.neckLeft(), S.neckRight(), S.twist(), S.sideReach()]),
  }),
  R({
    id: "upper-body-stretch",
    title: "Upper Body Stretch",
    minutes: 6,
    level: "beginner",
    kind: "stretch",
    blurb: "Open the chest, neck, and shoulders.",
    caloriesPerMinute: 3.3,
    categories: ["stretch"],
    targets: ["Neck", "Shoulders", "Upper Back"],
    equipment: ["None"],
    tags: ["upper body", "shoulders", "neck"],
    preview: "shoulders_roll",
    steps: withIds("ub", [S.shoulders(), S.neckLeft(), S.neckRight(), S.arms(), S.sideReach(), S.coolStretch()]),
  }),
  R({
    id: "lower-body-stretch",
    title: "Lower Body Stretch",
    minutes: 6,
    level: "beginner",
    kind: "stretch",
    blurb: "Hips, legs, and an easy fold.",
    caloriesPerMinute: 3.4,
    categories: ["stretch"],
    targets: ["Hips", "Legs", "Glutes"],
    equipment: ["None"],
    tags: ["lower body", "hips", "legs", "lower back"],
    preview: "hip_circles",
    steps: withIds("lb", [S.stand(), S.hips(), S.sideSteps(), S.fold(), S.coolStretch()]),
  }),
  R({
    id: "full-body-stretch",
    title: "Full Body Stretch",
    minutes: 8,
    level: "beginner",
    kind: "stretch",
    blurb: "A complete gentle stretch from neck to ankles.",
    caloriesPerMinute: 3.5,
    categories: ["stretch"],
    targets: ["Full Body", "Neck", "Shoulders", "Hips", "Legs"],
    equipment: ["None"],
    tags: ["full body", "stretch"],
    preview: "cool_stretch",
    steps: withIds("fb", [
      S.shoulders(),
      S.neckLeft(),
      S.neckRight(),
      S.arms(),
      S.hips(),
      S.fold(),
      S.ankles(),
      S.coolStretch(),
    ]),
  }),
  R({
    id: "neck-relief",
    title: "Neck Relief",
    minutes: 4,
    level: "gentle",
    kind: "stretch",
    blurb: "Soft tilts and shoulder rolls for a tight neck.",
    caloriesPerMinute: 2.5,
    categories: ["stretch", "office", "recovery"],
    targets: ["Neck", "Shoulders"],
    equipment: ["None"],
    tags: ["neck", "relief", "office"],
    preview: "neck_left",
    steps: withIds("nr", [S.shoulders(), S.neckLeft(), S.neckRight(), S.shoulders()]),
  }),
  R({
    id: "shoulder-release",
    title: "Shoulder Release",
    minutes: 5,
    level: "gentle",
    kind: "stretch",
    blurb: "Loosen stiff shoulders with rolls and reaches.",
    caloriesPerMinute: 2.8,
    categories: ["stretch", "office", "recovery"],
    targets: ["Shoulders", "Upper Back"],
    equipment: ["None"],
    tags: ["shoulders", "release", "upper back"],
    preview: "shoulders_roll",
    steps: withIds("sr", [S.shoulders(), S.arms(), S.sideReach(), S.shoulders(), S.coolStretch()]),
  }),
  R({
    id: "hip-mobility",
    title: "Hip Mobility",
    minutes: 6,
    level: "beginner",
    kind: "stretch",
    blurb: "Circles and soft steps to free the hips.",
    caloriesPerMinute: 3.6,
    categories: ["mobility", "stretch"],
    targets: ["Hips", "Glutes", "Legs"],
    equipment: ["None"],
    tags: ["hips", "mobility", "lower back"],
    preview: "hip_circles",
    steps: withIds("hm", [S.stand(), S.hips(), S.sideSteps(), S.hips(), S.fold()]),
  }),
  R({
    id: "back-relief",
    title: "Back Relief",
    minutes: 6,
    level: "gentle",
    kind: "stretch",
    blurb: "Ease upper and mid-back tension.",
    caloriesPerMinute: 3,
    categories: ["stretch", "recovery"],
    targets: ["Upper Back", "Shoulders", "Core"],
    equipment: ["None"],
    tags: ["back", "lower back", "relief"],
    preview: "forward_fold",
    steps: withIds("br", [S.shoulders(), S.twist(), S.sideReach(), S.fold(), S.coolStretch()]),
  }),
  R({
    id: "walk-20",
    title: "20-Minute Walk",
    minutes: 20,
    level: "beginner",
    kind: "walk",
    blurb: "Longer easy walk with posture and arm cues.",
    caloriesPerMinute: 4.6,
    categories: ["walking", "cardio"],
    targets: ["Legs", "Cardio", "Full Body"],
    equipment: ["None"],
    tags: ["walking", "20 minute", "cardio"],
    preview: "brisk_walk",
    steps: withIds("w20", [
      S.stand(),
      S.walk(90),
      S.armsSwing(60),
      S.walk(90),
      S.brisk(90),
      S.coolWalk(),
    ]),
  }),
  R({
    id: "indoor-walk",
    title: "Indoor Walking",
    minutes: 8,
    level: "gentle",
    kind: "walk",
    blurb: "Hallway or living-room friendly walking cues.",
    caloriesPerMinute: 4,
    categories: ["walking", "cardio"],
    targets: ["Legs", "Cardio"],
    equipment: ["None"],
    tags: ["indoor", "walking", "home"],
    preview: "walk",
    steps: withIds("iw", [S.stand(), S.walk(50), S.armsSwing(40), S.march(40), S.coolWalk()]),
  }),
  R({
    id: "outdoor-walk",
    title: "Outdoor Walking",
    minutes: 12,
    level: "beginner",
    kind: "walk",
    blurb: "Fresh-air pace with a light brisk finish.",
    caloriesPerMinute: 4.8,
    categories: ["walking", "cardio"],
    targets: ["Legs", "Cardio", "Full Body"],
    equipment: ["None"],
    tags: ["outdoor", "walking"],
    preview: "walk",
    steps: withIds("ow", [S.stand(), S.walk(70), S.armsSwing(50), S.brisk(70), S.coolWalk()]),
  }),
  R({
    id: "recovery-walk",
    title: "Recovery Walk",
    minutes: 8,
    level: "gentle",
    kind: "walk",
    blurb: "Slow, restorative walking — no rush.",
    caloriesPerMinute: 3.5,
    categories: ["walking", "recovery"],
    targets: ["Legs", "Cardio"],
    equipment: ["None"],
    tags: ["recovery", "walking", "easy"],
    preview: "cool_down",
    steps: withIds("rw", [S.stand(), S.walk(70), S.armsSwing(40), S.coolWalk()]),
  }),
  R({
    id: "brisk-walk",
    title: "Brisk Walk",
    minutes: 12,
    level: "moderate",
    kind: "walk",
    blurb: "Elevate the heart rate with guided brisk intervals.",
    caloriesPerMinute: 5.5,
    categories: ["walking", "cardio"],
    targets: ["Cardio", "Legs", "Full Body"],
    equipment: ["None"],
    tags: ["brisk", "cardio", "heart"],
    preview: "brisk_walk",
    steps: withIds("bw", [S.stand(), S.walk(45), S.brisk(70), S.armsSwing(40), S.brisk(70), S.coolWalk()]),
  }),
  R({
    id: "post-meal-walk",
    title: "Post Meal Walk",
    minutes: 8,
    level: "gentle",
    kind: "walk",
    blurb: "Gentle walk after eating — keep it easy.",
    caloriesPerMinute: 3.8,
    categories: ["walking", "recovery"],
    targets: ["Legs", "Cardio"],
    equipment: ["None"],
    tags: ["post meal", "walking", "digestion"],
    preview: "walk",
    steps: withIds("pm", [S.stand(), S.walk(80), S.armsSwing(35), S.coolWalk()]),
  }),
  R({
    id: "heart-walk",
    title: "Heart Healthy Walk",
    minutes: 15,
    level: "beginner",
    kind: "walk",
    blurb: "Steady cardio with warm-up and cool-down.",
    caloriesPerMinute: 5,
    categories: ["walking", "cardio"],
    targets: ["Cardio", "Legs", "Full Body"],
    equipment: ["None"],
    tags: ["heart", "cardio", "walking"],
    preview: "brisk_walk",
    steps: withIds("hw", [
      S.stand(),
      S.walk(60),
      S.armsSwing(45),
      S.brisk(80),
      S.walk(60),
      S.coolWalk(),
    ]),
  }),
  R({
    id: "bodyweight-circuit",
    title: "Bodyweight Circuit",
    minutes: 14,
    level: "moderate",
    kind: "bodyweight",
    blurb: "March, push, squat, and side steps — quality over speed.",
    caloriesPerMinute: 5.5,
    categories: ["strength", "cardio"],
    targets: ["Full Body", "Legs", "Core", "Shoulders"],
    equipment: ["Wall"],
    tags: ["circuit", "strength", "bodyweight"],
    preview: "wall_pushup",
    steps: withIds("bc", [
      S.march(50),
      S.wallPush(),
      S.squat(),
      S.sideSteps(),
      S.wallPush(),
      S.squat(),
      S.coolStretch(),
    ]),
  }),
  R({
    id: "core-strength",
    title: "Core Strength",
    minutes: 8,
    level: "beginner",
    kind: "bodyweight",
    blurb: "Gentle core engagement with marches and stands.",
    caloriesPerMinute: 4.2,
    categories: ["strength"],
    targets: ["Core", "Full Body"],
    equipment: ["None"],
    tags: ["core", "strength", "abs"],
    preview: "march_place",
    steps: withIds("cs", [S.stand(), S.march(50), S.sitStand(), S.sideReach(), S.coolStretch()]),
  }),
  R({
    id: "upper-strength",
    title: "Upper Body Strength",
    minutes: 10,
    level: "beginner",
    kind: "bodyweight",
    blurb: "Wall push-ups and posture work for the upper body.",
    caloriesPerMinute: 4.5,
    categories: ["strength"],
    targets: ["Shoulders", "Upper Back", "Core"],
    equipment: ["Wall"],
    tags: ["upper body", "strength", "push"],
    preview: "wall_pushup",
    steps: withIds("us", [S.shoulders(), S.wallPush(), S.arms(), S.wallPush(), S.coolStretch()]),
  }),
  R({
    id: "lower-strength",
    title: "Lower Body Strength",
    minutes: 10,
    level: "beginner",
    kind: "bodyweight",
    blurb: "Squats, marches, and side steps for strong legs.",
    caloriesPerMinute: 5,
    categories: ["strength"],
    targets: ["Legs", "Glutes", "Hips"],
    equipment: ["None"],
    tags: ["lower body", "legs", "strength", "knees"],
    preview: "squat",
    steps: withIds("ls", [S.march(40), S.squat(), S.sideSteps(), S.squat(), S.coolStretch()]),
  }),
  R({
    id: "full-strength",
    title: "Full Body Strength",
    minutes: 12,
    level: "moderate",
    kind: "bodyweight",
    blurb: "Balanced beginner circuit for the whole body.",
    caloriesPerMinute: 5.2,
    categories: ["strength"],
    targets: ["Full Body", "Legs", "Shoulders", "Core"],
    equipment: ["Wall"],
    tags: ["full body", "strength"],
    preview: "squat",
    steps: withIds("fs", [
      S.march(40),
      S.wallPush(),
      S.squat(),
      S.sideSteps(),
      S.sitStand(),
      S.coolStretch(),
    ]),
  }),
  R({
    id: "chair-strength",
    title: "Chair Strength",
    minutes: 9,
    level: "gentle",
    kind: "chair",
    blurb: "Seated and sit-to-stand strength with support.",
    caloriesPerMinute: 3.5,
    categories: ["strength", "chair", "seniors"],
    targets: ["Legs", "Core", "Glutes"],
    equipment: ["Chair"],
    tags: ["chair", "strength", "seniors"],
    preview: "sit_to_stand",
    steps: withIds("chs", [S.seatedMarch(), S.sitStand(), S.twist(), S.sitStand(), S.ankles()]),
  }),
  R({
    id: "mobility-hips",
    title: "Hip Mobility Flow",
    minutes: 7,
    level: "beginner",
    kind: "stretch",
    blurb: "Open the hips with circles and gentle steps.",
    caloriesPerMinute: 3.4,
    categories: ["mobility"],
    targets: ["Hips", "Glutes", "Legs"],
    equipment: ["None"],
    tags: ["mobility", "hips"],
    preview: "hip_circles",
    steps: withIds("mh", [S.stand(), S.hips(), S.sideSteps(), S.hips(), S.fold()]),
  }),
  R({
    id: "ankle-mobility",
    title: "Ankle Mobility",
    minutes: 5,
    level: "gentle",
    kind: "chair",
    blurb: "Circles and marches to free stiff ankles.",
    caloriesPerMinute: 2.5,
    categories: ["mobility", "chair"],
    targets: ["Ankles", "Legs"],
    equipment: ["Chair"],
    tags: ["ankles", "mobility", "knees"],
    preview: "ankle_circles",
    steps: withIds("am", [S.seatedMarch(), S.ankles(), S.sitStand(), S.ankles()]),
  }),
  R({
    id: "shoulder-mobility",
    title: "Shoulder Mobility",
    minutes: 6,
    level: "gentle",
    kind: "stretch",
    blurb: "Rolls and reaches for freer shoulders.",
    caloriesPerMinute: 2.8,
    categories: ["mobility", "stretch"],
    targets: ["Shoulders", "Upper Back"],
    equipment: ["None"],
    tags: ["shoulders", "mobility"],
    preview: "shoulders_roll",
    steps: withIds("shm", [S.shoulders(), S.arms(), S.sideReach(), S.shoulders(), S.coolStretch()]),
  }),
  R({
    id: "spinal-mobility",
    title: "Spinal Mobility",
    minutes: 6,
    level: "gentle",
    kind: "chair",
    blurb: "Gentle twists and side bends for the spine.",
    caloriesPerMinute: 2.8,
    categories: ["mobility", "chair"],
    targets: ["Upper Back", "Core"],
    equipment: ["Chair"],
    tags: ["spine", "back", "mobility"],
    preview: "seated_twist",
    steps: withIds("spm", [S.seatedMarch(), S.twist(), S.sideReach(), S.twist(), S.coolStretch()]),
  }),
  R({
    id: "joint-mobility",
    title: "Joint Mobility",
    minutes: 8,
    level: "gentle",
    kind: "stretch",
    blurb: "Move major joints through an easy range.",
    caloriesPerMinute: 3,
    categories: ["mobility", "seniors"],
    targets: ["Full Body", "Ankles", "Hips", "Shoulders"],
    equipment: ["None"],
    tags: ["joints", "mobility", "seniors"],
    preview: "hip_circles",
    steps: withIds("jm", [
      S.shoulders(),
      S.ankles(),
      S.hips(),
      S.sideReach(),
      S.march(30),
      S.coolStretch(),
    ]),
  }),
  R({
    id: "senior-mobility",
    title: "Senior Mobility",
    minutes: 8,
    level: "gentle",
    kind: "chair",
    blurb: "Safe, supported mobility for everyday ease.",
    caloriesPerMinute: 2.8,
    categories: ["mobility", "seniors", "chair"],
    targets: ["Full Body", "Hips", "Ankles", "Shoulders"],
    equipment: ["Chair"],
    tags: ["seniors", "mobility", "gentle"],
    preview: "seated_march",
    steps: withIds("sm", [
      S.seatedMarch(),
      S.shoulders(),
      S.ankles(),
      S.twist(),
      S.sitStand(),
      S.coolStretch(),
    ]),
  }),
  R({
    id: "beginner-balance",
    title: "Beginner Balance",
    minutes: 5,
    level: "gentle",
    kind: "bodyweight",
    blurb: "Build confidence with supported balance holds.",
    caloriesPerMinute: 2.5,
    categories: ["balance", "seniors"],
    targets: ["Legs", "Core", "Ankles"],
    equipment: ["Chair"],
    tags: ["balance", "beginner", "fall prevention"],
    preview: "stand_tall",
    steps: withIds("bb", [S.stand(), S.balance(), S.sideSteps(), S.balance(), S.coolStretch()]),
  }),
  R({
    id: "single-leg-balance",
    title: "Single Leg Balance",
    minutes: 6,
    level: "beginner",
    kind: "bodyweight",
    blurb: "Focused single-leg stability practice.",
    caloriesPerMinute: 2.8,
    categories: ["balance"],
    targets: ["Legs", "Ankles", "Core"],
    equipment: ["None"],
    tags: ["balance", "single leg", "stability"],
    preview: "stand_tall",
    steps: withIds("slb", [S.stand(), S.balance(), S.march(30), S.balance(), S.coolStretch()]),
  }),
  R({
    id: "stability-training",
    title: "Stability Training",
    minutes: 8,
    level: "beginner",
    kind: "bodyweight",
    blurb: "Side steps and balance holds for steadiness.",
    caloriesPerMinute: 3.2,
    categories: ["balance", "strength"],
    targets: ["Legs", "Core", "Glutes"],
    equipment: ["None"],
    tags: ["stability", "balance"],
    preview: "side_steps",
    steps: withIds("st", [S.march(35), S.sideSteps(), S.balance(), S.squat(), S.coolStretch()]),
  }),
  R({
    id: "fall-prevention",
    title: "Fall Prevention",
    minutes: 8,
    level: "gentle",
    kind: "chair",
    blurb: "Practical strength and balance with chair support.",
    caloriesPerMinute: 3,
    categories: ["balance", "seniors", "chair"],
    targets: ["Legs", "Core", "Ankles"],
    equipment: ["Chair"],
    tags: ["fall prevention", "seniors", "balance"],
    preview: "sit_to_stand",
    steps: withIds("fp", [
      S.seatedMarch(),
      S.sitStand(),
      S.ankles(),
      S.balance(),
      S.sitStand(),
      S.coolStretch(),
    ]),
  }),
  R({
    id: "senior-balance",
    title: "Senior Balance",
    minutes: 7,
    level: "gentle",
    kind: "chair",
    blurb: "Gentle balance and sit-to-stand for daily confidence.",
    caloriesPerMinute: 2.8,
    categories: ["balance", "seniors", "chair"],
    targets: ["Legs", "Core"],
    equipment: ["Chair"],
    tags: ["seniors", "balance"],
    preview: "stand_tall",
    steps: withIds("seb", [S.seatedMarch(), S.stand(), S.balance(), S.sitStand(), S.coolStretch()]),
  }),
  R({
    id: "recovery-flow",
    title: "Recovery Flow",
    minutes: 7,
    level: "gentle",
    kind: "stretch",
    blurb: "Soft movement to help the body settle.",
    caloriesPerMinute: 2.6,
    categories: ["recovery", "stretch"],
    targets: ["Full Body", "Shoulders", "Hips"],
    equipment: ["None"],
    tags: ["recovery", "cool down"],
    preview: "cool_stretch",
    steps: withIds("rf", [S.shoulders(), S.hips(), S.sideReach(), S.fold(), S.coolStretch()]),
  }),
  R({
    id: "gentle-cool-down",
    title: "Gentle Cool Down",
    minutes: 5,
    level: "gentle",
    kind: "stretch",
    blurb: "Finish any day with an easy cool-down.",
    caloriesPerMinute: 2.4,
    categories: ["recovery", "stretch"],
    targets: ["Full Body"],
    equipment: ["None"],
    tags: ["cool down", "recovery"],
    preview: "cool_down",
    steps: withIds("gcd", [S.coolWalk(), S.shoulders(), S.fold(), S.coolStretch()]),
  }),
  R({
    id: "muscle-recovery",
    title: "Muscle Recovery",
    minutes: 8,
    level: "gentle",
    kind: "stretch",
    blurb: "Longer holds to ease worked muscles.",
    caloriesPerMinute: 2.5,
    categories: ["recovery"],
    targets: ["Legs", "Shoulders", "Hips", "Upper Back"],
    equipment: ["None"],
    tags: ["muscle recovery", "stretch", "foam"],
    preview: "forward_fold",
    steps: withIds("mr", [
      S.shoulders(),
      S.arms(),
      S.hips(),
      { ...S.fold(), holdSeconds: 15 },
      S.coolStretch(),
    ]),
  }),
  R({
    id: "post-workout-stretch",
    title: "Post Workout Stretch",
    minutes: 6,
    level: "gentle",
    kind: "stretch",
    blurb: "The stretch to do after any workout.",
    caloriesPerMinute: 2.6,
    categories: ["recovery", "stretch"],
    targets: ["Full Body", "Legs", "Shoulders"],
    equipment: ["None"],
    tags: ["post workout", "stretch", "recovery"],
    preview: "arms_overhead",
    steps: withIds("pws", [S.arms(), S.shoulders(), S.hips(), S.fold(), S.coolStretch()]),
  }),
  R({
    id: "desk-break-5",
    title: "5-Minute Desk Break",
    minutes: 5,
    level: "gentle",
    kind: "chair",
    blurb: "Quick reset between meetings.",
    caloriesPerMinute: 2.7,
    categories: ["office", "chair", "stretch"],
    targets: ["Neck", "Shoulders", "Wrists", "Upper Back"],
    equipment: ["Chair"],
    tags: ["desk", "office", "break", "wrists"],
    preview: "seated_march",
    steps: withIds("db5", [S.seatedMarch(), S.shoulders(), S.neckLeft(), S.neckRight(), S.sideReach()]),
  }),
  R({
    id: "office-neck-reset",
    title: "Office Neck Reset",
    minutes: 4,
    level: "gentle",
    kind: "stretch",
    blurb: "Screen-time neck relief in a few minutes.",
    caloriesPerMinute: 2.3,
    categories: ["office", "stretch"],
    targets: ["Neck", "Shoulders"],
    equipment: ["None"],
    tags: ["office", "neck", "screen"],
    preview: "neck_right",
    steps: withIds("onr", [S.shoulders(), S.neckLeft(), S.neckRight(), S.shoulders()]),
  }),
  R({
    id: "shoulder-reset",
    title: "Shoulder Reset",
    minutes: 4,
    level: "gentle",
    kind: "stretch",
    blurb: "Drop the tension from typing and scrolling.",
    caloriesPerMinute: 2.4,
    categories: ["office", "stretch"],
    targets: ["Shoulders", "Upper Back"],
    equipment: ["None"],
    tags: ["office", "shoulders", "typing"],
    preview: "shoulders_roll",
    steps: withIds("shr", [S.shoulders(), S.arms(), S.sideReach(), S.shoulders()]),
  }),
  R({
    id: "standing-break",
    title: "Standing Break",
    minutes: 5,
    level: "gentle",
    kind: "bodyweight",
    blurb: "Stand, march, and open up after sitting.",
    caloriesPerMinute: 3.2,
    categories: ["office", "cardio"],
    targets: ["Legs", "Full Body", "Cardio"],
    equipment: ["None"],
    tags: ["office", "standing", "break"],
    preview: "march_place",
    steps: withIds("stb", [S.stand(), S.march(40), S.sideSteps(), S.shoulders(), S.coolStretch()]),
  }),
  R({
    id: "wrist-relief",
    title: "Typing Wrist Relief",
    minutes: 4,
    level: "gentle",
    kind: "chair",
    blurb: "Shoulders and arms soft — ease typing tension.",
    caloriesPerMinute: 2.2,
    categories: ["office", "recovery", "chair"],
    targets: ["Wrists", "Shoulders", "Neck"],
    equipment: ["Chair"],
    tags: ["wrists", "typing", "office"],
    preview: "shoulders_roll",
    steps: withIds("wr", [
      S.shoulders(),
      {
        id: "wrist-circles",
        title: "Wrist circles",
        illustration: "arms_overhead",
        lines: [
          "Extend your arms softly. Circle the wrists slowly both ways.",
          "Shake the hands out gently when you're done.",
        ],
        holdSeconds: 15,
        safetyTip: "Tiny circles — stop if you feel sharp pain.",
      },
      S.neckLeft(),
      S.neckRight(),
    ]),
  }),
];

// Merge core + expanded library once.
COACH_ROUTINES.push(...EXTRA_COACH_ROUTINES);

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
