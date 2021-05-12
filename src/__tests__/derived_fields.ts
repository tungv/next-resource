import { NextApiRequest, NextApiResponse } from "next";
import makeCollectionResource from "../collection";

it("should return derived fields from POST /", async () => {
  type Friend = {
    firstName: string;
    lastName: string;
    age: number;
  };

  const collection = makeCollectionResource({
    prefix: ["api", "friends"],
    fields: {
      fullName(entity: Friend) {
        return entity.firstName + " " + entity.lastName;
      },
    },
    hooks: {
      async createResource() {
        return {
          id: "1",
          firstName: "FirstName",
          lastName: "LastName",
          age: 29,
        };
      },
    },
  });

  const req = {} as NextApiRequest;
  const res = {} as NextApiResponse;

  req.method = "POST";
  req.url = "/api/friends";

  res.json = jest.fn();
  res.status = jest.fn();

  await collection.run(req, res);

  expect(res.json).toHaveBeenCalledWith({
    data: {
      id: "1",
      firstName: "FirstName",
      lastName: "LastName",
      age: 29,
      fullName: "FirstName LastName",
    },
  });
});

it("should return derived fields from GET /", async () => {
  type Friend = {
    firstName: string;
    lastName: string;
    age: number;
  };

  const collection = makeCollectionResource({
    prefix: ["api", "friends"],
    fields: {
      fullName(entity: Friend) {
        return entity.firstName + " " + entity.lastName;
      },
    },
    hooks: {
      queryAllResource: {
        async getRows() {
          return [
            {
              id: "1",
              firstName: "A",
              lastName: "B",
              age: 12,
            },
            {
              id: "2",
              firstName: "A1",
              lastName: "B1",
              age: 21,
            },
          ];
        },
      },
    },
  });

  const req = {} as NextApiRequest;
  const res = {} as NextApiResponse;

  req.method = "GET";
  req.url = "/api/friends";

  res.json = jest.fn();
  res.status = jest.fn();

  await collection.run(req, res);

  expect(res.json).toHaveBeenCalledWith({
    data: [
      {
        id: "1",
        firstName: "A",
        lastName: "B",
        fullName: "A B",
        age: 12,
      },
      {
        id: "2",
        firstName: "A1",
        lastName: "B1",
        fullName: "A1 B1",
        age: 21,
      },
    ],
  });
});
