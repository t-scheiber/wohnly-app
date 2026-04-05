/**
 * Fix for React 19 types + React Native class-based components.
 *
 * React 19's @types/react changed the JSX.ElementType constraint, breaking
 * React Native class components (View, Text, etc.) that don't have a `props`
 * property on the instance. This widens the constraint to accept RN components.
 *
 * See: https://github.com/facebook/react-native/issues/48280
 */
import type { ComponentClass } from "react";

declare module "react" {
  namespace JSX {
    // Widen ElementType to accept React Native class components
    type ElementType =
      | string
      | React.JSXElementConstructor<any>
      | ComponentClass<any, any>;
  }
}
