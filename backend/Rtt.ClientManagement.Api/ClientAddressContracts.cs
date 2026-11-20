using System.Text.Json.Serialization;

namespace Rtt.ClientManagement.Api;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ClientAddressRequest(
    string? AddressType,
    string? AddressLine1,
    string? AddressLine2,
    string? City,
    string? Province,
    string? PostalCode);

public sealed record ClientAddressDetails(
    string AddressType,
    string AddressLine1,
    string? AddressLine2,
    string City,
    string? Province,
    string? PostalCode);

public sealed record ClientAddressResponse(
    long AddressId,
    long ClientId,
    string AddressType,
    string AddressLine1,
    string? AddressLine2,
    string City,
    string? Province,
    string? PostalCode,
    DateTime CreatedAt);
