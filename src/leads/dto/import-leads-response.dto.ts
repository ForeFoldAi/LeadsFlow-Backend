import { LeadResponseDto } from './lead-response.dto';

export class ImportLeadResult {
  success: boolean;
  lead?: LeadResponseDto;
  error?: string;
  rowNumber?: number;
  duplicate?: boolean;
  duplicateReason?: string; // 'email' | 'phone' | 'email_in_batch' | 'phone_in_batch'
}

export class ImportLeadsResponseDto {
  total: number;
  successful: number;
  failed: number;
  duplicates: number;
  results: ImportLeadResult[];
}

