import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @Length(1, 254)
  email!: string;

  @ApiProperty({ example: 'securepassword123' })
  @IsString()
  @Length(8, 128)
  password!: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @Length(1, 254)
  email!: string;

  @ApiProperty({ example: 'securepassword123' })
  @IsString()
  @Length(8, 128)
  password!: string;
}
