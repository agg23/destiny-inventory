import {
  PlatformErrorCodes,
  type DestinyProfileResponse,
  type ServerResponse,
} from "bungie-api-ts/destiny2";
import { vi, type MockedFunction } from "vitest";

type Destiny2Api = typeof import("app/bungie-api/destiny2-api");

export interface Destiny2ApiMocks {
  transferMock: MockedFunction<Destiny2Api["transfer"]>;
  equipMock: MockedFunction<Destiny2Api["equip"]>;
  equipItemsMock: MockedFunction<Destiny2Api["equipItems"]>;
  setLockStateMock: MockedFunction<Destiny2Api["setLockState"]>;
  setTrackedStateMock: MockedFunction<Destiny2Api["setTrackedState"]>;
  getCharactersMock: MockedFunction<Destiny2Api["getCharacters"]>;
  resetMocks: () => void;
}

// The move logic awaits these and ignores the body; the reducer is what updates the model
const successResponse: ServerResponse<number> = {
  Response: 0,
  ErrorCode: PlatformErrorCodes.Success,
  ThrottleSeconds: 0,
  ErrorStatus: "Success",
  Message: "",
  MessageData: {},
};

const getCharactersResponse = { characters: { data: {} } } as unknown as DestinyProfileResponse;

// Hoisted above the imports it replaces, so nothing has to be imported dynamically
vi.mock("app/bungie-api/destiny2-api", () => ({
  transfer: vi.fn(() => Promise.resolve(successResponse)),
  equip: vi.fn(() => Promise.resolve(successResponse)),
  equipItems: vi.fn(() => Promise.resolve({})),
  setLockState: vi.fn(() => Promise.resolve(successResponse)),
  setTrackedState: vi.fn(() => Promise.resolve(successResponse)),
  getCharacters: vi.fn(() => Promise.resolve(getCharactersResponse)),
}));

export const mockDestiny2Api = async (): Promise<Destiny2ApiMocks> => {
  const api = await import("app/bungie-api/destiny2-api");

  const mocks = {
    transferMock: api.transfer as MockedFunction<Destiny2Api["transfer"]>,
    equipMock: api.equip as MockedFunction<Destiny2Api["equip"]>,
    equipItemsMock: api.equipItems as MockedFunction<Destiny2Api["equipItems"]>,
    setLockStateMock: api.setLockState as MockedFunction<Destiny2Api["setLockState"]>,
    setTrackedStateMock: api.setTrackedState as MockedFunction<Destiny2Api["setTrackedState"]>,
    getCharactersMock: api.getCharacters as MockedFunction<Destiny2Api["getCharacters"]>,
  };

  return {
    ...mocks,
    resetMocks: () => {
      mocks.transferMock.mockReset().mockResolvedValue(successResponse);
      mocks.equipMock.mockReset().mockResolvedValue(successResponse);
      mocks.equipItemsMock.mockReset().mockResolvedValue({});
      mocks.setLockStateMock.mockReset().mockResolvedValue(successResponse);
      mocks.setTrackedStateMock.mockReset().mockResolvedValue(successResponse);
      mocks.getCharactersMock.mockReset().mockResolvedValue(getCharactersResponse);
    },
  };
};
