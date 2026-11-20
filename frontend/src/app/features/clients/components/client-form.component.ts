import { ChangeDetectorRef, Component, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { distinctUntilChanged, map } from 'rxjs';
import { requiredTrimmedText } from '../forms/text-validators';
import { Client, ClientFormField, ClientFormFieldErrors, ClientSaveRequest } from '../models/client.model';

export const standardGenderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];

const maximumNameLength = 100;
const maximumGenderLength = 50;

const fieldLabels: Record<ClientFormField, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  gender: 'Gender',
  dateOfBirth: 'Date of birth'
};

@Component({
  selector: 'app-client-form',
  imports: [ReactiveFormsModule, ButtonModule, DatePickerModule, InputTextModule, SelectModule],
  templateUrl: './client-form.component.html',
  styleUrl: './client-form.component.scss'
})
export class ClientFormComponent implements OnInit {
  readonly client = input<Client | null>(null);
  readonly submitting = input(false);
  readonly serverErrors = input<ClientFormFieldErrors>({});

  readonly saveRequested = output<ClientSaveRequest>();
  readonly cancelRequested = output<void>();
  readonly dirtyChange = output<boolean>();

  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly submitAttempted = signal(false);

  protected readonly today = startOfToday();

  protected readonly form = inject(NonNullableFormBuilder).group({
    firstName: ['', requiredTrimmedText(maximumNameLength)],
    lastName: ['', requiredTrimmedText(maximumNameLength)],
    gender: ['', requiredTrimmedText(maximumGenderLength)],
    dateOfBirth: [null as Date | null, notInFutureValidator]
  });

  protected readonly genderOptions = computed(() => {
    const existingGender = this.client()?.gender;
    return existingGender && !standardGenderOptions.includes(existingGender)
      ? [existingGender, ...standardGenderOptions]
      : standardGenderOptions;
  });

  constructor() {
    this.form.valueChanges
      .pipe(
        map(() => this.form.dirty),
        distinctUntilChanged(),
        takeUntilDestroyed()
      )
      .subscribe(dirty => this.dirtyChange.emit(dirty));

    effect(() => this.applySubmissionState(this.submitting(), this.serverErrors()));
  }

  ngOnInit(): void {
    const client = this.client();

    if (client) {
      this.form.reset({
        firstName: client.firstName,
        lastName: client.lastName,
        gender: client.gender,
        dateOfBirth: client.dateOfBirth ? parseApiDate(client.dateOfBirth) : null
      });
    }
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }

    this.submitAttempted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saveRequested.emit({
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      gender: value.gender.trim(),
      dateOfBirth: value.dateOfBirth ? formatApiDate(value.dateOfBirth) : null
    });
  }

  protected onDateInputBlur(event: Event): void {
    const typedDate = parseTypedDate((event.target as HTMLInputElement | null)?.value ?? '');
    const control = this.form.controls.dateOfBirth;

    if (typedDate && (!control.value || formatApiDate(control.value) !== formatApiDate(typedDate))) {
      control.markAsDirty();
      control.setValue(typedDate);
    }
  }

  protected showError(field: ClientFormField): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitAttempted());
  }

  protected errorMessage(field: ClientFormField): string {
    const errors = this.form.controls[field].errors ?? {};
    const label = fieldLabels[field];

    if (typeof errors['server'] === 'string') {
      return errors['server'];
    }

    if (errors['required']) {
      return `${label} is required.`;
    }

    if (errors['maxlength']) {
      return `${label} must be ${errors['maxlength'].requiredLength} characters or fewer.`;
    }

    if (errors['futureDate']) {
      return `${label} cannot be in the future.`;
    }

    return `${label} is invalid.`;
  }

  protected describedBy(field: ClientFormField, labelId: string): string {
    return this.showError(field) ? `${labelId} ${labelId}-error` : labelId;
  }

  private applySubmissionState(submitting: boolean, serverErrors: ClientFormFieldErrors): void {
    if (submitting) {
      this.form.disable({ emitEvent: false });
      return;
    }

    this.form.enable({ emitEvent: false });

    for (const [field, message] of Object.entries(serverErrors) as [ClientFormField, string][]) {
      const control = this.form.controls[field];
      control.setErrors({ ...control.errors, server: message });
      control.markAsTouched();
    }

    this.changeDetector.markForCheck();
  }
}

export function formatApiDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseApiDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function parseTypedDate(text: string): Date | null {
  const trimmedText = text.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedText)) {
    return null;
  }

  const date = parseApiDate(trimmedText);
  return formatApiDate(date) === trimmedText ? date : null;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function notInFutureValidator(control: AbstractControl<Date | null>): ValidationErrors | null {
  return control.value && formatApiDate(control.value) > formatApiDate(new Date()) ? { futureDate: true } : null;
}
