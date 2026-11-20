namespace Rtt.ClientManagement.Api;

public static class ClientAddressEndpoints
{
    private const int MaximumAddressTypeLength = 50;
    private const int MaximumAddressLineLength = 200;
    private const int MaximumCityLength = 100;
    private const int MaximumProvinceLength = 100;
    private const int MaximumPostalCodeLength = 20;

    public static IEndpointRouteBuilder MapClientAddressEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var addresses = endpoints.MapGroup("/api/clients/{clientId}/addresses");

        addresses.MapGet("/", GetAddresses);
        addresses.MapGet("/{addressId}", GetAddress).WithName(nameof(GetAddress));
        addresses.MapPost("/", CreateAddress);
        addresses.MapPut("/{addressId}", UpdateAddress);
        addresses.MapDelete("/{addressId}", DeleteAddress);

        return endpoints;
    }

    private static async Task<IResult> GetAddresses(long clientId, ClientAddressDataAccess addressDataAccess, CancellationToken cancellationToken)
    {
        var identifierErrors = RequestValidation.ValidateIdentifiers(("clientId", clientId));
        if (identifierErrors.Count > 0)
        {
            return Results.ValidationProblem(identifierErrors);
        }

        var addresses = await addressDataAccess.GetAddressesAsync(clientId, cancellationToken);
        return addresses is null ? Results.NotFound() : Results.Ok(addresses);
    }

    private static async Task<IResult> GetAddress(long clientId, long addressId, ClientAddressDataAccess addressDataAccess, CancellationToken cancellationToken)
    {
        var identifierErrors = RequestValidation.ValidateIdentifiers(("clientId", clientId), ("addressId", addressId));
        if (identifierErrors.Count > 0)
        {
            return Results.ValidationProblem(identifierErrors);
        }

        var address = await addressDataAccess.GetAddressAsync(clientId, addressId, cancellationToken);
        return address is null ? Results.NotFound() : Results.Ok(address);
    }

    private static async Task<IResult> CreateAddress(long clientId, ClientAddressRequest request, ClientAddressDataAccess addressDataAccess, CancellationToken cancellationToken)
    {
        var errors = RequestValidation.ValidateIdentifiers(("clientId", clientId));
        var addressDetails = ValidateAddress(request, errors);
        if (addressDetails is null)
        {
            return Results.ValidationProblem(errors);
        }

        var address = await addressDataAccess.CreateAddressAsync(clientId, addressDetails, cancellationToken);
        return address is null
            ? Results.NotFound()
            : Results.CreatedAtRoute(nameof(GetAddress), new { clientId, addressId = address.AddressId }, address);
    }

    private static async Task<IResult> UpdateAddress(long clientId, long addressId, ClientAddressRequest request, ClientAddressDataAccess addressDataAccess, CancellationToken cancellationToken)
    {
        var errors = RequestValidation.ValidateIdentifiers(("clientId", clientId), ("addressId", addressId));
        var addressDetails = ValidateAddress(request, errors);
        if (addressDetails is null)
        {
            return Results.ValidationProblem(errors);
        }

        var address = await addressDataAccess.UpdateAddressAsync(clientId, addressId, addressDetails, cancellationToken);
        return address is null ? Results.NotFound() : Results.Ok(address);
    }

    private static async Task<IResult> DeleteAddress(long clientId, long addressId, ClientAddressDataAccess addressDataAccess, CancellationToken cancellationToken)
    {
        var identifierErrors = RequestValidation.ValidateIdentifiers(("clientId", clientId), ("addressId", addressId));
        if (identifierErrors.Count > 0)
        {
            return Results.ValidationProblem(identifierErrors);
        }

        return await addressDataAccess.DeleteAddressAsync(clientId, addressId, cancellationToken) ? Results.NoContent() : Results.NotFound();
    }

    private static ClientAddressDetails? ValidateAddress(ClientAddressRequest request, Dictionary<string, string[]> errors)
    {
        var addressType = RequestValidation.ValidateRequiredText(request.AddressType, "addressType", "Address type", MaximumAddressTypeLength, errors);
        var addressLine1 = RequestValidation.ValidateRequiredText(request.AddressLine1, "addressLine1", "Address line 1", MaximumAddressLineLength, errors);
        var addressLine2 = RequestValidation.ValidateOptionalText(request.AddressLine2, "addressLine2", "Address line 2", MaximumAddressLineLength, errors);
        var city = RequestValidation.ValidateRequiredText(request.City, "city", "City", MaximumCityLength, errors);
        var province = RequestValidation.ValidateOptionalText(request.Province, "province", "Province", MaximumProvinceLength, errors);
        var postalCode = RequestValidation.ValidateOptionalText(request.PostalCode, "postalCode", "Postal code", MaximumPostalCodeLength, errors);

        return errors.Count > 0
            ? null
            : new ClientAddressDetails(addressType!, addressLine1!, addressLine2, city!, province, postalCode);
    }
}
