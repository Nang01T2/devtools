using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace {project_name}.Application.Features.{plural_entity}.Update{entity}
{
    public class Update{entity}CommandHandler : IRequestHandler<Update{entity}Command, Update{entity}Response>
    {
        private readonly ApplicationDbContext _db;

        public Update{entity}CommandHandler(ApplicationDbContext db)
        {
            _db = db;
        }

        public async Task<Update{entity}Response> Handle(Update{entity}Command request, CancellationToken cancellationToken)
        {
            var entity = await _db.Set<{entity}>().FindAsync(new object[] { request.Id }, cancellationToken);
            if (entity == null) throw new System.Exception("Not found");

{mapping}

            await _db.SaveChangesAsync(cancellationToken);
            return new Update{entity}Response { Id = entity.Id };
        }
    }
}
