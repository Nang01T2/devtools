using MediatR;

namespace {project_name}.Application.Features.{plural_entity}.Queries.Get{entity}ById;

public class Get{entity}ByIdQuery : IRequest<{entity}Dto>
{
    public Guid Id { get; set; }
}