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
import { ClientsApiService } from '../../../core/services/clients-api.service';
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
const unreachableServiceStatuses = [0, 502, 503, 504];
const clientFormFields: ClientFormField[] = ['firstName', 'lastName', 'gender', 'dateOfBirth'];

interface ClientLoadResult {
  response: PagedResponse<Client> | null;
  errorMessage: string | null;
}

@Component({
  selector: 'app-client-list-page',
  imports: [
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
      const { fieldErrors, otherMessages } = readValidationProblem(error.error);
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
      error instanceof HttpErrorResponse && unreachableServiceStatuses.includes(error.status)
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

    if (response && response.items.length === 0 && response.totalPages > 0 && response.page > response.totalPages) {
      this.queryRequests.next({ ...this.query(), page: response.totalPages });
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
  if (error instanceof HttpErrorResponse && unreachableServiceStatuses.includes(error.status)) {
    return 'The client service could not be reached. Check that the API is running, then retry.';
  }

  if (error instanceof HttpErrorResponse && error.status === 400) {
    return 'The client search request was not accepted. Adjust the search and retry.';
  }

  return 'Clients could not be loaded. Please retry.';
}

function readValidationProblem(body: unknown): { fieldErrors: ClientFormFieldErrors; otherMessages: string[] } {
  const fieldErrors: ClientFormFieldErrors = {};
  const otherMessages: string[] = [];
  const errors = typeof body === 'object' && body !== null && 'errors' in body ? body.errors : null;

  if (typeof errors !== 'object' || errors === null) {
    return { fieldErrors, otherMessages };
  }

  for (const [key, messages] of Object.entries(errors)) {
    const message = Array.isArray(messages) ? messages.filter(item => typeof item === 'string').join(' ') : '';
    const field = clientFormFields.find(candidate => candidate.toLowerCase() === key.toLowerCase());

    if (!message) {
      continue;
    }

    if (field) {
      fieldErrors[field] = message;
    } else {
      otherMessages.push(message);
    }
  }

  return { fieldErrors, otherMessages };
}
