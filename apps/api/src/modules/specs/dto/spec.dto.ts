import { IsString, IsOptional, Length, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { SpecStatus } from '@specpilot/shared';
import { VALID_SPEC_STATUSES } from '@specpilot/shared';

export class CreateSpecDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  summary?: string;
}

export class UpdateSpecDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  summary?: string;

  @ApiPropertyOptional({ enum: VALID_SPEC_STATUSES })
  @IsOptional()
  @IsEnum(VALID_SPEC_STATUSES, {
    message: `status must be one of: ${VALID_SPEC_STATUSES.join(', ')}`,
  })
  status?: SpecStatus;
}

export class UpdateArtifactDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200000)
  content!: string;
}

export class GenerateRequirementsDto {
  @ApiProperty()
  @IsString()
  @Length(1, 10000)
  prompt!: string;
}
