using MediatR;
using {project_name}.Domain.Entities;
using {project_name}.Domain.Interfaces;

namespace {project_name}.Application.Features.{plural_entity}.Queries.Get{entity}ById;

public class Get{entity}ByIdQueryHandler : IRequestHandler<Get{entity}ByIdQuery, {entity}Dto>
{
    private readonly IRepository<{entity}> _repository;

    public Get{entity}ByIdQueryHandler(IRepository<{entity}> repository)
    {
        _repository = repository;
    }

    public async Task<{entity}Dto> Handle(Get{entity}ByIdQuery request, CancellationToken cancellationToken)
    {
        var entity = await _repository.GetByIdAsync(request.Id);
        if (entity == null) throw new KeyNotFoundException($"Entity with id {request.Id} not found.");

        return new {entity}Dto
        {
            Id = entity.Id,
            // Add other property mappings here
        };
    }
}