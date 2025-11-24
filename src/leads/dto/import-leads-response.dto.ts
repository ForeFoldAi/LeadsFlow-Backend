import { LeadResponseDto } from './lead-response.dto';

export class ImportLeadResult {
  success: boolean;
  lead?: LeadResponseDto;
  error?: string;
  rowNumber?: number;
}

export class ImportLeadsResponseDto {
  total: number;
  successful: number;
  failed: number;
  results: ImportLeadResult[];
}

