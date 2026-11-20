import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function requiredTrimmedText(maximumLength: number): ValidatorFn {
  return (control: AbstractControl<string | null>): ValidationErrors | null => {
    const length = (control.value ?? '').trim().length;

    if (length === 0) {
      return { required: true };
    }

    return length > maximumLength ? maximumLengthError(maximumLength, length) : null;
  };
}

export function optionalTrimmedText(maximumLength: number): ValidatorFn {
  return (control: AbstractControl<string | null>): ValidationErrors | null => {
    const length = (control.value ?? '').trim().length;
    return length > maximumLength ? maximumLengthError(maximumLength, length) : null;
  };
}

function maximumLengthError(requiredLength: number, actualLength: number): ValidationErrors {
  return { maxlength: { requiredLength, actualLength } };
}
