import { QuestionStatus, Role, type User } from "@prisma/client";

type QuestionLike = {
  contributorId: string;
  status: QuestionStatus;
};

export function canViewQuestion(user: Pick<User, "id" | "role">, question: QuestionLike) {
  if (user.role === Role.MODERATOR || user.role === Role.COORDINATOR || user.role === Role.COE || user.role === Role.DEAN) {
    return true;
  }

  if (user.role === Role.CONTRIBUTOR) {
    return question.contributorId === user.id;
  }

  return false;
}

export function canEditQuestion(user: Pick<User, "id" | "role">, question: QuestionLike) {
  if (user.role === Role.MODERATOR) return true;
  if (user.role === Role.CONTRIBUTOR) return question.contributorId === user.id && question.status !== QuestionStatus.APPROVED;
  return false;
}

export function canModerateQuestion(user: Pick<User, "role">) {
  return user.role === Role.MODERATOR;
}
