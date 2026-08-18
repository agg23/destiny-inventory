import { clsx, type ClassValue } from "clsx";

// Plain concatenation: no variant contradicts the base, so there is nothing to merge away
export const cn = (...classes: ClassValue[]): string => clsx(classes);
