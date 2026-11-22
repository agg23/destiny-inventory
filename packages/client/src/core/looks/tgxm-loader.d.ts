declare module "tgxm-loader" {
  import type { AnimationClip, Bone, Group, Skeleton } from "three";

  interface DefinitionSource<T> {
    source: "asyncHandler";
    asyncHandler: (hash: string) => Promise<T>;
  }

  export interface TGXMLoaderOptions {
    Destiny2InventoryDefinition: DefinitionSource<unknown>;
    Destiny2GearAssetDefinition: DefinitionSource<unknown>;
    shaders: { source: "api" };
    iridescenceLookupPath: string;
    specularTintPath: string;
    specularLobePath: string;
    cubemapPaths: string[];
    X_API_KEY: string;
  }

  export interface LoadOptions {
    itemHash: number | string;
    game: "destiny2";
    isFemale: boolean;
    shaderHash: number | undefined;
    container?: TGXModelContainer;
    skeleton?: Skeleton;
  }

  export interface GuardianSkeleton {
    skeleton: Skeleton;
    rootBone: Bone;
    boneNames: string[];
  }

  export interface LoadProgress {
    loaded: number;
    total: number;
    text: string;
  }

  export class TGXModelContainer {
    readonly itemId: string;
    readonly groupObject: Group;
    readonly isDisposed: boolean;
    dispose(): void;
  }

  export class TGXMLoader {
    constructor(options: TGXMLoaderOptions);
    load(
      options: LoadOptions,
      onProgress: (progress: LoadProgress) => void,
    ): Promise<TGXModelContainer>;
    applyShaderToModel(
      container: TGXModelContainer,
      shaderHash: number | undefined,
    ): Promise<void>;
    dispose(id?: string): void;
    loadSkeleton(type: "guardian"): Promise<GuardianSkeleton>;
    loadAnimation(
      animationHash: number | string,
      animationFileName: string,
      boneNames: string[],
    ): Promise<AnimationClip>;
  }
}
