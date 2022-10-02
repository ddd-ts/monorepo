import { TokenManagerSuite } from "../domain/token-manager.suite";
import { JwtTokenManager } from "./jwt.token-manager";

describe("JwtTokenManager", () => {
  TokenManagerSuite(new JwtTokenManager());
});
