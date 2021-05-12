import { NextApiRequest, NextApiResponse } from "next";

interface DefaultPagination {
  pageNumber: number;
  pageSize: number;
  sort: string;
}

interface Hooks<Entity, Filter, Pagination> {
  queryAllResource: {
    getPagination(req: NextApiRequest): Pagination;
    getFilter(req: NextApiRequest): Filter;
    getRows(filter: Filter, pagination: Pagination): Promise<Entity[]>;
    getCount(filter: Filter): Promise<number>;
  };
  createResource(input: any): Promise<Entity>;
}

export interface Options<Entity, Filter, Pagination = DefaultPagination> {
  prefix: string[];
  hooks: Partial<Hooks<Entity, Filter, Pagination>>;
}

interface Context {
  path: string[];
  req: NextApiRequest;
}

export default function makeCollectionResource<T, F, P = DefaultPagination>(
  options: Options<T, F, P>,
) {
  const { prefix } = options;
  const APIs = {
    async root(ctx: Context) {
      if (ctx.req.method === "POST") return createEntity(ctx, options);
      if (ctx.req.method === "GET") return queryAllEntities(ctx, options);
    },

    async individual(req, res) {
      //
    },
  };

  return {
    async run(req: NextApiRequest, res: NextApiResponse) {
      const path = req.url?.split("/"); // ['', '..', '...']

      const effectivePath = path?.slice(prefix.length + 1);

      if (!effectivePath) {
        res.status(404).json({ error: "URL not found" });
        return;
      }

      const isRoot = effectivePath.length === 0;
      const ctx = {
        path: effectivePath,
        req,
      };

      if (isRoot) {
        const result = await APIs.root(ctx);
        res.json(result);
        return;
      }
    },
  };
}

async function createEntity<T, F, P>(ctx: Context, options: Options<T, F, P>) {
  if (!options.hooks.createResource) {
    throw new Error("not supported");
  }
  const newlyCreated = await options.hooks.createResource(ctx.req.body);
  return { data: newlyCreated };
}

async function queryAllEntities<T, F, P>(
  ctx: Context,
  options: Options<T, F, P>,
) {
  if (!options.hooks.queryAllResource) {
    throw new Error("not supported");
  }

  const { getPagination, getFilter, getCount, getRows } =
    options.hooks.queryAllResource;

  const pagination = getPagination(ctx.req);
  const filter = getFilter(ctx.req);

  const [total, rows] = await Promise.all([
    getCount(filter),
    getRows(filter, pagination),
  ]);

  return {
    data: rows,
    pagination: { ...pagination, total },
  };
}
