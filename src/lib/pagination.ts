export type CursorPaginationInput = {
  cursor?: string;
  take?: number;
};

export type CursorPaginationMeta = {
  cursor: string | null;
  hasMore: boolean;
  total?: number;
};

export function buildCursorWhere<Where extends Record<string, unknown>>(
  cursorField: string,
  cursorValue?: string,
): Where | undefined {
  if (!cursorValue) return undefined;
  return { [cursorField]: cursorValue } as unknown as Where;
}

export function buildCursorPaginationParams(
  input: CursorPaginationInput,
  cursorField = "id",
): { cursor?: { [key: string]: string }; take: number; skip?: number } {
  const take = Math.min(Math.max(input.take ?? 25, 1), 200);
  if (!input.cursor) return { take: take + 1 };
  return {
    cursor: { [cursorField]: input.cursor },
    skip: 1,
    take: take + 1,
  };
}

export function extractPaginationMeta<T extends { id: string }>(
  items: T[],
  take: number,
): { items: T[]; meta: CursorPaginationMeta } {
  const hasMore = items.length > take;
  const result = hasMore ? items.slice(0, take) : items;
  return {
    items: result,
    meta: {
      cursor: result.length > 0 ? result[result.length - 1].id : null,
      hasMore,
    },
  };
}

export function paginatedResponse<T extends { id: string }>(
  items: T[],
  input: CursorPaginationInput,
  total?: number,
) {
  const take = Math.min(Math.max(input.take ?? 25, 1), 200);
  const { items: paginated, meta } = extractPaginationMeta(items, take);
  return {
    data: paginated,
    pagination: {
      ...meta,
      ...(total !== undefined ? { total } : {}),
    },
  };
}
