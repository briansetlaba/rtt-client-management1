using System.Text;

namespace Rtt.ClientManagement.Api;

public static class ClientExportEndpoints
{
    private const int ResponseBufferSize = 64 * 1024;
    private static readonly Encoding Utf8WithByteOrderMark = new UTF8Encoding(encoderShouldEmitUTF8Identifier: true);

    public static IEndpointRouteBuilder MapClientExportEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/clients/export", ExportClientAddresses);
        return endpoints;
    }

    private static async Task ExportClientAddresses(HttpContext httpContext, ClientExportDataAccess exportDataAccess, ILogger<ClientExportDataAccess> logger)
    {
        var cancellationToken = httpContext.RequestAborted;
        await using var reader = await exportDataAccess.OpenClientAddressReaderAsync(cancellationToken);

        httpContext.Response.ContentType = "text/csv; charset=utf-8";
        httpContext.Response.Headers.ContentDisposition = "attachment; filename=\"clients-addresses.csv\"";

        var writer = new StreamWriter(httpContext.Response.Body, Utf8WithByteOrderMark, ResponseBufferSize, leaveOpen: true);
        try
        {
            await ClientAddressCsvWriter.WriteAsync(reader, writer, cancellationToken);
            await writer.FlushAsync(cancellationToken);
            await writer.DisposeAsync();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            logger.LogInformation("Client address export was cancelled by the caller.");
        }
        catch (Exception exception) when (httpContext.Response.HasStarted)
        {
            logger.LogError(exception, "Client address export failed after the response started.");
            httpContext.Abort();
        }
    }
}
