import { ChangeDetectorRef, Component, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { distinctUntilChanged, map } from 'rxjs';
import { requiredTrimmedText } from '../forms/text-validators';
import { ClientContact, ClientContactFormField, ClientContactFormFieldErrors, ClientContactRequest } from '../models/client-contact.model';

export const standardContactTypes = ['Cell', 'Work', 'Home', 'Email', 'Other'];

const fieldLabels: Record<ClientContactFormField, string> = {
  contactType: 'Contact type',
  contactValue: 'Contact value'
};

@Component({
  selector: 'app-client-contact-form',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, SelectModule],
  templateUrl: './client-contact-form.component.html',
  styleUrl: './client-form.component.scss'
})
export class ClientContactFormComponent implements OnInit {
  readonly contact = input<ClientContact | null>(null);
  readonly submitting = input(false);
  readonly serverErrors = input<ClientContactFormFieldErrors>({});

  readonly saveRequested = output<ClientContactRequest>();
  readonly cancelRequested = output<void>();
  readonly dirtyChange = output<boolean>();

  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly submitAttempted = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    contactType: ['', requiredTrimmedText(50)],
    contactValue: ['', requiredTrimmedText(254)]
  });

  protected readonly contactTypeOptions = computed(() => {
    const existingType = this.contact()?.contactType;
    return existingType && !standardContactTypes.includes(existingType) ? [existingType, ...standardContactTypes] : standardContactTypes;
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
    const contact = this.contact();

    if (contact) {
      this.form.reset({ contactType: contact.contactType, contactValue: contact.contactValue });
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
    this.saveRequested.emit({ contactType: value.contactType.trim(), contactValue: value.contactValue.trim() });
  }

  protected showError(field: ClientContactFormField): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitAttempted());
  }

  protected errorMessage(field: ClientContactFormField): string {
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

    return `${label} is invalid.`;
  }

  protected typeLabelledBy(): string {
    return this.showError('contactType') ? 'contact-type-label contact-type-error' : 'contact-type-label';
  }

  private applySubmissionState(submitting: boolean, serverErrors: ClientContactFormFieldErrors): void {
    if (submitting) {
      this.form.disable({ emitEvent: false });
      return;
    }

    this.form.enable({ emitEvent: false });

    for (const [field, message] of Object.entries(serverErrors) as [ClientContactFormField, string][]) {
      const control = this.form.controls[field];
      control.setErrors({ ...control.errors, server: message });
      control.markAsTouched();
    }

    this.changeDetector.markForCheck();
  }
}
