// Get current date key based on 8AM reset rule
export const getCurrentDateKey = (timezone: string = "America/New_York"): string => {
  const now = new Date();
  const userTime = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  const hour = userTime.getHours();
  
  // If before 8AM, use previous day
  if (hour < 8) {
    userTime.setDate(userTime.getDate() - 1);
  }
  
  return userTime.toISOString().split("T")[0];
};

// Get year-month key for monthly progress
export const getYearMonthKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

// Calculate days elapsed in current month
export const getDaysElapsedInMonth = (): number => {
  const now = new Date();
  return now.getDate();
};

// Calculate total days in current month
export const getTotalDaysInMonth = (): number => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
};
