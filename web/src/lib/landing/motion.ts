/**
 * Maps 0..1 scroll progress to a 0..goal word count for the journaling
 * section's pinned scroll-scrub counter. Clamps progress to [0, 1] first
 * since Framer Motion's scrollYProgress can briefly overshoot at the very
 * start/end of a pinned section.
 */
export function wordsForProgress(progress: number, goal = 750): number {
  const clamped = Math.min(Math.max(progress, 0), 1)
  return Math.round(clamped * goal)
}
