/**
 * Augment wouter's Route component type to accept components with
 * optional `embedded` prop (our standard page pattern).
 *
 * Without this, TS2322 fires on every `<Route component={LazyPage} />`
 * because LazyExoticComponent<({ embedded }?: ...) => Element> doesn't
 * satisfy ComponentType<RouteComponentProps>.
 */
import type { ComponentType, LazyExoticComponent, FunctionComponent, ReactNode } from "react";

declare module "wouter" {
  // Override Route to accept any component-like value
  export function Route<
    T extends DefaultParams | undefined = undefined,
    RoutePath extends PathPattern = PathPattern
  >(props: {
    children?:
      | ((params: any) => ReactNode)
      | ReactNode;
    path?: RoutePath;
    component?: ComponentType<any> | LazyExoticComponent<ComponentType<any>>;
    nest?: boolean;
  }): ReturnType<FunctionComponent>;
}
