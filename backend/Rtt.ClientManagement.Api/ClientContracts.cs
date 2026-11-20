using System.Text.Json.Serialization;

namespace Rtt.ClientManagement.Api;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record CreateClientRequest(string? FirstName, string? LastName, string? Gender, DateOnly? DateOfBirth);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record UpdateClientRequest(string? FirstName, string? LastName, string? Gender, DateOnly? DateOfBirth);

public sealed record ClientDetails(string FirstName, string LastName, string Gender, DateOnly? DateOfBirth);

public sealed record ClientResponse(
    long ClientId,
    string FirstName,
    string LastName,
    string Gender,
    DateOnly? DateOfBirth,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record PagedResponse<T>(IReadOnlyList<T> Items, int Page, int PageSize, long TotalCount, long TotalPages);
