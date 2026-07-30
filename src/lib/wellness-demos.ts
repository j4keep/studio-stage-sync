/**
 * YAJ Wellness demo catalog.
 *
 * Each exercise references a stable demo id. The player resolves `videoUrl`
 * (DB-ready) so AI-generated, certified-trainer, or creator clips can replace
 * demos later without UI changes.
 *
 * Until clips are uploaded, the player renders a matching instructional guide
 * (same wardrobe / lighting language) — never random stock footage.
 */

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
  /** DB / CDN field — null until a YAJ clip is uploaded. */
  videoUrl: string | null;
  posterUrl: string | null;
  /** AI generation prompt (9:16 instructional loop). */
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
    videoUrl: null,
    posterUrl: null,
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
 * Player-facing clip shape. `videoUrl` stays null until library upgrade;
 * UI reads the same fields either way.
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

export function resolveDemoClip(id: WellnessDemoId | string | null | undefined): DemoClip | null {
  const demo = getWellnessDemo(id);
  if (!demo) return null;
  return {
    id: demo.id,
    title: demo.title,
    videoUrl: demo.videoUrl,
    posterUrl: demo.posterUrl,
    guide: demo.guide,
    setting: demo.setting,
    prompt: demo.prompt,
    credit: demo.videoUrl ? "YAJ demo" : "Form guide · YAJ",
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
