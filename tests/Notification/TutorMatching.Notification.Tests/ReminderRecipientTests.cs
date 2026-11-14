using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using TutorMatching.BuildingBlocks.Security;
using TutorMatching.Notification.Api.Domain;
using TutorMatching.Notification.Api.Infrastructure;

namespace TutorMatching.Notification.Tests;

public sealed class ReminderRecipientTests
{
    [Theory]
    [InlineData("cancelled")]
    [InlineData("withdrawn")]
    [InlineData("past")]
    [InlineData("optout")]
    public async Task DoesNotSendStaleOrOptedOutCourseReminder(string scenario)
    {
        var user=Guid.NewGuid();var session=Guid.NewGuid();
        await using var db=new NotificationDbContext(new DbContextOptionsBuilder<NotificationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.ReminderSchedules.Add(ReminderSchedule.Create(session,user,Guid.NewGuid(),"CourseOneHour",DateTimeOffset.UtcNow));await db.SaveChangesAsync();
        var configuration=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{
            ["Jwt:Issuer"]="test",["Jwt:Audience"]="test",["Jwt:SigningKey"]="test-signing-key-at-least-32-bytes-long",
            ["Email:Host"]="127.0.0.1",["Email:Port"]="1"
        }).Build();
        using var directoryHttp=new HttpClient(new JsonHandler(new AccountDelivery(user,"student@example.com",true,new AccountPreferences(EmailReminders:scenario!="optout")))){BaseAddress=new Uri("http://identity")};
        using var sourceHttp=new HttpClient(new JsonHandler(new ReminderDetails("Course",DateTimeOffset.UtcNow.AddHours(scenario=="past"?-1:1),DateTimeOffset.UtcNow.AddHours(2),scenario is not ("cancelled" or "withdrawn"),null,null))){BaseAddress=new Uri("http://tutor")};
        var sender=new SmtpEmailSender(configuration,new AccountDirectoryClient(directoryHttp,configuration),db,new ClientFactory(sourceHttp),TimeProvider.System);
        // SMTP points at a closed port: attempting delivery instead of suppression would fail this assertion.
        await Assert.ThrowsAsync<ReminderSuppressedException>(()=>sender.SendReminderAsync(user,session,default));
    }
    private sealed class JsonHandler(object value):HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken cancellationToken)=>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK){Content=JsonContent.Create(value)});
    }
    private sealed class ClientFactory(HttpClient client):IHttpClientFactory
    {
        public HttpClient CreateClient(string name)=>client;
    }
}
