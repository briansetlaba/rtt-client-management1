namespace Rtt.ClientManagement.Api;

public static class ClientContactEndpoints
{
    private const int MaximumContactTypeLength = 50;
    private const int MaximumContactValueLength = 254;

    public static IEndpointRouteBuilder MapClientContactEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var contacts = endpoints.MapGroup("/api/clients/{clientId}/contacts");

        contacts.MapGet("/", GetContacts);
        contacts.MapGet("/{contactId}", GetContact).WithName(nameof(GetContact));
        contacts.MapPost("/", CreateContact);
        contacts.MapPut("/{contactId}", UpdateContact);
        contacts.MapDelete("/{contactId}", DeleteContact);

        return endpoints;
    }

    private static async Task<IResult> GetContacts(long clientId, ClientContactDataAccess contactDataAccess, CancellationToken cancellationToken)
    {
        var identifierErrors = RequestValidation.ValidateIdentifiers(("clientId", clientId));
        if (identifierErrors.Count > 0)
        {
            return Results.ValidationProblem(identifierErrors);
        }

        var contacts = await contactDataAccess.GetContactsAsync(clientId, cancellationToken);
        return contacts is null ? Results.NotFound() : Results.Ok(contacts);
    }

    private static async Task<IResult> GetContact(long clientId, long contactId, ClientContactDataAccess contactDataAccess, CancellationToken cancellationToken)
    {
        var identifierErrors = RequestValidation.ValidateIdentifiers(("clientId", clientId), ("contactId", contactId));
        if (identifierErrors.Count > 0)
        {
            return Results.ValidationProblem(identifierErrors);
        }

        var contact = await contactDataAccess.GetContactAsync(clientId, contactId, cancellationToken);
        return contact is null ? Results.NotFound() : Results.Ok(contact);
    }

    private static async Task<IResult> CreateContact(long clientId, ClientContactRequest request, ClientContactDataAccess contactDataAccess, CancellationToken cancellationToken)
    {
        var errors = RequestValidation.ValidateIdentifiers(("clientId", clientId));
        var contactDetails = ValidateContact(request, errors);
        if (contactDetails is null)
        {
            return Results.ValidationProblem(errors);
        }

        var contact = await contactDataAccess.CreateContactAsync(clientId, contactDetails, cancellationToken);
        return contact is null
            ? Results.NotFound()
            : Results.CreatedAtRoute(nameof(GetContact), new { clientId, contactId = contact.ContactId }, contact);
    }

    private static async Task<IResult> UpdateContact(long clientId, long contactId, ClientContactRequest request, ClientContactDataAccess contactDataAccess, CancellationToken cancellationToken)
    {
        var errors = RequestValidation.ValidateIdentifiers(("clientId", clientId), ("contactId", contactId));
        var contactDetails = ValidateContact(request, errors);
        if (contactDetails is null)
        {
            return Results.ValidationProblem(errors);
        }

        var contact = await contactDataAccess.UpdateContactAsync(clientId, contactId, contactDetails, cancellationToken);
        return contact is null ? Results.NotFound() : Results.Ok(contact);
    }

    private static async Task<IResult> DeleteContact(long clientId, long contactId, ClientContactDataAccess contactDataAccess, CancellationToken cancellationToken)
    {
        var identifierErrors = RequestValidation.ValidateIdentifiers(("clientId", clientId), ("contactId", contactId));
        if (identifierErrors.Count > 0)
        {
            return Results.ValidationProblem(identifierErrors);
        }

        return await contactDataAccess.DeleteContactAsync(clientId, contactId, cancellationToken) ? Results.NoContent() : Results.NotFound();
    }

    private static ClientContactDetails? ValidateContact(ClientContactRequest request, Dictionary<string, string[]> errors)
    {
        var contactType = RequestValidation.ValidateRequiredText(request.ContactType, "contactType", "Contact type", MaximumContactTypeLength, errors);
        var contactValue = RequestValidation.ValidateRequiredText(request.ContactValue, "contactValue", "Contact value", MaximumContactValueLength, errors);

        return errors.Count > 0 ? null : new ClientContactDetails(contactType!, contactValue!);
    }
}
