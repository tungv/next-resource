import { NextApiRequest, NextApiResponse } from "next";

interface DefaultPagination {
  pageNumber: number;
  pageSize: number;
  sort: string;
}

interface Hooks<Entity, Filter, Pagination> {
  getById(id: string): Promise<Entity>;
  queryAllResource:
    | {
        getRows(): Promise<Entity[]>;
      }
    | {
        getCount(filter: Readonly<Filter>): Promise<number | void>;
        getPagination(req: NextApiRequest): Pagination;
        getFilter(req: NextApiRequest): Filter;
        getRows(
          filter: Readonly<Filter>,
          pagination: Readonly<Pagination>,
        ): Promise<Entity[]>;
      };
  createResource(input: any): Promise<Entity>;
  updateById(id: string, req: NextApiRequest): Promise<Entity>;
}

type Fields<E, D> = {
  [T in keyof D]: (entity: E) => D[T];
};

export interface Options<
  Entity extends {},
  DerivedFields extends {} = {},
  Pagination = DefaultPagination,
  Filter = unknown,
> {
  prefix: string[];
  fields?: Fields<Entity, DerivedFields>;
  hooks: Partial<Hooks<Entity, Filter, Pagination>>;
}

interface Context<Entity, DerivedFields> {
  path: string[];
  req: NextApiRequest;
  formatEntity(entity: Entity): Entity & Partial<DerivedFields>;
  itemId?: string;
}

export default function makeCollectionResource<
  Entity extends {},
  DerivedFields extends {} = {},
  Pagination = DefaultPagination,
  Filter = unknown,
>(options: Options<Entity, DerivedFields, Pagination, Filter>) {
  const { prefix, fields } = options;

  function formatEntity(entity: Entity) {
    if (!fields) return entity;

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

    async individual(ctx: Context<Entity, DerivedFields>) {
      if (ctx.req.method === "PUT") return updateSingleItem(ctx, options);
      if (ctx.req.method === "GET") return querySingleItem(ctx, options);
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
      const ctx: Context<Entity, DerivedFields> = {
        path: effectivePath,
        req,
        formatEntity,
      };

      if (isRoot) {
        const result = await APIs.root(ctx);
        res.json(result);
        return;
      }

      ctx.itemId = effectivePath[0];
      effectivePath.splice(0, 1);

      const result = await APIs.individual(ctx);
      res.json(result);
      return;
    },
  };
}

async function createEntity<Entity, DerivedFields, Pagination, Filter>(
  ctx: Context<Entity, DerivedFields>,
  options: Options<Entity, DerivedFields, Pagination, Filter>,
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

async function queryAllEntities<Entity, DerivedFields, Pagination, Filter>(
  ctx: Context<Entity, DerivedFields>,
  options: Options<Entity, DerivedFields, Pagination, Filter>,
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

async function querySingleItem<Entity, DerivedFields, Pagination, Filter>(
  ctx: Context<Entity, DerivedFields>,
  options: Options<Entity, DerivedFields, Pagination, Filter>,
) {
  if (!options.hooks.getById) {
    throw new Error("not supported");
  }

  const getById = options.hooks.getById;
  const item = await getById(ctx.itemId!);
  return { data: ctx.formatEntity(item) };
}

async function updateSingleItem<Entity, DerivedFields, Pagination, Filter>(
  ctx: Context<Entity, DerivedFields>,
  options: Options<Entity, DerivedFields, Pagination, Filter>,
) {
  if (!options.hooks.updateById) {
    throw new Error("not supported");
  }

  const updateById = options.hooks.updateById;
  const item = await updateById(ctx.itemId!, ctx.req);
  return { data: ctx.formatEntity(item) };
}
