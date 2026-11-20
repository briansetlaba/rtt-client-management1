using System.Text.Json.Serialization;

namespace Rtt.ClientManagement.Api;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ClientContactRequest(string? ContactType, string? ContactValue);

public sealed record ClientContactDetails(string ContactType, string ContactValue);

public sealed record ClientContactResponse(
    long ContactId,
    long ClientId,
    string ContactType,
    string ContactValue,
    DateTime CreatedAt);
