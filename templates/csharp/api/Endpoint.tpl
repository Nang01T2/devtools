app.MapPost("/api/{plural_entity}", async (Create{entity}Command command, IMediator mediator) =>
{
    var response = await mediator.Send(command);
    return Results.Created($"/api/{plural_entity}/{response.Id}", response);
})
.WithName("Create{entity}")
.WithOpenApi();

app.MapGet("/api/{plural_entity}", async (IMediator mediator) =>
{
    var query = new GetAll{entity}Query();
    var result = await mediator.Send(query);
    return Results.Ok(result);
})
.WithName("GetAll{entity}")
.WithOpenApi();

app.MapGet("/api/{plural_entity}/{{id:guid}}", async (Guid id, IMediator mediator) =>
{
    var query = new Get{entity}ByIdQuery { Id = id };
    var result = await mediator.Send(query);
    return result is not null ? Results.Ok(result) : Results.NotFound();
})
.WithName("Get{entity}ById")
.WithOpenApi();

app.MapPut("/api/{plural_entity}/{{id:guid}}", async (Guid id, Update{entity}Command command, IMediator mediator) =>
{
    command.Id = id;
    var response = await mediator.Send(command);
    return Results.Ok(response);
})
.WithName("Update{entity}")
.WithOpenApi();

app.MapDelete("/api/{plural_entity}/{{id:guid}}", async (Guid id, IMediator mediator) =>
{
    var command = new Delete{entity}Command { Id = id };
    await mediator.Send(command);
    return Results.NoContent();
})
.WithName("Delete{entity}")
.WithOpenApi();