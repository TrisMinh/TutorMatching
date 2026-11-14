using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace TutorMatching.Scheduling.Api.Infrastructure;

public sealed record TutorAvailabilityResult(bool Valid, Guid TutorId, Guid TutorUserId);
public sealed record StudentResult(Guid Id, Guid UserId, string DisplayName, string Timezone);

public interface ITutorClient
{
    Task<TutorAvailabilityResult?> ValidateAvailabilityAsync(
        Guid tutorId,
        Guid subjectId,
        DateTimeOffset startAtUtc,
        string authorization,
        CancellationToken cancellationToken);
}

public interface IStudentClient
{
    Task<StudentResult?> GetByUserIdAsync(Guid userId, string authorization, CancellationToken cancellationToken);
}

public sealed class TutorClient(HttpClient httpClient) : ITutorClient
{
    public async Task<TutorAvailabilityResult?> ValidateAvailabilityAsync(
        Guid tutorId,
        Guid subjectId,
        DateTimeOffset startAtUtc,
        string authorization,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"/internal/v1/tutors/{tutorId}/availability?subjectId={subjectId}&startAtUtc={Uri.EscapeDataString(startAtUtc.ToString("O"))}");
        request.Headers.Authorization = AuthenticationHeaderValue.Parse(authorization);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode
            ? await response.Content.ReadFromJsonAsync<TutorAvailabilityResult>(cancellationToken)
            : null;
    }
}

public sealed class StudentClient(HttpClient httpClient) : IStudentClient
{
    public async Task<StudentResult?> GetByUserIdAsync(
        Guid userId,
        string authorization,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/internal/v1/students/by-user/{userId}");
        request.Headers.Authorization = AuthenticationHeaderValue.Parse(authorization);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode
            ? await response.Content.ReadFromJsonAsync<StudentResult>(cancellationToken)
            : null;
    }
}

