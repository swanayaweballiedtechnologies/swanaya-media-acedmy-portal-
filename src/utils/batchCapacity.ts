/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Batch, Student } from '../db/mockDb';

export interface BatchOccupancy {
  batch: Batch;
  enrolledCount: number;
  maxCapacity: number;
  seatsRemaining: number;
  isFull: boolean;
}

export interface BatchSuggestionResult {
  batch: Batch | null;
  batchId: string;
  enrolledCount: number;
  maxCapacity: number;
  seatsRemaining: number;
  hasOpenSeats: boolean;
  isCourseMatch: boolean;
  reason: string;
}

export function getBatchOccupancy(
  batch: Batch,
  students: Student[],
  excludeStudentId?: string
): BatchOccupancy {
  const enrolledCount = students.filter(
    (s) =>
      s.batchId === batch.id &&
      s.status !== 'INACTIVE' &&
      (!excludeStudentId || s.id !== excludeStudentId)
  ).length;
  const maxCapacity = Math.max(1, Number(batch.maxCapacity ?? 30));
  const seatsRemaining = Math.max(0, maxCapacity - enrolledCount);
  return {
    batch,
    enrolledCount,
    maxCapacity,
    seatsRemaining,
    isFull: enrolledCount >= maxCapacity,
  };
}

/**
 * Automatically selects the next available cohort batch for a selected course
 * based on active enrollment capacity, cohort status (ACTIVE/UPCOMING), and startDate.
 */
export function suggestNextAvailableBatch(
  courseId: string,
  batches: Batch[],
  students: Student[],
  excludeStudentId?: string
): BatchSuggestionResult {
  if (!Array.isArray(batches) || batches.length === 0) {
    return {
      batch: null,
      batchId: '',
      enrolledCount: 0,
      maxCapacity: 30,
      seatsRemaining: 0,
      hasOpenSeats: false,
      isCourseMatch: false,
      reason: 'No cohort batches configured yet.',
    };
  }

  const eligibleBatches = batches.filter(
    (b) => b.status !== 'ARCHIVED' && b.status !== 'COMPLETED'
  );
  const pool = eligibleBatches.length > 0 ? eligibleBatches : batches;

  const statusRank = (status?: Batch['status']) => {
    if (status === 'ACTIVE') return 0;
    if (status === 'UPCOMING') return 1;
    return 2;
  };

  const sortByIntakeOrder = (a: BatchOccupancy, b: BatchOccupancy) => {
    const sDiff = statusRank(a.batch.status) - statusRank(b.batch.status);
    if (sDiff !== 0) return sDiff;
    const dA = a.batch.startDate || '';
    const dB = b.batch.startDate || '';
    if (dA !== dB) return dA.localeCompare(dB);
    return b.seatsRemaining - a.seatsRemaining;
  };

  const courseMatches = pool
    .filter((b) => Boolean(courseId) && b.courseId === courseId)
    .map((b) => getBatchOccupancy(b, students, excludeStudentId))
    .sort(sortByIntakeOrder);

  const openCourseMatch = courseMatches.find((occ) => !occ.isFull);
  if (openCourseMatch) {
    return {
      batch: openCourseMatch.batch,
      batchId: openCourseMatch.batch.id,
      enrolledCount: openCourseMatch.enrolledCount,
      maxCapacity: openCourseMatch.maxCapacity,
      seatsRemaining: openCourseMatch.seatsRemaining,
      hasOpenSeats: true,
      isCourseMatch: true,
      reason: `Next open batch for this course (${openCourseMatch.seatsRemaining} of ${openCourseMatch.maxCapacity} seats available).`,
    };
  }

  const allOccupancies = pool
    .map((b) => getBatchOccupancy(b, students, excludeStudentId))
    .sort(sortByIntakeOrder);

  const anyOpenBatch = allOccupancies.find((occ) => !occ.isFull);
  if (anyOpenBatch) {
    return {
      batch: anyOpenBatch.batch,
      batchId: anyOpenBatch.batch.id,
      enrolledCount: anyOpenBatch.enrolledCount,
      maxCapacity: anyOpenBatch.maxCapacity,
      seatsRemaining: anyOpenBatch.seatsRemaining,
      hasOpenSeats: true,
      isCourseMatch: anyOpenBatch.batch.courseId === courseId,
      reason:
        courseMatches.length > 0
          ? `Course-specific batches are full; suggesting next open academy cohort (${anyOpenBatch.seatsRemaining} seats left).`
          : `Next open academy cohort (${anyOpenBatch.seatsRemaining} of ${anyOpenBatch.maxCapacity} seats available).`,
    };
  }

  // Fallback: all batches are full; suggest course match with lowest fill ratio
  const fallbackPool = (courseMatches.length > 0 ? courseMatches : allOccupancies).slice().sort(
    (a, b) => a.enrolledCount / a.maxCapacity - b.enrolledCount / b.maxCapacity
  );
  const leastFull = fallbackPool[0];
  return {
    batch: leastFull.batch,
    batchId: leastFull.batch.id,
    enrolledCount: leastFull.enrolledCount,
    maxCapacity: leastFull.maxCapacity,
    seatsRemaining: 0,
    hasOpenSeats: false,
    isCourseMatch: leastFull.batch.courseId === courseId,
    reason: `All matching batches are at capacity (${leastFull.enrolledCount}/${leastFull.maxCapacity}). Override confirmation required.`,
  };
}
