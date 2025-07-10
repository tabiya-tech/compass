//  this is in a file of its own instead of in the CustomerSatisfaction.tsx to avoid circular dependencies
// since the question id is used in multiple places, including perhaps in the userPreferencesStateService
// which children of this component might import...
export const CUSTOMER_SATISFACTION_QUESTION_KEY = "satisfaction_with_compass";