export interface ClientAddress {
  addressId: number;
  clientId: number;
  addressType: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string | null;
  postalCode: string | null;
  createdAt: string;
}

export interface ClientAddressRequest {
  addressType: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string | null;
  postalCode: string | null;
}

export type ClientAddressFormField = keyof ClientAddressRequest;

export type ClientAddressFormFieldErrors = Partial<Record<ClientAddressFormField, string>>;

export const clientAddressFormFields: ClientAddressFormField[] = ['addressType', 'addressLine1', 'addressLine2', 'city', 'province', 'postalCode'];
