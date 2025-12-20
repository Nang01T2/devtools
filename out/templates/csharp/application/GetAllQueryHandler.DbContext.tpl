using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace {project_name}.Application.Features.{plural_entity}.GetAll{entity}
{
    public class GetAll{entity}QueryHandler : IRequestHandler<GetAll{entity}Query, GetAll{entity}QueryResponse>
    {
        private readonly ApplicationDbContext _db;
        {private_fields}

        public GetAll{entity}QueryHandler(ApplicationDbContext db{constructor_injects})
        {
            _db = db;{constructor_assigns}
        }

        public async Task<GetAll{entity}QueryResponse> Handle(GetAll{entity}Query request, CancellationToken cancellationToken)
        {
            // prepare base query with optional eager-loading
            var query = _db.Set<{entity}>().AsNoTracking();
            {eager_includes}

            var totalCount = await query.CountAsync(cancellationToken);

            var list = await query
                .Skip((request.PageNumber - 1) * request.PageSize)
                .Take(request.PageSize)
                .ToListAsync(cancellationToken);

            {mapping_code}

            return {mapping_result};
        }
    }
}
