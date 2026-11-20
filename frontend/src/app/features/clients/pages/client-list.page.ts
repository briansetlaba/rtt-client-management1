import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { Subject, catchError, debounceTime, filter, map, of, switchMap, tap } from 'rxjs';
import { isServiceUnreachable, readValidationProblem } from '../../../core/http/http-errors';
import { ClientsApiService } from '../../../core/services/clients-api.service';
import { ClientAddressesPanelComponent } from '../components/client-addresses-panel.component';
import { ClientFormComponent } from '../components/client-form.component';
import { ClientTableComponent } from '../components/client-table.component';
import {
  Client,
  ClientFormField,
  ClientFormFieldErrors,
  ClientListQuery,
  ClientPageChange,
  ClientSaveRequest,
  PagedResponse
} from '../models/client.model';

const searchDebounceMilliseconds = 300;
const maximumSearchLength = 100;
const defaultPageSize = 20;
const clientFormFields: ClientFormField[] = ['firstName', 'lastName', 'gender', 'dateOfBirth'];

interface ClientLoadResult {
  response: PagedResponse<Client> | null;
  errorMessage: string | null;
}

@Component({
  selector: 'app-client-list-page',
  imports: [
    ClientAddressesPanelComponent,
    ClientFormComponent,
    ClientTableComponent,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    MessageModule,
    ToastModule
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './client-list.page.html',
  styleUrl: './client-list.page.scss'
})
export class ClientListPage {
  private readonly clientsApi = inject(ClientsApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly searchInputs = new Subject<string>();
  private readonly queryRequests = new Subject<ClientListQuery>();
  private readonly formHasUnsavedChanges = signal(false);

  protected readonly maximumSearchLength = maximumSearchLength;
  protected readonly pageSizeOptions = [10, 20, 50, 100];

  protected readonly searchText = signal('');
  protected readonly query = signal<ClientListQuery>({ page: 1, pageSize: defaultPageSize, search: '' });
  protected readonly clients = signal<Client[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly dialogVisible = signal(false);
  protected readonly editingClient = signal<Client | null>(null);
  protected readonly submitting = signal(false);
  protected readonly serverFieldErrors = signal<ClientFormFieldErrors>({});
  protected readonly dialogErrorMessage = signal<string | null>(null);
  protected readonly deletingClientId = signal<number | null>(null);
  protected readonly addressClient = signal<Client | null>(null);

  protected readonly dialogTitle = computed(() => (this.editingClient() ? 'Edit Client' : 'Add Client'));

  protected readonly emptyMessage = computed(() => {
    const search = this.query().search;
    return search ? `No clients match "${search}".` : 'No clients found.';
  });

  constructor() {
    this.searchInputs
      .pipe(
        map(normalizeSearch),
        debounceTime(searchDebounceMilliseconds),
        filter(search => search !== this.query().search),
        takeUntilDestroyed()
      )
      .subscribe(search => this.queryRequests.next({ ...this.query(), search, page: 1 }));

    this.queryRequests
      .pipe(
        tap(query => this.startLoading(query)),
        switchMap(query => this.loadClients(query)),
        takeUntilDestroyed()
      )
      .subscribe(result => this.completeLoading(result));

    this.queryRequests.next(this.query());
  }

  protected onSearchInput(value: string): void {
    this.searchText.set(value);
    this.searchInputs.next(value);
  }

  protected clearSearch(): void {
    this.onSearchInput('');
  }

  protected onPageChange(change: ClientPageChange): void {
    const currentQuery = this.query();

    if (change.pageSize !== currentQuery.pageSize) {
      this.queryRequests.next({ ...currentQuery, pageSize: change.pageSize, page: 1 });
    } else if (change.page !== currentQuery.page) {
      this.queryRequests.next({ ...currentQuery, page: change.page });
    }
  }

  protected retry(): void {
    this.refreshClients();
  }

  protected openCreateDialog(): void {
    this.openDialog(null);
  }

  protected openEditDialog(client: Client): void {
    this.openDialog(client);
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

    this.confirmationService.confirm({
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

  protected saveClient(request: ClientSaveRequest): void {
    if (this.submitting()) {
      return;
    }

    const client = this.editingClient();
    this.submitting.set(true);
    this.serverFieldErrors.set({});
    this.dialogErrorMessage.set(null);

    const save = client ? this.clientsApi.updateClient(client.clientId, request) : this.clientsApi.createClient(request);

    save.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.completeSave(client ? 'Client updated successfully.' : 'Client created successfully.'),
      error: (error: unknown) => this.failSave(error)
    });
  }

  protected openAddresses(client: Client): void {
    this.addressClient.set(client);
  }

  protected closeAddresses(): void {
    this.addressClient.set(null);
  }

  protected onAddressClientMissing(): void {
    this.closeAddresses();
    this.messageService.add({ severity: 'error', summary: 'This client no longer exists. The client list has been refreshed.' });
    this.refreshClients();
  }

  protected requestClientDeletion(client: Client): void {
    if (this.deletingClientId() !== null) {
      return;
    }

    const clientName = `${client.firstName} ${client.lastName}`;
    const initiatingElement = this.document.activeElement instanceof HTMLElement ? this.document.activeElement : null;
    const returnFocus = () => setTimeout(() => initiatingElement?.isConnected && initiatingElement.focus());

    this.confirmationService.confirm({
      header: 'Delete Client',
      message: `Are you sure you want to delete ${clientName}? This will permanently delete the client and all associated addresses and contact details.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete Client',
      rejectLabel: 'Cancel',
      acceptIcon: 'pi pi-trash',
      rejectIcon: 'none',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      defaultFocus: 'reject',
      closeOnEscape: true,
      accept: () => {
        returnFocus();
        this.deleteClient(client);
      },
      reject: () => returnFocus()
    });
  }

  private deleteClient(client: Client): void {
    if (this.deletingClientId() !== null) {
      return;
    }

    this.deletingClientId.set(client.clientId);

    this.clientsApi
      .deleteClient(client.clientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingClientId.set(null);
          this.messageService.add({ severity: 'success', summary: 'Client deleted successfully.' });
          this.refreshClients();
        },
        error: (error: unknown) => this.failDeletion(error)
      });
  }

  private failDeletion(error: unknown): void {
    this.deletingClientId.set(null);

    if (error instanceof HttpErrorResponse && error.status === 404) {
      this.messageService.add({ severity: 'error', summary: 'This client no longer exists. The list has been refreshed.' });
      this.refreshClients();
      return;
    }

    this.messageService.add({ severity: 'error', summary: describeDeletionError(error) });
  }

  private openDialog(client: Client | null): void {
    this.editingClient.set(client);
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
    this.refreshClients();
  }

  private failSave(error: unknown): void {
    this.submitting.set(false);

    if (error instanceof HttpErrorResponse && error.status === 404 && this.editingClient()) {
      this.closeDialog();
      this.messageService.add({ severity: 'error', summary: 'This client no longer exists.', detail: 'The client list has been refreshed.' });
      this.refreshClients();
      return;
    }

    if (error instanceof HttpErrorResponse && error.status === 400) {
      const { fieldErrors, otherMessages } = readValidationProblem(error.error, clientFormFields);
      this.serverFieldErrors.set(fieldErrors);
      this.dialogErrorMessage.set(
        otherMessages.length > 0
          ? otherMessages.join(' ')
          : Object.keys(fieldErrors).length > 0
            ? null
            : 'The client details were not accepted. Review the form and try again.'
      );
      return;
    }

    this.dialogErrorMessage.set(
      isServiceUnreachable(error)
        ? 'The client service could not be reached. Your changes have not been saved. Please try again.'
        : 'The client could not be saved. Please try again.'
    );
  }

  private refreshClients(): void {
    this.queryRequests.next(this.query());
  }

  private startLoading(query: ClientListQuery): void {
    this.query.set(query);
    this.clients.set([]);
    this.errorMessage.set(null);
    this.loading.set(true);
  }

  private loadClients(query: ClientListQuery) {
    return this.clientsApi.getClients(query).pipe(
      map((response): ClientLoadResult => ({ response, errorMessage: null })),
      catchError((error: unknown) => of<ClientLoadResult>({ response: null, errorMessage: describeLoadError(error) }))
    );
  }

  private completeLoading(result: ClientLoadResult): void {
    const response = result.response;

    const lastAvailablePage = Math.max(response?.totalPages ?? 1, 1);

    if (response && response.items.length === 0 && response.page > lastAvailablePage) {
      this.queryRequests.next({ ...this.query(), page: lastAvailablePage });
      return;
    }

    this.clients.set(response?.items ?? []);
    this.totalRecords.set(response?.totalCount ?? 0);
    this.errorMessage.set(result.errorMessage);
    this.loading.set(false);
  }
}

function normalizeSearch(value: string): string {
  return value.trim().slice(0, maximumSearchLength);
}

function describeLoadError(error: unknown): string {
  if (isServiceUnreachable(error)) {
    return 'The client service could not be reached. Check that the API is running, then retry.';
  }

  if (error instanceof HttpErrorResponse && error.status === 400) {
    return 'The client search request was not accepted. Adjust the search and retry.';
  }

  return 'Clients could not be loaded. Please retry.';
}

function describeDeletionError(error: unknown): string {
  if (isServiceUnreachable(error)) {
    return 'Unable to connect to the server. Please try again.';
  }

  if (error instanceof HttpErrorResponse && error.status === 400) {
    return 'The delete request was not valid. Please refresh the list and try again.';
  }

  return 'Client could not be deleted. Please try again.';
}
