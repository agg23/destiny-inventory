// The move service branches on destinyVersion and never reaches these for a D2 account
const unsupported = (): never => {
  throw new Error("Destiny 1 is not supported");
};

export const transfer = unsupported;
export const equip = unsupported;
export const equipItems = unsupported;
export const setItemState = unsupported;
