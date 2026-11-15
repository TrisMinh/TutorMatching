using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using TutorMatching.BuildingBlocks.Security;
using TutorMatching.Notification.Api.Domain;
using TutorMatching.Notification.Api.Infrastructure;

namespace TutorMatching.Notification.Api.Endpoints;

public static class ConversationEndpoints
{
    public static void MapConversationEndpoints(this IEndpointRouteBuilder app)
    {
        var group=app.MapGroup("/api/v1/conversations").WithTags("Messaging").RequireAuthorization(p=>p.RequireRole("Student","Tutor"));
        group.MapPost("/",Start).RequireAuthorization(p=>p.RequireRole("Student")).RequireRateLimiting("messaging");
        group.MapGet("/",async (int? page,int? pageSize,ClaimsPrincipal user,NotificationDbContext db,CancellationToken ct)=>{
            var number=Math.Clamp(page??1,1,100000);var size=Math.Clamp(pageSize??50,1,100);var uid=Uid(user);
            var rows=Rows(db,uid);var total=await rows.CountAsync(ct);
            var items=await rows.OrderByDescending(c=>c.UpdatedAtUtc).ThenBy(c=>c.Id).Skip((number-1)*size).Take(size).ToArrayAsync(ct);
            return Results.Ok(new {items,page=number,pageSize=size,total});
        });
        group.MapGet("/unread",async(ClaimsPrincipal user,NotificationDbContext db,CancellationToken ct)=>{
            var uid=Uid(user);
            var count=await db.ChatMessages.CountAsync(m=>m.SenderUserId!=uid&&db.Conversations.Any(c=>c.Id==m.ConversationId&&
                ((c.StudentUserId==uid&&m.Id>c.StudentReadThrough)||(c.TutorUserId==uid&&m.Id>c.TutorReadThrough))),ct);
            return Results.Ok(new {count});
        });
        group.MapGet("/{id:guid}",async(Guid id,ClaimsPrincipal user,NotificationDbContext db,CancellationToken ct)=>{
            var row=await Rows(db,Uid(user)).SingleOrDefaultAsync(c=>c.Id==id,ct);
            return row is null?Results.NotFound():Results.Ok(row);
        });
        group.MapGet("/{id:guid}/messages",Messages);
        group.MapPost("/{id:guid}/messages",Send).RequireRateLimiting("messaging");
        group.MapPost("/{id:guid}/read",Read);
    }

    private static Guid Uid(ClaimsPrincipal user)=>Guid.Parse(user.FindFirstValue("sub")!);
    private static IQueryable<Conversation> Own(NotificationDbContext db,Guid uid)=>db.Conversations.Where(c=>c.StudentUserId==uid||c.TutorUserId==uid);
    private static IQueryable<ConversationRow> Rows(NotificationDbContext db,Guid uid)=>Own(db,uid).Select(c=>new ConversationRow {
        Id=c.Id,PeerName=c.StudentUserId==uid?c.TutorName:c.StudentName,PeerRole=c.StudentUserId==uid?"Tutor":"Student",TutorId=c.TutorId,
        UpdatedAtUtc=c.UpdatedAtUtc,
        LastMessage=db.ChatMessages.Where(m=>m.ConversationId==c.Id).OrderByDescending(m=>m.Id).Select(m=>m.Body).FirstOrDefault(),
        UnreadCount=db.ChatMessages.Count(m=>m.ConversationId==c.Id&&m.SenderUserId!=uid&&m.Id>(c.StudentUserId==uid?c.StudentReadThrough:c.TutorReadThrough))});


    private static async Task<IResult> Start(StartConversation input,ClaimsPrincipal user,NotificationDbContext db,
        AccountDirectoryClient accounts,IHttpClientFactory clients,IConfiguration configuration,TimeProvider clock,CancellationToken ct)
    {
        if(input.TutorId==Guid.Empty)return Results.BadRequest(new {error="Choose a tutor to message."});
        var uid=Uid(user);
        var student=await accounts.GetAsync(uid,ct);
        if(student is null||!student.Active||student.Role!="Student")return Results.Forbid();
        using var request=new HttpRequestMessage(HttpMethod.Get,$"/internal/v1/tutors/{input.TutorId}/contact");
        request.Headers.Authorization=new AuthenticationHeaderValue("Bearer",AccountDirectoryClient.CreateToken(configuration,"identity.directory"));
        using var response=await clients.CreateClient("tutor-reminders").SendAsync(request,ct);
        if(response.StatusCode==HttpStatusCode.NotFound)return Results.NotFound();
        response.EnsureSuccessStatusCode();
        var tutor=await response.Content.ReadFromJsonAsync<TutorContact>(ct);
        if(tutor is null)return Results.NotFound();
        var existing=await db.Conversations.AsNoTracking().SingleOrDefaultAsync(c=>c.StudentUserId==uid&&c.TutorUserId==tutor.UserId,ct);
        if(existing is not null)return Results.Ok(await Rows(db,uid).SingleAsync(c=>c.Id==existing.Id,ct));
        var owner=await accounts.GetAsync(tutor.UserId,ct);
        if(owner is null||!owner.Active||owner.Role!="Tutor"||!owner.Settings.ProfileVisible)return Results.NotFound();
        var name=string.IsNullOrWhiteSpace(student.DisplayName)?student.Email.Split('@')[0]:student.DisplayName;
        var conversation=new Conversation {Id=Guid.NewGuid(),StudentUserId=uid,TutorUserId=tutor.UserId,TutorId=tutor.Id,
            StudentName=name[..Math.Min(name.Length,100)],TutorName=tutor.DisplayName,CreatedAtUtc=clock.GetUtcNow(),UpdatedAtUtc=clock.GetUtcNow()};
        db.Conversations.Add(conversation);
        try {await db.SaveChangesAsync(ct);}
        catch(DbUpdateException ex) when(ex.InnerException is PostgresException {SqlState:PostgresErrorCodes.UniqueViolation}) {
            db.Entry(conversation).State=EntityState.Detached;
            conversation=await db.Conversations.SingleAsync(c=>c.StudentUserId==uid&&c.TutorUserId==tutor.UserId,ct);
        }
        return Results.Ok(await Rows(db,uid).SingleAsync(c=>c.Id==conversation.Id,ct));
    }

    private static async Task<IResult> Messages(Guid id,long? before,long? after,ClaimsPrincipal user,NotificationDbContext db,CancellationToken ct)
    {
        var uid=Uid(user);
        if(!await Own(db,uid).AnyAsync(c=>c.Id==id,ct))return Results.NotFound();
        if((before.HasValue&&after.HasValue)||before<0||after<0)return Results.BadRequest();
        var query=db.ChatMessages.AsNoTracking().Where(m=>m.ConversationId==id);
        if(before.HasValue)query=query.Where(m=>m.Id<before.Value);
        if(after.HasValue)query=query.Where(m=>m.Id>after.Value);
        var rows=after.HasValue?await query.OrderBy(m=>m.Id).Take(51).ToListAsync(ct):await query.OrderByDescending(m=>m.Id).Take(51).ToListAsync(ct);
        var hasMore=rows.Count>50;
        var items=rows.Take(50).OrderBy(m=>m.Id).Select(m=>Dto(m,uid)).ToArray();
        return Results.Ok(new {items,hasMore,nextBefore=items.Length>0?(long?)items[0].Id:null});
    }

    private static async Task<IResult> Send(Guid id,SendMessage input,ClaimsPrincipal user,NotificationDbContext db,TimeProvider clock,CancellationToken ct)
    {
        var uid=Uid(user);
        if(!await Own(db,uid).AnyAsync(c=>c.Id==id,ct))return Results.NotFound();
        var body=input.Body?.Trim();
        if(string.IsNullOrWhiteSpace(body)||body.Length>2000||body.Contains('\0')||input.ClientMessageId==Guid.Empty)
            return Results.BadRequest(new {error="Enter a message between 1 and 2000 characters and a valid message key."});
        await using var transaction=await db.Database.BeginTransactionAsync(ct);
        // Serialize writers for one thread so message IDs and read cursors follow commit order.
        var conversation=await db.Conversations.FromSqlInterpolated($"SELECT * FROM conversations WHERE \"Id\"={id} FOR UPDATE").SingleAsync(ct);
        var existing=await db.ChatMessages.SingleOrDefaultAsync(m=>m.ConversationId==id&&m.SenderUserId==uid&&m.ClientMessageId==input.ClientMessageId,ct);
        if(existing is not null)return existing.Body==body?Results.Ok(Dto(existing,uid)):Results.Conflict(new {error="This message key was already used for different text."});
        var message=new ChatMessage {ConversationId=id,SenderUserId=uid,ClientMessageId=input.ClientMessageId,Body=body,CreatedAtUtc=clock.GetUtcNow()};
        db.ChatMessages.Add(message);conversation.UpdatedAtUtc=message.CreatedAtUtc;
        await db.SaveChangesAsync(ct);await transaction.CommitAsync(ct);
        return Results.Created($"/api/v1/conversations/{id}/messages/{message.Id}",Dto(message,uid));
    }

    private static async Task<IResult> Read(Guid id,ReadMessages input,ClaimsPrincipal user,NotificationDbContext db,CancellationToken ct)
    {
        var uid=Uid(user);
        var conversation=await Own(db,uid).AsNoTracking().SingleOrDefaultAsync(c=>c.Id==id,ct);
        if(conversation is null)return Results.NotFound();
        if(!await db.ChatMessages.AnyAsync(m=>m.ConversationId==id&&m.Id==input.MessageId,ct))return Results.BadRequest();
        if(conversation.StudentUserId==uid)
            await db.Conversations.Where(c=>c.Id==id&&c.StudentReadThrough<input.MessageId).ExecuteUpdateAsync(s=>s.SetProperty(c=>c.StudentReadThrough,input.MessageId),ct);
        else await db.Conversations.Where(c=>c.Id==id&&c.TutorReadThrough<input.MessageId).ExecuteUpdateAsync(s=>s.SetProperty(c=>c.TutorReadThrough,input.MessageId),ct);
        return Results.NoContent();
    }
    private static MessageRow Dto(ChatMessage m,Guid uid)=>new(m.Id,m.ConversationId,m.ClientMessageId,m.Body,m.CreatedAtUtc,m.SenderUserId==uid);
}
public sealed record StartConversation(Guid TutorId);
public sealed record SendMessage(string? Body,Guid ClientMessageId);
public sealed record ReadMessages(long MessageId);
public sealed record TutorContact(Guid Id,Guid UserId,string DisplayName);
public sealed class ConversationRow {
    public Guid Id {get;init;}
    public string PeerName {get;init;}="";
    public string PeerRole {get;init;}="";
    public Guid TutorId {get;init;}
    public DateTimeOffset UpdatedAtUtc {get;init;}
    public string? LastMessage {get;init;}
    public int UnreadCount {get;init;}
}
public sealed record MessageRow(long Id,Guid ConversationId,Guid ClientMessageId,string Body,DateTimeOffset CreatedAtUtc,bool IsMine);
