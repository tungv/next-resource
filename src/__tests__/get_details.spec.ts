import { NextApiRequest, NextApiResponse } from "next";
import makeCollectionResource from "../collection";

it("should return single entity when GET /:id", async () => {
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
      async getById(id: string) {
        return {
          id,
          firstName: "FirstName",
          lastName: "LastName",
          age: 29,
        };
      },
    },
  });

  const req = {} as NextApiRequest;
  const res = {} as NextApiResponse;

  req.method = "GET";
  req.url = "/api/friends/123";

  res.json = jest.fn();
  res.status = jest.fn();

  await collection.run(req, res);

  expect(res.json).toHaveBeenCalledWith({
    data: {
      id: "123",
      firstName: "FirstName",
      lastName: "LastName",
      age: 29,
      fullName: "FirstName LastName",
    },
  });
});

it("should return single entity after updating when PUT /:id", async () => {
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
      async updateById(id: string, req: NextApiRequest) {
        return {
          id,
          firstName: "FirstName",
          lastName: "LastName",
          age: 30,
        };
      },
    },
  });

  const req = {} as NextApiRequest;
  const res = {} as NextApiResponse;

  req.method = "PUT";
  req.url = "/api/friends/123";
  req.body = {
    firstName: "FirstName",
    lastName: "LastName",
    age: 30,
  };

  res.json = jest.fn();
  res.status = jest.fn();

  await collection.run(req, res);

  expect(res.json).toHaveBeenCalledWith({
    data: {
      id: "123",
      firstName: "FirstName",
      lastName: "LastName",
      age: 30,
      fullName: "FirstName LastName",
    },
  });
});
