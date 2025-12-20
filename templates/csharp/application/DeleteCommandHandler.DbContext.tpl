using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace {project_name}.Application.Features.{plural_entity}.Delete{entity}
{
    public class Delete{entity}CommandHandler : IRequestHandler<Delete{entity}Command, Delete{entity}Response>
    {
        private readonly ApplicationDbContext _db;

        public Delete{entity}CommandHandler(ApplicationDbContext db)
        {
            _db = db;
        }

        public async Task<Delete{entity}Response> Handle(Delete{entity}Command request, CancellationToken cancellationToken)
        {
            var entity = await _db.Set<{entity}>().FindAsync(new object[] { request.Id }, cancellationToken);
            if (entity == null) throw new System.Exception("Not found");

            _db.Set<{entity}>().Remove(entity);
            await _db.SaveChangesAsync(cancellationToken);

            return new Delete{entity}Response { Id = request.Id };
        }
    }
}
