using MediatR;
using {project_name}.Domain.Entities;
using {project_name}.Domain.Interfaces;

namespace {project_name}.Application.Features.{plural_entity}.Queries.GetAll{entity};

public class GetAll{entity}QueryHandler : IRequestHandler<GetAll{entity}Query, IEnumerable<{entity}Dto>>
{
    private readonly IRepository<{entity}> _repository;

    public GetAll{entity}QueryHandler(IRepository<{entity}> repository)
    {
        _repository = repository;
    }

    public async Task<IEnumerable<{entity}Dto>> Handle(GetAll{entity}Query request, CancellationToken cancellationToken)
    {
        var entities = await _repository.GetAllAsync();

        return entities.Select(e => new {entity}Dto
        {
            Id = e.Id,
            // Add other property mappings here
        });
    }
}