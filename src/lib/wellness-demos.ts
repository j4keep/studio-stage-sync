/**
 * YAJ Wellness demo catalog.
 *
 * Each exercise references a stable demo id. The player resolves `videoUrl`
 * (DB-ready) so AI-generated YAJ instructor, certified-trainer, or creator
 * clips can replace demos later without UI changes.
 *
 * Current clips are real-human form demos matched to each move (not random
 * stock). Swap `videoUrl` anytime — UI stays the same.
 */

/** Real-human Mixkit form demos — replace with YAJ-hosted AI/certified clips later. */
function mixkit(id: number): { videoUrl: string; posterUrl: string } {
  return {
    videoUrl: `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`,
    posterUrl: `https://assets.mixkit.co/videos/${id}/${id}-thumb-720-0.jpg`,
  };
}

export type DemoGuideKind =
  | "shoulders_roll"
  | "neck_tilt"
  | "arms_overhead"
  | "forward_fold"
  | "hip_circles"
  | "stand_tall"
  | "walk"
  | "arm_swing"
  | "brisk_walk"
  | "cool_down_walk"
  | "seated_march"
  | "seated_twist"
  | "ankle_circles"
  | "side_reach"
  | "sit_to_stand"
  | "march_place"
  | "wall_pushup"
  | "squat"
  | "side_steps"
  | "cool_stretch"
  | "breathe_calm";

export type WellnessDemoId =
  | "stretch-shoulders"
  | "stretch-neck-tilts"
  | "stretch-arms-overhead"
  | "stretch-forward-fold"
  | "stretch-hip-circles"
  | "walk-stand-tall"
  | "walk-naturally"
  | "walk-swing-arms"
  | "walk-brisk-finish"
  | "walk-cool-down"
  | "chair-seated-marches"
  | "chair-torso-twists"
  | "chair-ankle-circles"
  | "chair-side-reaches"
  | "chair-sit-to-stand"
  | "beginner-march"
  | "beginner-wall-pushups"
  | "beginner-squats"
  | "beginner-side-steps"
  | "beginner-cool-stretch"
  | "breath-box"
  | "breath-wind-down"
  | "breath-reset";

export type WellnessDemo = {
  id: WellnessDemoId;
  title: string;
  /** DB / CDN field — swap for YAJ AI / certified / creator clips anytime. */
  videoUrl: string | null;
  posterUrl: string | null;
  /** AI generation prompt (9:16 instructional loop) for future YAJ demos. */
  prompt: string;
  guide: DemoGuideKind;
  setting: "studio" | "park";
  aspect: "9:16";
  width: 1080;
  height: 1920;
};

const STUDIO =
  "Minimal modern fitness studio, bright natural lighting, neutral colors, one instructor only, no logos, no branding, no other people, slow beginner-friendly movement, seamless 8–15 second loop, vertical 9:16, 1080×1920.";

const PARK =
  "Quiet clean park, bright natural lighting, neutral background, one person only, no logos, no branding, no distracting people, slow beginner-friendly movement, seamless 8–15 second loop, vertical 9:16, 1080×1920.";

const WARDROBE =
  "Same professional fitness instructor wearing black athletic clothing throughout.";

export const WELLNESS_DEMOS: Record<WellnessDemoId, WellnessDemo> = {
  "stretch-shoulders": {
    id: "stretch-shoulders",
    title: "Shoulder rolls",
    ...mixkit(52118), // circular arm / shoulder warm-up
    guide: "shoulders_roll",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} Inside a bright modern wellness studio slowly rolls both shoulders backward while breathing calmly. The movement repeats naturally every few seconds. Soft lighting, neutral colors, relaxed atmosphere, beginner friendly, smooth seamless loop, vertical 9:16. ${STUDIO}`,
  },
  "stretch-neck-tilts": {
    id: "stretch-neck-tilts",
    title: "Neck tilts",
    ...mixkit(5065), // neck tilts left/right — vertical
    guide: "neck_tilt",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} A wellness coach slowly tilts their head left, returns to center, tilts right, then returns to center. Calm expression, relaxed shoulders, slow controlled movement, minimalist studio background, seamless loop, vertical. ${STUDIO}`,
  },
  "stretch-arms-overhead": {
    id: "stretch-arms-overhead",
    title: "Reach arms overhead",
    ...mixkit(52119), // arms raised overhead, black athletic
    guide: "arms_overhead",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} A fitness instructor slowly raises both arms overhead while inhaling, lowers arms while exhaling. Calm breathing rhythm, soft lighting, relaxing atmosphere, seamless loop. ${STUDIO}`,
  },
  "stretch-forward-fold": {
    id: "stretch-forward-fold",
    title: "Forward fold",
    ...mixkit(4942), // seated/standing forward fold stretch — vertical
    guide: "forward_fold",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} A beginner slowly bends forward from the hips with relaxed knees, pauses comfortably, then slowly returns upright. Gentle stretching motion. Modern studio. Seamless loop. ${STUDIO}`,
  },
  "stretch-hip-circles": {
    id: "stretch-hip-circles",
    title: "Hip circles",
    ...mixkit(52138), // hip / lunge mobility warm-up
    guide: "hip_circles",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} A fitness instructor slowly rotates hips clockwise and counterclockwise with hands on hips. Relaxed pace. Beginner demonstration. Seamless loop. ${STUDIO}`,
  },
  "walk-stand-tall": {
    id: "walk-stand-tall",
    title: "Stand tall",
    ...mixkit(47418), // standing posture stretch outdoors
    guide: "stand_tall",
    setting: "park",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} A person standing in a quiet city park demonstrating perfect walking posture with relaxed shoulders and soft knees. Calm instructional loop. ${PARK}`,
  },
  "walk-naturally": {
    id: "walk-naturally",
    title: "Walk naturally",
    ...mixkit(52126), // walking/jogging park, black athletic
    guide: "walk",
    setting: "park",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} A person walking comfortably through a beautiful tree-lined park at conversational pace. Natural arm swing. Seamless loop. ${PARK}`,
  },
  "walk-swing-arms": {
    id: "walk-swing-arms",
    title: "Swing arms naturally",
    ...mixkit(52119), // natural arm reach / swing while standing tall
    guide: "arm_swing",
    setting: "park",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} Close-up demonstration of relaxed walking arm motion while maintaining posture. Calm movement. Loop. ${PARK}`,
  },
  "walk-brisk-finish": {
    id: "walk-brisk-finish",
    title: "Brisk finish",
    ...mixkit(52129), // brisk park pace in black sportswear
    guide: "brisk_walk",
    setting: "park",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} The walker increases pace slightly while maintaining good posture. Not running. Beginner friendly. Seamless loop. ${PARK}`,
  },
  "walk-cool-down": {
    id: "walk-cool-down",
    title: "Cool down",
    ...mixkit(46572), // slow down / catch breath after walk
    guide: "cool_down_walk",
    setting: "park",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} The walker slows pace naturally before stopping and taking one deep relaxing breath. Seamless loop. ${PARK}`,
  },
  "chair-seated-marches": {
    id: "chair-seated-marches",
    title: "Seated marches",
    ...mixkit(48400), // seated mobility / chair-yoga style
    guide: "seated_march",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} A senior-friendly instructor sitting in a chair slowly lifting alternating knees. Bright wellness studio. Beginner safe. Seamless loop. ${STUDIO}`,
  },
  "chair-torso-twists": {
    id: "chair-torso-twists",
    title: "Seated torso twists",
    ...mixkit(5574), // gentle spinal mobility on mat / torso
    guide: "seated_twist",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} Instructor gently rotates torso left and right while seated with hands across chest. Calm movement. Loop. ${STUDIO}`,
  },
  "chair-ankle-circles": {
    id: "chair-ankle-circles",
    title: "Ankle circles",
    ...mixkit(39568), // seated floor stretch — lower-body focus
    guide: "ankle_circles",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} Close-up of seated instructor rotating ankles slowly in both directions. Clean background. Loop. ${STUDIO}`,
  },
  "chair-side-reaches": {
    id: "chair-side-reaches",
    title: "Side reaches",
    ...mixkit(32639), // seated upper-body / side stretch
    guide: "side_reach",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} Instructor seated reaching one arm overhead toward each side with slow controlled movement. Seamless loop. ${STUDIO}`,
  },
  "chair-sit-to-stand": {
    id: "chair-sit-to-stand",
    title: "Sit to stand",
    ...mixkit(21273), // controlled sit-to-stand / squat at home
    guide: "sit_to_stand",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} Instructor slowly stands from a chair and sits back down with proper form. Beginner pace. Loop. ${STUDIO}`,
  },
  "beginner-march": {
    id: "beginner-march",
    title: "March in place",
    ...mixkit(5062), // standing in-place warm-up march / arm swing
    guide: "march_place",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} Marching gently in place with soft knees and natural arm swing. Bright wellness studio. Beginner friendly. Seamless loop. ${STUDIO}`,
  },
  "beginner-wall-pushups": {
    id: "beginner-wall-pushups",
    title: "Wall push-ups",
    ...mixkit(5351), // push-up / plank form outdoors
    guide: "wall_pushup",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} Slow wall push-ups with controlled form, elbows soft, calm breathing. Bright wellness studio. Beginner friendly. Seamless loop. ${STUDIO}`,
  },
  "beginner-squats": {
    id: "beginner-squats",
    title: "Bodyweight squats",
    ...mixkit(52116), // bodyweight squats, black athletic
    guide: "squat",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} Shallow bodyweight squats with upright chest and soft knees. Bright wellness studio. Beginner friendly. Seamless loop. ${STUDIO}`,
  },
  "beginner-side-steps": {
    id: "beginner-side-steps",
    title: "Side steps",
    ...mixkit(52112), // lateral lunge / side step pattern
    guide: "side_steps",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} Slow side steps left and right with relaxed arms. Bright wellness studio. Beginner friendly. Seamless loop. ${STUDIO}`,
  },
  "beginner-cool-stretch": {
    id: "beginner-cool-stretch",
    title: "Cool down stretch",
    ...mixkit(40132), // gentle cool-down stretch
    guide: "cool_stretch",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} Gentle cool-down stretch with arms overhead then soft forward fold. Bright wellness studio. Calm breathing. Seamless loop. ${STUDIO}`,
  },
  "breath-box": {
    id: "breath-box",
    title: "Calm breathing",
    ...mixkit(32635), // hand on chest, calm breath
    guide: "breathe_calm",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} Seated or standing calm box breathing with relaxed shoulders and soft belly rise. Bright wellness studio. Seamless loop. ${STUDIO}`,
  },
  "breath-wind-down": {
    id: "breath-wind-down",
    title: "Wind-down breathing",
    ...mixkit(32625), // calm yoga breathing at home
    guide: "breathe_calm",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} Slow wind-down breathing with longer exhales, calm expression, soft lighting. Bright wellness studio. Seamless loop. ${STUDIO}`,
  },
  "breath-reset": {
    id: "breath-reset",
    title: "Reset breathing",
    ...mixkit(32081), // breathing exercises by the lake
    guide: "breathe_calm",
    setting: "studio",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    prompt: `${WARDROBE} Short calm reset breath with gentle posture and relaxed face. Bright wellness studio. Seamless loop. ${STUDIO}`,
  },
};

/** Resolve catalog entry. Safe for unknown/future ids. */
export function getWellnessDemo(id: WellnessDemoId | string | null | undefined): WellnessDemo | null {
  if (!id) return null;
  return WELLNESS_DEMOS[id as WellnessDemoId] ?? null;
}

/**
 * Player-facing clip shape. `videoUrl` is the live demo source;
 * UI reads the same fields when library is upgraded later.
 */
export type DemoClip = {
  id: WellnessDemoId | string;
  title: string;
  videoUrl: string | null;
  posterUrl?: string | null;
  guide: DemoGuideKind;
  setting: "studio" | "park";
  credit?: string;
  prompt?: string;
};

/**
 * Player-facing clip. Illustration guide cards are the default visual —
 * stock/AI demo videos are disabled so YAJ can coach with voice + cards.
 * Re-enable a clip later via `applyDemoVideoOverrides` if needed.
 */
export function resolveDemoClip(id: WellnessDemoId | string | null | undefined): DemoClip | null {
  const demo = getWellnessDemo(id);
  if (!demo) return null;
  return {
    id: demo.id,
    title: demo.title,
    videoUrl: null,
    posterUrl: null,
    guide: demo.guide,
    setting: demo.setting,
    prompt: demo.prompt,
    credit: "Form guide",
  };
}

/**
 * Apply remote / DB overrides (e.g. from a future `wellness_demos.video_url` column)
 * without changing step definitions or player UI.
 */
export function applyDemoVideoOverrides(
  overrides: Partial<Record<WellnessDemoId, { videoUrl?: string | null; posterUrl?: string | null }>>,
) {
  for (const [id, patch] of Object.entries(overrides) as [
    WellnessDemoId,
    { videoUrl?: string | null; posterUrl?: string | null },
  ][]) {
    const demo = WELLNESS_DEMOS[id];
    if (!demo || !patch) continue;
    if (patch.videoUrl !== undefined) demo.videoUrl = patch.videoUrl;
    if (patch.posterUrl !== undefined) demo.posterUrl = patch.posterUrl;
  }
}
