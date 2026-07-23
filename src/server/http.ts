import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/server/auth";

/** Base class for expected, client-facing application errors. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
    public readonly code = "bad_request",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(entity = "Resource") {
    super(`${entity} not found`, 404, "not_found");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource") {
    super(message, 403, "forbidden");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409, "conflict");
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, 422, "validation_error", details);
  }
}

/** Standard JSON success response. */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export function paginated<T>(items: T[], total: number, page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const meta: PageMeta = {
    page,
    pageSize,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
  return NextResponse.json({ data: items, meta });
}

/** Parse `page`/`pageSize` from a URL search params into a Prisma-ready shape. */
export function parsePagination(searchParams: URLSearchParams, defaults = { pageSize: 50 }) {
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    500,
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? String(defaults.pageSize), 10) || defaults.pageSize),
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * Wrap a route handler so that all thrown errors are converted into consistent
 * JSON responses. Keeps individual handlers focused on the happy path.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response> | Response,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: { message: error.message, code: "unauthorized" } },
      { status: 401 },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          message: "Validation failed",
          code: "validation_error",
          details: error.flatten(),
        },
      },
      { status: 422 },
    );
  }
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { message: error.message, code: error.code, details: error.details } },
      { status: error.statusCode },
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: { message: "Resource not found", code: "not_found" } },
        { status: 404 },
      );
    }
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: { message: "A record with these values already exists", code: "conflict" } },
        { status: 409 },
      );
    }
  }
  console.error("[voicesheets] Unhandled route error:", error);
  return NextResponse.json(
    { error: { message: "Something went wrong", code: "internal_error" } },
    { status: 500 },
  );
}
