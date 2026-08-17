// Only ever used in type position, so the shape doesn't have to be right

export type ThunkResult<R = void> = (
  dispatch: (action: unknown) => unknown,
  getState: () => unknown,
) => Promise<R>;

export type RootState = unknown;

export type ThunkDispatchProp = {
  dispatch: (action: unknown) => unknown;
};
