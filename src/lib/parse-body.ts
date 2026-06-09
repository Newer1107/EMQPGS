import { NextRequest } from "next/server";

export async function parseJson<T>(request: NextRequest): Promise<T> {
  return request.json() as Promise<T>;
}
