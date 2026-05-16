import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  IsObject,
  Length,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateExecutionStatusDto {
  @ApiProperty()
  @IsEnum(['Queued', 'Preparing Workspace', 'Running Agent', 'Running Verification', 'Waiting Review', 'Completed', 'Failed', 'Cancelled'])
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  error_message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  worktree_path?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branch_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  exit_code?: number;
}

export class AddLogDto {
  @ApiProperty()
  @IsEnum(['info', 'warn', 'error', 'debug'])
  level!: 'info' | 'warn' | 'error' | 'debug';

  @ApiProperty()
  @IsEnum(['agent', 'worker', 'system'])
  source!: 'agent' | 'worker' | 'system';

  @ApiProperty()
  @IsString()
  @Length(1, 10000)
  message!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class BatchLogsDto {
  @ApiProperty({ type: [AddLogDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddLogDto)
  logs!: AddLogDto[];
}

export class AddFileChangeDto {
  @ApiProperty()
  @IsString()
  @Length(1, 1000)
  file_path!: string;

  @ApiProperty()
  @IsEnum(['added', 'modified', 'deleted'])
  change_type!: 'added' | 'modified' | 'deleted';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  additions?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  deletions?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diff?: string;
}

export class AddVerificationResultDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  type!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 500)
  command!: string;

  @ApiProperty()
  @IsEnum(['passed', 'failed', 'skipped', 'error'])
  status!: 'passed' | 'failed' | 'skipped' | 'error';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  exit_code?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  output?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  duration_ms?: number;
}
