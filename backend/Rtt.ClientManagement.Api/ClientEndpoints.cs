namespace Rtt.ClientManagement.Api;

public static class ClientEndpoints
{
    private const int DefaultPageSize = 20;
    private const int MaximumPageSize = 100;
    private const int MaximumNameLength = 100;
    private const int MaximumGenderLength = 50;
    private const int MaximumSearchLength = 100;

    public static IEndpointRouteBuilder MapClientEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var clients = endpoints.MapGroup("/api/clients");

        clients.MapGet("/", GetClientPage).WithName(nameof(GetClientPage));
        clients.MapGet("/{id}", GetClient).WithName(nameof(GetClient));
        clients.MapPost("/", CreateClient).WithName(nameof(CreateClient));
        clients.MapPut("/{id}", UpdateClient).WithName(nameof(UpdateClient));
        clients.MapDelete("/{id}", DeleteClient).WithName(nameof(DeleteClient));

        return endpoints;
    }

    private static async Task<IResult> GetClientPage(ClientDataAccess clientDataAccess, CancellationToken cancellationToken, int? page, int? pageSize, string? search)
    {
        var requestedPage = page ?? 1;
        var requestedPageSize = pageSize ?? DefaultPageSize;
        var errors = new Dictionary<string, string[]>();

        if (requestedPage < 1)
        {
            errors["page"] = ["Page must be 1 or greater."];
        }

        if (requestedPageSize is < 1 or > MaximumPageSize)
        {
            errors["pageSize"] = [$"Page size must be between 1 and {MaximumPageSize}."];
        }

        if (search?.Trim().Length > MaximumSearchLength)
        {
            errors["search"] = [$"Search must be {MaximumSearchLength} characters or fewer."];
        }

        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        return Results.Ok(await clientDataAccess.GetClientPageAsync(requestedPage, requestedPageSize, search, cancellationToken));
    }

    private static async Task<IResult> GetClient(long id, ClientDataAccess clientDataAccess, CancellationToken cancellationToken)
    {
        if (id < 1)
        {
            return InvalidClientIdResult();
        }

        var client = await clientDataAccess.GetClientAsync(id, cancellationToken);
        return client is null ? Results.NotFound() : Results.Ok(client);
    }

    private static async Task<IResult> CreateClient(CreateClientRequest request, ClientDataAccess clientDataAccess, CancellationToken cancellationToken)
    {
        var (clientDetails, errors) = ValidateClientDetails(request.FirstName, request.LastName, request.Gender, request.DateOfBirth);
        if (clientDetails is null)
        {
            return Results.ValidationProblem(errors);
        }

        var client = await clientDataAccess.CreateClientAsync(clientDetails, cancellationToken);
        return Results.CreatedAtRoute(nameof(GetClient), new { id = client.ClientId }, client);
    }

    private static async Task<IResult> UpdateClient(long id, UpdateClientRequest request, ClientDataAccess clientDataAccess, CancellationToken cancellationToken)
    {
        if (id < 1)
        {
            return InvalidClientIdResult();
        }

        var (clientDetails, errors) = ValidateClientDetails(request.FirstName, request.LastName, request.Gender, request.DateOfBirth);
        if (clientDetails is null)
        {
            return Results.ValidationProblem(errors);
        }

        var client = await clientDataAccess.UpdateClientAsync(id, clientDetails, cancellationToken);
        return client is null ? Results.NotFound() : Results.Ok(client);
    }

    private static async Task<IResult> DeleteClient(long id, ClientDataAccess clientDataAccess, CancellationToken cancellationToken)
    {
        if (id < 1)
        {
            return InvalidClientIdResult();
        }

        return await clientDataAccess.DeleteClientAsync(id, cancellationToken) ? Results.NoContent() : Results.NotFound();
    }

    private static IResult InvalidClientIdResult() =>
        Results.ValidationProblem(new Dictionary<string, string[]> { ["id"] = ["Client ID must be a positive integer."] });

    private static (ClientDetails? ClientDetails, Dictionary<string, string[]> Errors) ValidateClientDetails(
        string? firstName, string? lastName, string? gender, DateOnly? dateOfBirth)
    {
        var errors = new Dictionary<string, string[]>();
        var trimmedFirstName = RequestValidation.ValidateRequiredText(firstName, "firstName", "First name", MaximumNameLength, errors);
        var trimmedLastName = RequestValidation.ValidateRequiredText(lastName, "lastName", "Last name", MaximumNameLength, errors);
        var trimmedGender = RequestValidation.ValidateRequiredText(gender, "gender", "Gender", MaximumGenderLength, errors);

        if (dateOfBirth > DateOnly.FromDateTime(DateTime.UtcNow))
        {
            errors["dateOfBirth"] = ["Date of birth cannot be in the future."];
        }

        return errors.Count > 0
            ? (null, errors)
            : (new ClientDetails(trimmedFirstName!, trimmedLastName!, trimmedGender!, dateOfBirth), errors);
    }
}
