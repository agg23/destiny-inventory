// Type position only, the shape doesn't matter

export type ThunkResult<R = void> = (
  dispatch: (action: unknown) => unknown,
  getState: () => unknown,
) => Promise<R>;

export type RootState = unknown;

export type ThunkDispatchProp = {
  dispatch: (action: unknown) => unknown;
};
