import { LeadResponseDto } from './lead-response.dto';

export class PaginatedLeadsResponseDto {
  data: LeadResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

