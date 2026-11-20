import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ClientContact, ClientContactRequest } from '../../features/clients/models/client-contact.model';

@Injectable({ providedIn: 'root' })
export class ClientContactsApiService {
  private readonly http = inject(HttpClient);

  getContacts(clientId: number): Observable<ClientContact[]> {
    return this.http.get<ClientContact[]>(contactsUrl(clientId));
  }

  getContact(clientId: number, contactId: number): Observable<ClientContact> {
    return this.http.get<ClientContact>(`${contactsUrl(clientId)}/${contactId}`);
  }

  createContact(clientId: number, request: ClientContactRequest): Observable<ClientContact> {
    return this.http.post<ClientContact>(contactsUrl(clientId), request);
  }

  updateContact(clientId: number, contactId: number, request: ClientContactRequest): Observable<ClientContact> {
    return this.http.put<ClientContact>(`${contactsUrl(clientId)}/${contactId}`, request);
  }

  deleteContact(clientId: number, contactId: number): Observable<void> {
    return this.http.delete<void>(`${contactsUrl(clientId)}/${contactId}`);
  }
}

function contactsUrl(clientId: number): string {
  return `/api/clients/${clientId}/contacts`;
}
