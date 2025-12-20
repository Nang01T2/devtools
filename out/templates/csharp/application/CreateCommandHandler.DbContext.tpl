using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace {project_name}.Application.Features.{plural_entity}.Create{entity}
{
    public class Create{entity}CommandHandler : IRequestHandler<Create{entity}Command, Create{entity}Response>
    {
        private readonly ApplicationDbContext _db;

        public Create{entity}CommandHandler(ApplicationDbContext db)
        {
            _db = db;
        }

        public async Task<Create{entity}Response> Handle(Create{entity}Command request, CancellationToken cancellationToken)
        {
            var entity = new {entity}
            {
{mapping}
            };

            _db.Set<{entity}>().Add(entity);
            await _db.SaveChangesAsync(cancellationToken);

            return new Create{entity}Response { Id = entity.Id };
        }
    }
}
