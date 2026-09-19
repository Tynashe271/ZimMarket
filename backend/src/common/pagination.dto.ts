import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

// Existing callers that never pass page/limit still get a bounded result instead
// of a literally unlimited one; defaultLimit is generous so today's real data
// volumes render exactly as before. skip/take assume a stable orderBy.
export function paginate(query: PaginationQueryDto, defaultLimit = 60, maxLimit = 100) {
  const limit = Math.min(query.limit ?? defaultLimit, maxLimit);
  const page = Math.max(query.page ?? 1, 1);
  return { skip: (page - 1) * limit, take: limit };
}
