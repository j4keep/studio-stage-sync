/**
 * Jurisdiction-aware minimum social-account age.
 * Policy must be reviewed before launching in each market.
 * Australia: age-restricted social media services must prevent accounts under 16
 * (Social Media Minimum Age, effective 10 December 2025).
 * YAJ's status as a regulated service requires separate legal assessment.
 *
 * Client validation is UX only: backend age assurance and jurisdiction enforcement
 * are required before claiming regulatory compliance.
 */
export const SUPPORTED_SIGNUP_COUNTRIES = [
  { code: "AU", label: "Australia" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
  { code: "US", label: "United States" },
  { code: "OTHER", label: "Other country / territory" },
] as const;

export type CountryCode = typeof SUPPORTED_SIGNUP_COUNTRIES[number]["code"];

export function minimumSocialAge(country: string): number {
  // Conservative default; do not claim unspecified jurisdictions allow 13-year-olds.
  return country === "AU" ? 16 : 13;
}

export function signupAgeDecision(age: number | null, country: string): {
  allowed: boolean;
  message: string;
} {
  if (!country) return { allowed: false, message: "Please select your country or territory." };
  if (country === "OTHER") return {
    allowed: false,
    message: "YAJ is not yet accepting registrations from this country. Contact support for availability.",
  };
  if (age == null || !Number.isInteger(age) || age < 0 || age > 120)
    return { allowed: false, message: "Please enter a valid date of birth." };
  const minimum = minimumSocialAge(country);
  return age < minimum
    ? { allowed: false, message: `YAJ social accounts in this country require users to be at least ${minimum}. Parental approval cannot override a legal age restriction.` }
    : { allowed: true, message: "" };
}
