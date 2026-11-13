export type GigEstimateKind = "concrete" | "car_audio" | "duct_cleaning" | "general";

export function classifyGigEstimate(text: string): GigEstimateKind {
  const normalized = text.toLowerCase();
  if (/(?:car|vehicle|auto|honda|toyota|ford|chevrolet|chevy|accord|civic|camry|dash).{0,85}(?:radio|stereo|head[ -]?unit|back[ -]?up camera|rear[ -]?view camera|carplay|android auto)|(?:car radio|car stereo|backup camera|rearview camera|vehicle stereo|vehicle radio)/i.test(normalized)) return "car_audio";
  if (/\b(?:clean|cleaning)\s+(?:the\s+)?(?:ac\s+)?ducks\b/i.test(normalized)) return "duct_cleaning";
  if (/(?:air\s*conditioning|ac|a\/c|hvac|air)\s*(?:ceiling\s*)?(?:vent|duct)|(?:clean|cleaning|wash)\w*\s*(?:the\s*)?(?:ac\s*)?(?:duct|vent)|(?:duct|vent)\s*clean/i.test(normalized)) return "duct_cleaning";
  if (/concrete|cement|sidewalk|spall|driveway|slab|foundation crack/i.test(normalized)) return "concrete";
  return "general";
}
