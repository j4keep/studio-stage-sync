export type GigEstimateKind = "concrete" | "car_audio" | "general";

export function classifyGigEstimate(text: string): GigEstimateKind {
  const normalized = text.toLowerCase();
  if (/(?:car|vehicle|auto|honda|toyota|ford|chevrolet|chevy|accord|civic|camry|dash).{0,85}(?:radio|stereo|head[ -]?unit|back[ -]?up camera|rear[ -]?view camera|carplay|android auto)|(?:car radio|car stereo|backup camera|rearview camera|vehicle stereo|vehicle radio)/i.test(normalized)) return "car_audio";
  if (/concrete|cement|sidewalk|spall|driveway|slab|foundation crack/i.test(normalized)) return "concrete";
  return "general";
}
