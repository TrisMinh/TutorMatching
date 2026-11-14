using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using StackExchange.Redis;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;

namespace TutorMatching.BuildingBlocks.Hosting;
public static class ScheduleWriteLock
{
    private static readonly Action<ILogger,Exception?> LogReleaseFailure=LoggerMessage.Define(LogLevel.Warning,new EventId(1301,"ScheduleLockCleanup"),"Schedule lock cleanup failed; conservative TTL will release the lock.");
    public static void UseScheduleWriteLock(this WebApplication app) => app.Use(async (context,next)=>{
        if(HttpMethods.IsGet(context.Request.Method)||(!context.Request.Path.StartsWithSegments("/api/v1/courses")&&!context.Request.Path.StartsWithSegments("/api/v1/bookings"))){await next(context);return;}
        var redis=context.RequestServices.GetService(typeof(IConnectionMultiplexer)) as IConnectionMultiplexer;
        if(redis is null){context.Response.StatusCode=503;return;}
        var db=redis.GetDatabase();var token=Guid.NewGuid().ToString();const string key="tutormatching:schedule-write:v1";
        try{
            if(!await db.StringSetAsync(key,token,TimeSpan.FromMinutes(2),When.NotExists)){context.Response.StatusCode=503;context.Response.Headers.RetryAfter="1";await context.Response.WriteAsJsonAsync(new{code="schedule-busy",error="Another scheduling request is in progress. Please retry."});return;}
        }catch(RedisException){context.Response.StatusCode=503;context.Response.Headers.RetryAfter="1";await context.Response.WriteAsJsonAsync(new{code="schedule-store-unavailable",error="Scheduling is temporarily unavailable. No changes were made."});return;}
        using var timeout=new CancellationTokenSource(TimeSpan.FromSeconds(45));
        using var linked=CancellationTokenSource.CreateLinkedTokenSource(timeout.Token,context.RequestAborted);
        context.RequestAborted=linked.Token;
        try{await next(context);}finally{
            try{await db.ScriptEvaluateAsync("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",[new RedisKey(key)],[new RedisValue(token)]);}
            catch(RedisException exception){LogReleaseFailure(context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("ScheduleLock"),exception);}
        }
    });
}
