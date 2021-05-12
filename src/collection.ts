import { NextApiRequest, NextApiResponse } from "next";

interface DefaultPagination {
  pageNumber: number;
  pageSize: number;
  sort: string;
}

interface Hooks<Entity, Filter, Pagination> {
  queryAllResource:
    | {
        getRows(): Promise<Entity[]>;
      }
    | {
        getCount(filter: Filter): Promise<number | void>;
        getPagination(req: NextApiRequest): Pagination;
        getFilter(req: NextApiRequest): Filter;
        getRows(filter: Filter, pagination: Pagination): Promise<Entity[]>;
      };
  createResource(input: any): Promise<Entity>;
}

type Fields<E, D> = {
  [T in keyof D]: (entity: E) => D[T];
};

export interface Options<Entity, Filter, Pagination, DerivedFields> {
  prefix: string[];
  fields: Fields<Entity, DerivedFields>;
  hooks: Partial<Hooks<Entity, Filter, Pagination>>;
}

interface Context<Entity, DerivedFields> {
  path: string[];
  req: NextApiRequest;
  formatEntity(entity: Entity): Entity & Partial<DerivedFields>;
}

export default function makeCollectionResource<
  Entity extends {},
  DerivedFields extends {} = {},
  Filter = unknown,
  Pagination = unknown,
>(options: Options<Entity, Filter, Pagination, DerivedFields>) {
  const { prefix, fields } = options;

  function formatEntity(entity: Entity) {
    const output: Partial<DerivedFields> = {};

    for (const fieldName in fields) {
      output[fieldName] = fields[fieldName](entity);
    }

    return {
      ...entity,
      ...output,
    };
  }

  const APIs = {
    async root(ctx: Context<Entity, DerivedFields>) {
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
        formatEntity,
      };

      if (isRoot) {
        const result = await APIs.root(ctx);
        res.json(result);
        return;
      }
    },
  };
}

async function createEntity<Entity, Filter, Pagination, DerivedFields>(
  ctx: Context<Entity, DerivedFields>,
  options: Options<Entity, Filter, Pagination, DerivedFields>,
) {
  if (!options.hooks.createResource) {
    throw new Error("not supported");
  }
  const newlyCreated = await options.hooks.createResource(ctx.req.body);
  return { data: ctx.formatEntity(newlyCreated) };
}

interface ListAllResponse<E, D, P> {
  data: (E & Partial<D>)[];
  pagination?: P & {
    total: number;
  };
}

async function queryAllEntities<Entity, Filter, Pagination, DerivedFields>(
  ctx: Context<Entity, DerivedFields>,
  options: Options<Entity, Filter, Pagination, DerivedFields>,
) {
  if (!options.hooks.queryAllResource) {
    throw new Error("not supported");
  }

  const queryAllResource = options.hooks.queryAllResource;

  if ("getCount" in queryAllResource) {
    const { getPagination, getFilter, getCount, getRows } = queryAllResource;

    const pagination = getPagination(ctx.req);
    const filter = getFilter(ctx.req);

    const [total, rows] = await Promise.all([
      getCount(filter),
      getRows(filter, pagination),
    ]);

    const res: ListAllResponse<Entity, DerivedFields, Pagination> = {
      data: rows.map(ctx.formatEntity),
    };

    if (total) {
      res.pagination = { ...pagination, total };
    }

    return res;
  }

  return {
    data: (await queryAllResource.getRows()).map(ctx.formatEntity),
  };
}
