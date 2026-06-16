import { SemesterType } from "@prisma/client";

export function isSemesterActive(
  semesterNumber: number,
  activeSemesterType: SemesterType,
): boolean {
  if (activeSemesterType === SemesterType.ODD) {
    return semesterNumber % 2 === 1;
  }
  return semesterNumber % 2 === 0;
}

export function filterSemestersByType(
  semesterNumber: number[] | readonly number[],
  activeSemesterType: SemesterType,
): number[] {
  return semesterNumber.filter((n) => isSemesterActive(n, activeSemesterType));
}

export function semesterTypeLabel(type: SemesterType): string {
  return type === SemesterType.ODD ? "ODD (Sem 1,3,5,7)" : "EVEN (Sem 2,4,6,8)";
}
