using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace {project_name}.Application.Features.{plural_entity}.Get{entity}ById
{
    public class Get{entity}ByIdQueryHandler : IRequestHandler<Get{entity}ByIdQuery, Get{entity}ByIdResponse>
    {
        private readonly ApplicationDbContext _db;
        {private_fields}

        public Get{entity}ByIdQueryHandler(ApplicationDbContext db{constructor_injects})
        {
            _db = db;{constructor_assigns}
        }

        public async Task<{entity}Dto> Handle(Get{entity}ByIdQuery request, CancellationToken cancellationToken)
        {
            var query = _db.Set<{entity}>().AsNoTracking();
            {eager_includes}

            var entity = await query.FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);
            if (entity == null) return null;

            {mapping_code}

            return {mapping_result};
        }
    }
}
