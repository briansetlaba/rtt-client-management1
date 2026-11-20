import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DrawerModule } from 'primeng/drawer';
import { MessageModule } from 'primeng/message';
import { EMPTY, Subject, catchError, map, of, switchMap, tap } from 'rxjs';
import { hasHttpStatus, isServiceUnreachable, readValidationProblem } from '../../../core/http/http-errors';
import { ClientAddressesApiService } from '../../../core/services/client-addresses-api.service';
import { ClientAddress, ClientAddressFormFieldErrors, ClientAddressRequest, clientAddressFormFields } from '../models/client-address.model';
import { Client } from '../models/client.model';
import { ClientAddressFormComponent } from './client-address-form.component';
import { ClientAddressListComponent } from './client-address-list.component';

interface AddressLoadResult {
  client: Client;
  addresses: ClientAddress[] | null;
  error: unknown;
}

@Component({
  selector: 'app-client-addresses-panel',
  imports: [ButtonModule, DialogModule, DrawerModule, MessageModule, ClientAddressFormComponent, ClientAddressListComponent],
  templateUrl: './client-addresses-panel.component.html',
  host: { '(document:keydown.escape)': 'onDocumentEscape($event)' }
})
export class ClientAddressesPanelComponent {
  readonly client = input<Client | null>(null);

  readonly closed = output<void>();
  readonly clientMissing = output<Client>();

  private readonly addressesApi = inject(ClientAddressesApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly loadRequests = new Subject<Client | null>();
  private readonly formHasUnsavedChanges = signal(false);
  private readonly confirmationOpen = signal(false);
  private readonly addressesHeading = viewChild<ElementRef<HTMLElement>>('addressesHeading');
  private drawerOpener: HTMLElement | null = null;

  protected readonly addresses = signal<ClientAddress[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadErrorMessage = signal<string | null>(null);
  protected readonly dialogVisible = signal(false);
  protected readonly editingAddress = signal<ClientAddress | null>(null);
  protected readonly submitting = signal(false);
  protected readonly serverFieldErrors = signal<ClientAddressFormFieldErrors>({});
  protected readonly dialogErrorMessage = signal<string | null>(null);
  protected readonly deletingAddressId = signal<number | null>(null);

  protected readonly clientName = computed(() => {
    const client = this.client();
    return client ? `${client.firstName} ${client.lastName}` : '';
  });

  protected readonly dialogTitle = computed(() => (this.editingAddress() ? 'Edit Address' : 'Add Address'));

  constructor() {
    this.loadRequests
      .pipe(
        tap(client => this.startLoading(client)),
        switchMap(client => (client ? this.loadAddresses(client) : EMPTY)),
        takeUntilDestroyed()
      )
      .subscribe(result => this.completeLoading(result));

    effect(() => {
      const client = this.client();
      untracked(() => this.selectClient(client));
    });
  }

  protected onDrawerVisibleChange(visible: boolean): void {
    if (!visible) {
      this.closed.emit();
    }
  }

  protected focusAddressesHeading(): void {
    this.addressesHeading()?.nativeElement.focus();
  }

  protected onDocumentEscape(event?: Event): void {
    if (this.client() && !this.dialogVisible() && !this.confirmationOpen() && !event?.defaultPrevented) {
      this.closed.emit();
    }
  }

  protected onFormEscape(event: Event): void {
    event.stopPropagation();
    this.requestDialogClose();
  }

  protected retry(): void {
    this.refreshAddresses();
  }

  protected openCreateDialog(): void {
    this.openDialog(null);
  }

  protected openEditDialog(address: ClientAddress): void {
    this.openDialog(address);
  }

  protected onFormDirtyChange(dirty: boolean): void {
    this.formHasUnsavedChanges.set(dirty);
  }

  protected requestDialogClose(): void {
    if (this.submitting()) {
      return;
    }

    if (!this.formHasUnsavedChanges()) {
      this.closeDialog();
      return;
    }

    this.confirm({
      header: 'Discard changes?',
      message: 'You have unsaved changes. Discard them and close the form?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Discard changes',
      rejectLabel: 'Keep editing',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.closeDialog()
    });
  }

  protected saveAddress(request: ClientAddressRequest): void {
    const client = this.client();

    if (this.submitting() || !client) {
      return;
    }

    const address = this.editingAddress();
    this.submitting.set(true);
    this.serverFieldErrors.set({});
    this.dialogErrorMessage.set(null);

    const save = address
      ? this.addressesApi.updateAddress(client.clientId, address.addressId, request)
      : this.addressesApi.createAddress(client.clientId, request);

    save.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.completeSave(address ? 'Address updated successfully.' : 'Address added successfully.'),
      error: (error: unknown) => this.failSave(client, error)
    });
  }

  protected requestAddressDeletion(address: ClientAddress): void {
    if (this.deletingAddressId() !== null) {
      return;
    }

    this.confirm({
      header: 'Delete Address',
      message: `Are you sure you want to delete this address? ${address.addressType}: ${address.addressLine1}`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete Address',
      rejectLabel: 'Cancel',
      acceptIcon: 'pi pi-trash',
      rejectIcon: 'none',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      defaultFocus: 'reject',
      accept: () => this.deleteAddress(address)
    });
  }

  private confirm(options: Parameters<ConfirmationService['confirm']>[0]): void {
    const initiatingElement = this.document.activeElement instanceof HTMLElement ? this.document.activeElement : null;
    const finish = () => {
      this.confirmationOpen.set(false);
      setTimeout(() => initiatingElement?.isConnected && initiatingElement.focus());
    };

    this.confirmationOpen.set(true);
    this.confirmationService.confirm({
      ...options,
      closeOnEscape: true,
      accept: () => {
        finish();
        options.accept?.();
      },
      reject: () => finish()
    });
  }

  private deleteAddress(address: ClientAddress): void {
    const client = this.client();

    if (this.deletingAddressId() !== null || !client) {
      return;
    }

    this.deletingAddressId.set(address.addressId);

    this.addressesApi
      .deleteAddress(client.clientId, address.addressId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingAddressId.set(null);
          this.messageService.add({ severity: 'success', summary: 'Address deleted successfully.' });
          this.refreshAddresses();
        },
        error: (error: unknown) => {
          this.deletingAddressId.set(null);

          if (hasHttpStatus(error, 404)) {
            this.messageService.add({ severity: 'error', summary: 'This address no longer exists. The address list has been refreshed.' });
            this.refreshAddresses();
            return;
          }

          this.messageService.add({
            severity: 'error',
            summary: isServiceUnreachable(error) ? 'Unable to connect to the server. Please try again.' : 'Address could not be deleted. Please try again.'
          });
        }
      });
  }

  private selectClient(client: Client | null): void {
    if (client) {
      this.drawerOpener ??= this.document.activeElement instanceof HTMLElement ? this.document.activeElement : null;
    } else if (this.drawerOpener) {
      const opener = this.drawerOpener;
      this.drawerOpener = null;
      setTimeout(() => opener.isConnected && opener.focus());
    }

    this.closeDialog();
    this.submitting.set(false);
    this.deletingAddressId.set(null);
    this.loadRequests.next(client);
  }

  private refreshAddresses(): void {
    this.loadRequests.next(this.client());
  }

  private openDialog(address: ClientAddress | null): void {
    this.editingAddress.set(address);
    this.serverFieldErrors.set({});
    this.dialogErrorMessage.set(null);
    this.formHasUnsavedChanges.set(false);
    this.dialogVisible.set(true);
  }

  private closeDialog(): void {
    this.dialogVisible.set(false);
    this.formHasUnsavedChanges.set(false);
  }

  private completeSave(message: string): void {
    this.submitting.set(false);
    this.closeDialog();
    this.messageService.add({ severity: 'success', summary: message });
    this.refreshAddresses();
  }

  private failSave(client: Client, error: unknown): void {
    this.submitting.set(false);

    if (hasHttpStatus(error, 404) && this.editingAddress()) {
      this.closeDialog();
      this.messageService.add({ severity: 'error', summary: 'This address no longer exists. The address list has been refreshed.' });
      this.refreshAddresses();
      return;
    }

    if (hasHttpStatus(error, 404)) {
      this.closeDialog();
      this.clientMissing.emit(client);
      return;
    }

    if (hasHttpStatus(error, 400)) {
      const problem = error as { error: unknown };
      const { fieldErrors, otherMessages } = readValidationProblem(problem.error, clientAddressFormFields);
      this.serverFieldErrors.set(fieldErrors);
      this.dialogErrorMessage.set(
        otherMessages.length > 0
          ? otherMessages.join(' ')
          : Object.keys(fieldErrors).length > 0
            ? null
            : 'The address details were not accepted. Review the form and try again.'
      );
      return;
    }

    this.dialogErrorMessage.set(
      isServiceUnreachable(error)
        ? 'The address service could not be reached. Your changes have not been saved. Please try again.'
        : 'The address could not be saved. Please try again.'
    );
  }

  private startLoading(client: Client | null): void {
    this.addresses.set([]);
    this.loadErrorMessage.set(null);
    this.loading.set(client !== null);
  }

  private loadAddresses(client: Client) {
    return this.addressesApi.getAddresses(client.clientId).pipe(
      map((addresses): AddressLoadResult => ({ client, addresses, error: null })),
      catchError((error: unknown) => of<AddressLoadResult>({ client, addresses: null, error }))
    );
  }

  private completeLoading(result: AddressLoadResult): void {
    if (result.client.clientId !== this.client()?.clientId) {
      return;
    }

    this.loading.set(false);

    if (result.addresses) {
      this.addresses.set(result.addresses);
      return;
    }

    if (hasHttpStatus(result.error, 404)) {
      this.clientMissing.emit(result.client);
      return;
    }

    this.loadErrorMessage.set(
      isServiceUnreachable(result.error)
        ? 'The address service could not be reached. Check that the API is running, then retry.'
        : 'Addresses could not be loaded. Please retry.'
    );
  }
}
