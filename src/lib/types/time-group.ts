/**
 * Time group enum for thread categorization
 */
export enum TimeGroup {
	TODAY = "today",
	YESTERDAY = "yesterday",
	LAST_7_DAYS = "last7days",
	LAST_30_DAYS = "last30days",
	EARLIER = "earlier",
}

/**
 * All time group values in display order
 */
export const TIME_GROUP_ORDER = [
	TimeGroup.TODAY,
	TimeGroup.YESTERDAY,
	TimeGroup.LAST_7_DAYS,
	TimeGroup.LAST_30_DAYS,
	TimeGroup.EARLIER,
] as const;
