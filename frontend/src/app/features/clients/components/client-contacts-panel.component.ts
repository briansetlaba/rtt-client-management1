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
import { ClientContactsApiService } from '../../../core/services/client-contacts-api.service';
import { ClientContact, ClientContactFormFieldErrors, ClientContactRequest, clientContactFormFields } from '../models/client-contact.model';
import { Client } from '../models/client.model';
import { ClientContactFormComponent } from './client-contact-form.component';
import { ClientContactListComponent } from './client-contact-list.component';

interface ContactLoadResult {
  client: Client;
  contacts: ClientContact[] | null;
  error: unknown;
}

@Component({
  selector: 'app-client-contacts-panel',
  imports: [ButtonModule, DialogModule, DrawerModule, MessageModule, ClientContactFormComponent, ClientContactListComponent],
  templateUrl: './client-contacts-panel.component.html',
  host: { '(document:keydown.escape)': 'onDocumentEscape($event)' }
})
export class ClientContactsPanelComponent {
  readonly client = input<Client | null>(null);

  readonly closed = output<void>();
  readonly clientMissing = output<Client>();

  private readonly contactsApi = inject(ClientContactsApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly loadRequests = new Subject<Client | null>();
  private readonly formHasUnsavedChanges = signal(false);
  private readonly confirmationOpen = signal(false);
  private readonly contactsHeading = viewChild<ElementRef<HTMLElement>>('contactsHeading');
  private drawerOpener: HTMLElement | null = null;

  protected readonly contacts = signal<ClientContact[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadErrorMessage = signal<string | null>(null);
  protected readonly dialogVisible = signal(false);
  protected readonly editingContact = signal<ClientContact | null>(null);
  protected readonly submitting = signal(false);
  protected readonly serverFieldErrors = signal<ClientContactFormFieldErrors>({});
  protected readonly dialogErrorMessage = signal<string | null>(null);
  protected readonly deletingContactId = signal<number | null>(null);

  protected readonly clientName = computed(() => {
    const client = this.client();
    return client ? `${client.firstName} ${client.lastName}` : '';
  });

  protected readonly dialogTitle = computed(() => (this.editingContact() ? 'Edit Contact' : 'Add Contact'));

  constructor() {
    this.loadRequests
      .pipe(
        tap(client => this.startLoading(client)),
        switchMap(client => (client ? this.loadContacts(client) : EMPTY)),
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

  protected focusContactsHeading(): void {
    this.contactsHeading()?.nativeElement.focus();
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
    this.refreshContacts();
  }

  protected openCreateDialog(): void {
    this.openDialog(null);
  }

  protected openEditDialog(contact: ClientContact): void {
    this.openDialog(contact);
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

  protected saveContact(request: ClientContactRequest): void {
    const client = this.client();

    if (this.submitting() || !client) {
      return;
    }

    const contact = this.editingContact();
    this.submitting.set(true);
    this.serverFieldErrors.set({});
    this.dialogErrorMessage.set(null);

    const save = contact
      ? this.contactsApi.updateContact(client.clientId, contact.contactId, request)
      : this.contactsApi.createContact(client.clientId, request);

    save.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.completeSave(contact ? 'Contact updated successfully.' : 'Contact added successfully.'),
      error: (error: unknown) => this.failSave(client, error)
    });
  }

  protected requestContactDeletion(contact: ClientContact): void {
    if (this.deletingContactId() !== null) {
      return;
    }

    this.confirm({
      header: 'Delete Contact',
      message: `Are you sure you want to delete this contact detail? ${contact.contactType}: ${contact.contactValue}`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete Contact',
      rejectLabel: 'Cancel',
      acceptIcon: 'pi pi-trash',
      rejectIcon: 'none',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      defaultFocus: 'reject',
      accept: () => this.deleteContact(contact)
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

  private deleteContact(contact: ClientContact): void {
    const client = this.client();

    if (this.deletingContactId() !== null || !client) {
      return;
    }

    this.deletingContactId.set(contact.contactId);

    this.contactsApi
      .deleteContact(client.clientId, contact.contactId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingContactId.set(null);
          this.messageService.add({ severity: 'success', summary: 'Contact deleted successfully.' });
          this.refreshContacts();
        },
        error: (error: unknown) => {
          this.deletingContactId.set(null);

          if (hasHttpStatus(error, 404)) {
            this.messageService.add({ severity: 'error', summary: 'This contact detail no longer exists. The contact list has been refreshed.' });
            this.refreshContacts();
            return;
          }

          this.messageService.add({
            severity: 'error',
            summary: isServiceUnreachable(error) ? 'Unable to connect to the server. Please try again.' : 'Contact could not be deleted. Please try again.'
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
    this.deletingContactId.set(null);
    this.loadRequests.next(client);
  }

  private refreshContacts(): void {
    this.loadRequests.next(this.client());
  }

  private openDialog(contact: ClientContact | null): void {
    this.editingContact.set(contact);
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
    this.refreshContacts();
  }

  private failSave(client: Client, error: unknown): void {
    this.submitting.set(false);

    if (hasHttpStatus(error, 404) && this.editingContact()) {
      this.closeDialog();
      this.messageService.add({ severity: 'error', summary: 'This contact detail no longer exists. The contact list has been refreshed.' });
      this.refreshContacts();
      return;
    }

    if (hasHttpStatus(error, 404)) {
      this.closeDialog();
      this.clientMissing.emit(client);
      return;
    }

    if (hasHttpStatus(error, 400)) {
      const problem = error as { error: unknown };
      const { fieldErrors, otherMessages } = readValidationProblem(problem.error, clientContactFormFields);
      this.serverFieldErrors.set(fieldErrors);
      this.dialogErrorMessage.set(
        otherMessages.length > 0
          ? otherMessages.join(' ')
          : Object.keys(fieldErrors).length > 0
            ? null
            : 'The contact details were not accepted. Review the form and try again.'
      );
      return;
    }

    this.dialogErrorMessage.set(
      isServiceUnreachable(error)
        ? 'The contact service could not be reached. Your changes have not been saved. Please try again.'
        : 'The contact detail could not be saved. Please try again.'
    );
  }

  private startLoading(client: Client | null): void {
    this.contacts.set([]);
    this.loadErrorMessage.set(null);
    this.loading.set(client !== null);
  }

  private loadContacts(client: Client) {
    return this.contactsApi.getContacts(client.clientId).pipe(
      map((contacts): ContactLoadResult => ({ client, contacts, error: null })),
      catchError((error: unknown) => of<ContactLoadResult>({ client, contacts: null, error }))
    );
  }

  private completeLoading(result: ContactLoadResult): void {
    if (result.client.clientId !== this.client()?.clientId) {
      return;
    }

    this.loading.set(false);

    if (result.contacts) {
      this.contacts.set(result.contacts);
      return;
    }

    if (hasHttpStatus(result.error, 404)) {
      this.clientMissing.emit(result.client);
      return;
    }

    this.loadErrorMessage.set(
      isServiceUnreachable(result.error)
        ? 'The contact service could not be reached. Check that the API is running, then retry.'
        : 'Contacts could not be loaded. Please retry.'
    );
  }
}
