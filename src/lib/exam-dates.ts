// Official GATE 2027 exam dates — IIT Madras (gate2027.iitm.ac.in)
// Exams: Feb 6, 7, 13, 14, 20, 21, 2027. Paper-specific slot via admit card.
// CS: first weekend (Feb 7 forenoon 9:30 AM IST). DA: second weekend (Feb 15 forenoon).
// 9:30 AM IST = 04:00 UTC. Centralized here so the dashboard, sprint banner, and
// analytics routes all share one source of truth.

export const GATE_CS_DATE = new Date('2027-02-07T04:00:00Z') // 9:30 AM IST = 04:00 UTC
export const GATE_DA_DATE = new Date('2027-02-15T04:00:00Z') // 9:30 AM IST = 04:00 UTC

/** When daysRemaining <= this, the last-month Sprint Mode activates. */
export const SPRINT_THRESHOLD_DAYS = 30
