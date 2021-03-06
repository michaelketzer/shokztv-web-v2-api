import { NextFunction, Request, Response } from "express";

import { User } from "../entities/User";
import config from "../config";

export const checkUserRole = (roleIdent: string) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (config.env === "development") {
    //Bypass rights for dev enviorements
    return next();
  }

  if (!req.user) {
    return res.status(401).json("unauthorized").end();
  }

  if (
    !(req.user as User).roles.find(({ rights }) =>
      rights?.find(({ ident }) => ident === roleIdent)
    )
  ) {
    return res.status(403).json("forbidden").end();
  }

  return next();
};

export const checkAPIKey = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (config.env === "development") {
    //Bypass rights for dev enviorements
    return next();
  }

  if (
    config.vodFetcherApiKey.length > 0 &&
    req.params.apiKey !== config.vodFetcherApiKey
  ) {
    return res.status(403).json("forbidden").end();
  }

  return next();
};
