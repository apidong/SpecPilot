import {
  IsString,
  IsOptional,
  Length,
  IsEnum,
  IsObject,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VALID_AGENT_PROVIDERS } from '@specpilot/shared';
import type { AgentProvider } from '@specpilot/shared';

export class CreateAgentDto {
  @ApiProperty()
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  type!: string;

  @ApiProperty({ enum: VALID_AGENT_PROVIDERS })
  @IsEnum(VALID_AGENT_PROVIDERS)
  provider!: AgentProvider;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  model!: string;

  @ApiProperty()
  @IsObject()
  config_json!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

export class UpdateAgentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  type?: string;

  @ApiPropertyOptional({ enum: VALID_AGENT_PROVIDERS })
  @IsOptional()
  @IsEnum(VALID_AGENT_PROVIDERS)
  provider?: AgentProvider;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config_json?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
