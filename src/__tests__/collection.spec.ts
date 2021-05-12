import { NextApiRequest, NextApiResponse } from "next";
import makeCollectionResource, { Options } from "../collection";

describe("collection", () => {
  interface MyEntity {
    id: string;
    name: string;
    age: number;
  }

  interface Pagination {
    pageSize: number;
    pageNumber: number;
    sort: "newest_first" | "oldest_first";
  }

  interface Filter {
    ageLimit?: number;
  }

  const sampleData: MyEntity[] = [
    { id: "1", name: "test 1", age: 10 },
    { id: "2", name: "test 2", age: 22 },
    { id: "3", name: "test 3", age: 14 },
    { id: "4", name: "test 4", age: 20 },
    { id: "5", name: "test 5", age: 15 },
    { id: "6", name: "test 6", age: 18 },
  ];

  it("GET /", async () => {
    const options: Options<MyEntity, never, Pagination, Filter> = {
      prefix: ["api", "my_items"],
      hooks: {
        queryAllResource: {
          getPagination(req) {
            const { query } = req;
            return {
              pageSize: Number.parseInt(query.pageSize as string, 10),
              pageNumber: Number.parseInt(query.pageNumber as string, 10),
              sort: "newest_first",
            };
          },
          getFilter(req) {
            return {
              ageLimit: Number.parseInt(req.query.age_gte as string, 10),
            };
          },
          async getCount(filter) {
            const { ageLimit } = filter;
            const cond =
              typeof ageLimit === "number"
                ? (row: MyEntity) => row.age >= ageLimit
                : () => true;
            return sampleData.filter(cond).length;
          },
          async getRows(filter, pagination) {
            const start = (pagination.pageNumber - 1) * pagination.pageSize;
            const end = start + pagination.pageSize;
            const { ageLimit } = filter;

            const cond =
              typeof ageLimit === "number"
                ? (row: MyEntity) => row.age >= ageLimit
                : () => true;

            return sampleData
              .filter(cond)
              .sort((a, z) => Number(z.id) - Number(a.id))
              .slice(start, end);
          },
        },
      },
    };
    const collection = makeCollectionResource(options);

    const req = {} as NextApiRequest;
    const res = {} as NextApiResponse;

    req.method = "GET";
    req.url = "/api/my_items";
    req.query = {
      pageSize: "10",
      pageNumber: "1",
      age_gte: "18",
    };

    res.json = jest.fn();
    res.status = jest.fn();

    await collection.run(req, res);

    expect(res.json).toHaveBeenCalledWith({
      data: [
        { id: "6", name: "test 6", age: 18 },
        { id: "4", name: "test 4", age: 20 },
        { id: "2", name: "test 2", age: 22 },
      ],
      pagination: {
        pageNumber: 1,
        pageSize: 10,
        total: 3,
        sort: "newest_first",
      },
    });
  });

  it("POST /", async () => {
    const options = {
      prefix: ["api", "my_items"],
      hooks: {
        async createResource(input: any): Promise<MyEntity> {
          return {
            id: "12",
            ...input,
          };
        },
      },
    };
    const collection = makeCollectionResource(options);

    const req = {} as NextApiRequest;
    const res = {} as NextApiResponse;

    req.method = "POST";
    req.url = "/api/my_items";
    req.body = {
      name: "test user",
      age: 18,
    };

    res.json = jest.fn();
    res.status = jest.fn();

    await collection.run(req, res);

    expect(res.json).toHaveBeenCalledWith({
      data: {
        id: "12",
        name: "test user",
        age: 18,
      },
    });
  });
});
