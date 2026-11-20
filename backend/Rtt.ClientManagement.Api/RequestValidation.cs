namespace Rtt.ClientManagement.Api;

public static class RequestValidation
{
    public static string? ValidateRequiredText(string? value, string fieldName, string displayName, int maximumLength, Dictionary<string, string[]> errors)
    {
        var trimmedValue = value?.Trim();

        if (string.IsNullOrEmpty(trimmedValue))
        {
            errors[fieldName] = [$"{displayName} is required."];
        }
        else if (trimmedValue.Length > maximumLength)
        {
            errors[fieldName] = [$"{displayName} must be {maximumLength} characters or fewer."];
        }

        return trimmedValue;
    }

    public static string? ValidateOptionalText(string? value, string fieldName, string displayName, int maximumLength, Dictionary<string, string[]> errors)
    {
        var trimmedValue = value?.Trim();

        if (string.IsNullOrEmpty(trimmedValue))
        {
            return null;
        }

        if (trimmedValue.Length > maximumLength)
        {
            errors[fieldName] = [$"{displayName} must be {maximumLength} characters or fewer."];
        }

        return trimmedValue;
    }

    public static Dictionary<string, string[]> ValidateIdentifiers(params (string RouteName, long Value)[] identifiers)
    {
        var errors = new Dictionary<string, string[]>();

        foreach (var (routeName, value) in identifiers)
        {
            if (value < 1)
            {
                errors[routeName] = [$"{routeName} must be a positive integer."];
            }
        }

        return errors;
    }
}
