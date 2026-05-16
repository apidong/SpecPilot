import { IsString, IsOptional, Length, IsInt, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TicketStatus } from '@specpilot/shared';

export class CreateTicketDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  task_id?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  agent_id?: number;
}

export class UpdateTicketDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  agent_id?: number;
}
