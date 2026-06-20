export interface CoordinatorSubjectLinkDto {
  examCycleId: string;
  examType: string;
  examCycleStatus: string;
  examCycleName: string;
}

export interface CoordinatorSubjectDto {
  id: string;
  subjectCode: string;
  subjectName: string;
  examCycleLinks: CoordinatorSubjectLinkDto[];
}
