export interface Client {
  clientId: number;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ClientListQuery {
  page: number;
  pageSize: number;
  search: string;
}

export interface ClientPageChange {
  page: number;
  pageSize: number;
}

export interface ClientSaveRequest {
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string | null;
}

export type ClientFormField = keyof ClientSaveRequest;

export type ClientFormFieldErrors = Partial<Record<ClientFormField, string>>;
