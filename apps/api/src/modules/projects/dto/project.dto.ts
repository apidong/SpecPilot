import {
  IsString,
  IsOptional,
  Length,
  IsUrl,
  IsObject,
  IsInt,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 500)
  @Matches(/^(https?:\/\/|ssh:\/\/|git@)/, { message: 'repository_url must be a valid Git URL (https, ssh, or git@)' })
  repository_url!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  default_branch!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  stack?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  root_path?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  test_command?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  lint_command?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  build_command?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  default_agent_id?: number;
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  default_branch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  stack?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  root_path?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  test_command?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  lint_command?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  build_command?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  default_agent_id?: number;
}
