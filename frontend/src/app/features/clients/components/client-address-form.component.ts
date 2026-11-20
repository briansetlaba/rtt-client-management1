import { ChangeDetectorRef, Component, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { distinctUntilChanged, map } from 'rxjs';
import { optionalTrimmedText, requiredTrimmedText } from '../forms/text-validators';
import { ClientAddress, ClientAddressFormField, ClientAddressFormFieldErrors, ClientAddressRequest } from '../models/client-address.model';

export const standardAddressTypes = ['Residential', 'Work', 'Postal', 'Other'];

interface AddressTextField {
  name: Exclude<ClientAddressFormField, 'addressType'>;
  id: string;
  label: string;
  required: boolean;
  autocomplete: string;
}

const fieldLabels: Record<ClientAddressFormField, string> = {
  addressType: 'Address type',
  addressLine1: 'Address line 1',
  addressLine2: 'Address line 2',
  city: 'City',
  province: 'Province',
  postalCode: 'Postal code'
};

@Component({
  selector: 'app-client-address-form',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, SelectModule],
  templateUrl: './client-address-form.component.html',
  styleUrl: './client-form.component.scss'
})
export class ClientAddressFormComponent implements OnInit {
  readonly address = input<ClientAddress | null>(null);
  readonly submitting = input(false);
  readonly serverErrors = input<ClientAddressFormFieldErrors>({});

  readonly saveRequested = output<ClientAddressRequest>();
  readonly cancelRequested = output<void>();
  readonly dirtyChange = output<boolean>();

  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly submitAttempted = signal(false);

  protected readonly textFields: AddressTextField[] = [
    { name: 'addressLine1', id: 'address-line-1', label: 'Address Line 1', required: true, autocomplete: 'address-line1' },
    { name: 'addressLine2', id: 'address-line-2', label: 'Address Line 2', required: false, autocomplete: 'address-line2' },
    { name: 'city', id: 'address-city', label: 'City', required: true, autocomplete: 'address-level2' },
    { name: 'province', id: 'address-province', label: 'Province', required: false, autocomplete: 'address-level1' },
    { name: 'postalCode', id: 'address-postal-code', label: 'Postal Code', required: false, autocomplete: 'postal-code' }
  ];

  protected readonly form = inject(NonNullableFormBuilder).group({
    addressType: ['', requiredTrimmedText(50)],
    addressLine1: ['', requiredTrimmedText(200)],
    addressLine2: ['', optionalTrimmedText(200)],
    city: ['', requiredTrimmedText(100)],
    province: ['', optionalTrimmedText(100)],
    postalCode: ['', optionalTrimmedText(20)]
  });

  protected readonly addressTypeOptions = computed(() => {
    const existingType = this.address()?.addressType;
    return existingType && !standardAddressTypes.includes(existingType) ? [existingType, ...standardAddressTypes] : standardAddressTypes;
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
    const address = this.address();

    if (address) {
      this.form.reset({
        addressType: address.addressType,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2 ?? '',
        city: address.city,
        province: address.province ?? '',
        postalCode: address.postalCode ?? ''
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
      addressType: value.addressType.trim(),
      addressLine1: value.addressLine1.trim(),
      addressLine2: toOptionalText(value.addressLine2),
      city: value.city.trim(),
      province: toOptionalText(value.province),
      postalCode: toOptionalText(value.postalCode)
    });
  }

  protected showError(field: ClientAddressFormField): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitAttempted());
  }

  protected errorMessage(field: ClientAddressFormField): string {
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
    return this.showError('addressType') ? 'address-type-label address-type-error' : 'address-type-label';
  }

  private applySubmissionState(submitting: boolean, serverErrors: ClientAddressFormFieldErrors): void {
    if (submitting) {
      this.form.disable({ emitEvent: false });
      return;
    }

    this.form.enable({ emitEvent: false });

    for (const [field, message] of Object.entries(serverErrors) as [ClientAddressFormField, string][]) {
      const control = this.form.controls[field];
      control.setErrors({ ...control.errors, server: message });
      control.markAsTouched();
    }

    this.changeDetector.markForCheck();
  }
}

function toOptionalText(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}
