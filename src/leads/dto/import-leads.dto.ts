import { IsArray, ValidateNested, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateLeadDto } from './create-lead.dto';

export class ImportLeadsDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Leads array cannot be empty' })
  @ValidateNested({ each: true })
  @Type(() => CreateLeadDto)
  leads: CreateLeadDto[];
}

