using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;

namespace TutorMatching.BuildingBlocks.Hosting;

public sealed class DependencyExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (httpContext.RequestAborted.IsCancellationRequested || exception is not (HttpRequestException or TaskCanceledException)) return false;
        httpContext.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        httpContext.Response.Headers.RetryAfter = "2";
        await Results.Problem(statusCode: 503, title: "A required service is temporarily unavailable. Please try again shortly.")
            .ExecuteAsync(httpContext);
        return true;
    }
}

