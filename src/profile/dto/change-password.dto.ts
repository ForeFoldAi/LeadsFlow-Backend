import {
  IsString,
  IsNotEmpty,
  MinLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'passwordMatch', async: false })
export class PasswordMatchConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    return object.newPassword === object.confirmPassword;
  }

  defaultMessage(args: ValidationArguments) {
    return 'New password and confirm password must match';
  }
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Current Password is required' })
  currentPassword: string;

  @IsString()
  @IsNotEmpty({ message: 'New Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  newPassword: string;

  @IsString()
  @IsNotEmpty({ message: 'Confirm Password is required' })
  @Validate(PasswordMatchConstraint)
  confirmPassword: string;
}

