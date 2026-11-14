using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace TutorMatching.Gateway;

public static class SearchCompositionEndpoints
{
    public static IEndpointRouteBuilder MapAvailableTutorSearch(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/search/available-tutors", async (
            Guid subjectId,
            DateOnly date,
            string timezone,
            int page,
            int pageSize,
            HttpContext context,
            SearchCompositionService service,
            CancellationToken cancellationToken) =>
        {
            try
            {
                var result = await service.SearchAsync(
                    subjectId,
                    date,
                    timezone,
                    page,
                    pageSize,
                    context.Request.Headers.Authorization.ToString(),
                    cancellationToken);
                return Results.Ok(result);
            }
            catch (TimeZoneNotFoundException)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["timezone"] = ["Timezone must be a valid IANA or system timezone identifier."],
                });
            }
            catch (InvalidTimeZoneException)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["timezone"] = ["Timezone data is invalid on this host."],
                });
            }
            catch (HttpRequestException)
            {
                return Results.Problem(
                    title: "A search dependency is unavailable.",
                    type: "https://tutormatching.local/problems/dependency-unavailable",
                    statusCode: StatusCodes.Status503ServiceUnavailable);
            }
        })
        .RequireAuthorization(policy => policy.RequireRole("Student"))
        .WithTags("Search");
        return endpoints;
    }
}

public sealed class SearchCompositionService(IHttpClientFactory httpClientFactory, TimeProvider timeProvider)
{
    public async Task<AvailableTutorSearchResponse> SearchAsync(
        Guid subjectId,
        DateOnly date,
        string timezone,
        int page,
        int pageSize,
        string authorization,
        CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var zone = TimeZoneInfo.FindSystemTimeZoneById(timezone);
        var (fromUtc, toUtc) = UtcDayRange(date, zone);

        var tutorClient = httpClientFactory.CreateClient("tutor");
        using var tutorRequest = new HttpRequestMessage(
            HttpMethod.Get,
            $"/api/v1/tutors?subjectId={subjectId:D}&page={page}&pageSize={pageSize}");
        CopyAuthorization(tutorRequest, authorization);
        using var tutorResponse = await tutorClient.SendAsync(tutorRequest, cancellationToken);
        tutorResponse.EnsureSuccessStatusCode();
        var tutors = await tutorResponse.Content.ReadFromJsonAsync<TutorSearchResponse>(cancellationToken)
            ?? throw new HttpRequestException("Tutor service returned an empty response.");

        if (tutors.Items.Count == 0)
        {
            return new([], tutors.Page, tutors.PageSize, tutors.Total, timeProvider.GetUtcNow(), false);
        }

        var schedulingClient = httpClientFactory.CreateClient("scheduling");
        using var slotRequest = new HttpRequestMessage(HttpMethod.Post, "/internal/v1/slots/query")
        {
            Content = JsonContent.Create(new
            {
                tutorIds = tutors.Items.Select(item => item.Id).Distinct().ToArray(),
                fromUtc,
                toUtc,
            }),
        };
        CopyAuthorization(slotRequest, authorization);
        using var slotResponse = await schedulingClient.SendAsync(slotRequest, cancellationToken);
        slotResponse.EnsureSuccessStatusCode();
        var booked = await slotResponse.Content.ReadFromJsonAsync<BookedSlotResponse>(cancellationToken)
            ?? throw new HttpRequestException("Scheduling service returned an empty response.");

        var items = tutors.Items
            .Select(tutor => new AvailableTutor(
                tutor.Id,
                tutor.DisplayName,
                tutor.Bio,
                tutor.ExperienceYears,
                tutor.AvatarUrl,
                tutor.Subjects,
                SlotComposer.Compose(
                    tutor.Availability,
                    booked.BookedSlots.Where(slot => slot.TutorId == tutor.Id),
                    fromUtc,
                    toUtc)))
            .Where(tutor => tutor.AvailableSlots.Count > 0)
            .ToArray();

        return new(items, tutors.Page, tutors.PageSize, tutors.Total, timeProvider.GetUtcNow(), false);
    }

    private static (DateTimeOffset FromUtc, DateTimeOffset ToUtc) UtcDayRange(DateOnly date, TimeZoneInfo zone)
    {
        var localStart = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        var localEnd = date.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        if (zone.IsInvalidTime(localStart) || zone.IsInvalidTime(localEnd))
        {
            throw new InvalidTimeZoneException("The requested date contains an invalid local midnight.");
        }

        return (new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(localStart, zone), TimeSpan.Zero),
            new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(localEnd, zone), TimeSpan.Zero));
    }

    private static void CopyAuthorization(HttpRequestMessage request, string authorization)
    {
        if (AuthenticationHeaderValue.TryParse(authorization, out var value))
        {
            request.Headers.Authorization = value;
        }
    }
}

public static class SlotComposer
{
    public static IReadOnlyList<AvailableSlot> Compose(
        IEnumerable<AvailabilityWindowResponse> windows,
        IEnumerable<BookedSlotResponseItem> bookedSlots,
        DateTimeOffset fromUtc,
        DateTimeOffset toUtc)
    {
        var booked = bookedSlots.ToArray();
        return windows
            .SelectMany(window => Starts(window, fromUtc, toUtc))
            .Distinct()
            .OrderBy(start => start)
            .Where(start => !booked.Any(slot => start < slot.EndAtUtc && slot.StartAtUtc < start.AddHours(1)))
            .Select(start => new AvailableSlot(start, start.AddHours(1)))
            .ToArray();
    }

    private static IEnumerable<DateTimeOffset> Starts(
        AvailabilityWindowResponse window,
        DateTimeOffset fromUtc,
        DateTimeOffset toUtc)
    {
        var start = window.StartAtUtc < fromUtc ? fromUtc : window.StartAtUtc;
        var minuteRemainder = start.Minute % 30;
        if (minuteRemainder != 0 || start.Second != 0 || start.Millisecond != 0)
        {
            start = new DateTimeOffset(start.Year, start.Month, start.Day, start.Hour, 0, 0, TimeSpan.Zero)
                .AddMinutes(start.Minute < 30 ? 30 : 60);
        }

        var limit = window.EndAtUtc < toUtc ? window.EndAtUtc : toUtc;
        while (start.AddHours(1) <= limit)
        {
            yield return start;
            start = start.AddMinutes(30);
        }
    }
}

public sealed record TutorSearchResponse(IReadOnlyList<TutorSearchItem> Items, int Page, int PageSize, int Total);
public sealed record TutorSearchItem(
    Guid Id,
    string DisplayName,
    string Bio,
    short ExperienceYears,
    string? AvatarUrl,
    IReadOnlyList<TutorSubjectResponse> Subjects,
    IReadOnlyList<AvailabilityWindowResponse> Availability);
public sealed record TutorSubjectResponse(Guid SubjectId, int ProficiencyLevel);
public sealed record AvailabilityWindowResponse(DateTimeOffset StartAtUtc, DateTimeOffset EndAtUtc);
public sealed record BookedSlotResponse(IReadOnlyList<BookedSlotResponseItem> BookedSlots);
public sealed record BookedSlotResponseItem(Guid TutorId, DateTimeOffset StartAtUtc, DateTimeOffset EndAtUtc);
public sealed record AvailableSlot(DateTimeOffset StartAtUtc, DateTimeOffset EndAtUtc);
public sealed record AvailableTutor(
    Guid Id,
    string DisplayName,
    string Bio,
    short ExperienceYears,
    string? AvatarUrl,
    IReadOnlyList<TutorSubjectResponse> Subjects,
    IReadOnlyList<AvailableSlot> AvailableSlots);
public sealed record AvailableTutorSearchResponse(
    IReadOnlyList<AvailableTutor> Items,
    int Page,
    int PageSize,
    int Total,
    DateTimeOffset GeneratedAtUtc,
    bool Partial);
