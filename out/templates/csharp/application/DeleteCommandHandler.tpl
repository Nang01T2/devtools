using MediatR;
using {project_name}.Domain.Entities;
using {project_name}.Domain.Interfaces;

namespace {project_name}.Application.Features.{plural_entity}.Commands.Delete{entity};

public class Delete{entity}CommandHandler : IRequestHandler<Delete{entity}Command, Delete{entity}Response>
{
    private readonly IRepository<{entity}> _repository;

    public Delete{entity}CommandHandler(IRepository<{entity}> repository)
    {
        _repository = repository;
    }

    public async Task<Delete{entity}Response> Handle(Delete{entity}Command request, CancellationToken cancellationToken)
    {
        var entity = await _repository.GetByIdAsync(request.Id);
        if (entity == null)
            throw new KeyNotFoundException($"Entity with id {request.Id} not found.");

        await _repository.DeleteAsync(request.Id);

        return new Delete{entity}Response { Id = request.Id, Success = true };
    }
}