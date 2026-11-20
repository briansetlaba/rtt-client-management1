export interface ClientContact {
  contactId: number;
  clientId: number;
  contactType: string;
  contactValue: string;
  createdAt: string;
}

export interface ClientContactRequest {
  contactType: string;
  contactValue: string;
}

export type ClientContactFormField = keyof ClientContactRequest;

export type ClientContactFormFieldErrors = Partial<Record<ClientContactFormField, string>>;

export const clientContactFormFields: ClientContactFormField[] = ['contactType', 'contactValue'];
